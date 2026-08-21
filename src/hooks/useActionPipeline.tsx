import { useCallback, useEffect, useRef } from 'react';
import useStore from '../store';
import { Action } from '../types';


export interface ActionOutcome {
    success: boolean;
    nextAction: Action | null;
    result: unknown;
}

interface ActionPipelineConfig {
    /** Runs one action of a chain and reports how it went. */
    execute: (action: Action) => Promise<ActionOutcome>;
    /**
     * Applies a successful action's result. Only called while the configuration the
     * action ran under is still the current one.
     */
    onResult: (action: Action, result: unknown) => void;
    /** A chain step failed. The chain is closed regardless. */
    onFailure: () => void;
    /** The pipeline went idle: the chain is over and nothing was queued behind it. */
    onIdle: () => void;
    /**
     * Whether actions can be processed at all; while false they stay pending. A value
     * rather than a predicate on purpose. It is what tells the dispatch below to run
     * again once what it was waiting for (the toolkit, the container) is there.
     */
    canRun: boolean;
}

/**
 * Serialization of the verovio pipeline. The worker holds a single toolkit instance,
 * so only one load/render chain may run at a time; and a setting changed while one is
 * running must not be lost. New requests are coalesced into `queuedAction` (newest
 * wins) and flushed when the chain ends, while `generation` is bumped by every request
 * so a chain that was superseded mid-flight discards its results instead of
 * overwriting the newer configuration.
 *
 * The hook owns only the ordering; what an action does and what its results mean stay
 * with the caller, behind the config callbacks.
 */
export default function useActionPipeline(config: ActionPipelineConfig) {
    const { canRun } = config;
    const pendingAction = useStore.use.pendingAction();
    const setPendingAction = useStore.use.setPendingAction();

    const runningRef = useRef(false);
    const generationRef = useRef(0);
    const queuedActionRef = useRef<Action | null>(null);
    const continuationRef = useRef<Action | null>(null);
    const pendingActionRef = useRef<Action | null>(null);

    pendingActionRef.current = pendingAction;

    // The callbacks are read through a ref refreshed on every render, so a chain that
    // spans several renders always sees the caller's latest closures instead of the
    // ones captured when it started.
    const configRef = useRef(config);
    configRef.current = config;

    /** Whether the pipeline still owes a page for a request already made. */
    const isBusy = useCallback(() =>
        runningRef.current || queuedActionRef.current != null || pendingActionRef.current != null,
        []);

    // Dispatch whatever request was coalesced while the pipeline was busy.
    const flushQueuedAction = useCallback(() => {
        const queued = queuedActionRef.current;
        queuedActionRef.current = null;
        if (queued) {
            setPendingAction(queued);
            return true;
        }
        return false;
    }, [setPendingAction]);

    const finishChain = useCallback(() => {
        runningRef.current = false;
        if (!flushQueuedAction()) {
            setPendingAction(null);
            configRef.current.onIdle();
        }
    }, [flushQueuedAction, setPendingAction]);

    /**
     * Entry point for every request: it never drops one, so the last configuration the
     * user picked is always the one rendered.
     */
    const schedule = useCallback((action: Action) => {
        generationRef.current += 1;
        if (runningRef.current) {
            queuedActionRef.current = action;
            return;
        }
        queuedActionRef.current = null;
        // isBusy() reads this ref, which is otherwise only refreshed on render: a
        // spinner scheduled with no delay would fire before that and find the pipeline
        // idle, so it would never come up.
        pendingActionRef.current = action;
        setPendingAction(action);
    }, [setPendingAction]);

    const runChainStep = useCallback(async (action: Action) => {
        const generation = generationRef.current;
        const { success, nextAction, result } = await configRef.current.execute(action);

        // A newer configuration was requested while this chain was running, so its
        // results describe a state the user already moved away from. Drop them and
        // let the queued request take over.
        if (generation !== generationRef.current) {
            console.log(`[ActionPipeline] Discarding superseded ${action.type} action`);
            finishChain();
            return;
        }

        if (success) {
            if (nextAction) {
                continuationRef.current = nextAction;
                setPendingAction(nextAction);
            }
            if (result != null) {
                configRef.current.onResult(action, result);
            }
            if (!nextAction) {
                finishChain();
            }
        } else {
            // Always close the chain, otherwise isBusy() stays true and every later
            // request is silently queued behind a step that will never end.
            configRef.current.onFailure();
            finishChain();
        }
    }, [finishChain, setPendingAction]);

    /**
     * One-off work that drives the same shared toolkit outside a chain (pre-rendering a
     * page): it has to hold the pipeline too, so a request made meanwhile is queued,
     * not run on top. Refused (returning false) while a chain is running; whatever was
     * queued during `fn` is flushed when it ends. `stillCurrent` tells `fn` whether a
     * new request superseded the configuration it started under.
     */
    const runExclusive = useCallback(async (fn: (stillCurrent: () => boolean) => Promise<void>): Promise<boolean> => {
        if (runningRef.current) {
            return false;
        }
        runningRef.current = true;
        const generation = generationRef.current;
        try {
            await fn(() => generation === generationRef.current);
        } finally {
            runningRef.current = false;
            flushQueuedAction();
        }
        return true;
    }, [flushQueuedAction]);

    // Announced onIdle when nothing is pending.
    useEffect(() => {
        if (!pendingAction && !runningRef.current && queuedActionRef.current == null) {
            configRef.current.onIdle();
        }
    }, [pendingAction]);

    // Process pending actions
    useEffect(() => {
        if (!pendingAction || !canRun) {
            return;
        }
        // Never start a second chain on top of a running one: both would interleave
        // their setOptions/loadData on the shared toolkit. Queue a copy instead, so
        // flushing it is seen as a new pending action.
        if (runningRef.current && pendingAction !== continuationRef.current) {
            queuedActionRef.current = { ...pendingAction };
            return;
        }
        continuationRef.current = null;
        runningRef.current = true;
        runChainStep(pendingAction);
    }, [pendingAction, canRun]);

    return { schedule, isBusy, runExclusive };
}
