import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useStore from "./store";
import { Context } from './Context';
import { useComponentSize } from "react-use-size";
import ScoreProcessor from './ScoreProcessor';
import { useEditorialHandler } from './hooks/useEditorialHandler';
import useScoreActions, { RenderActionResult, shouldShowSpinner } from './hooks/useScoreActions';
import useScoreRenderer from './hooks/useScoreRenderer';
import { Action, RenderConfig, Transition, loadAction, renderAction } from './types';
import LoadingSpinner from './components/LoadingSpinner';
import useIdleCallback from './hooks/useIdleCallback';
import { getReverseTransposition } from './utils/score-utils';
import { preRenderOrder } from './utils/page-cache';
import { clearEditorialPending, markEditorialPending } from './SvgUtils';
import {
    PENDING_HANDLED, PendingPlan, describeExpected, describeFade, describeSpinner,
    expectedTotalWaitTime, forgetLastCost, planPendingTransition, recordCost,
} from './utils/pending-wait';


// How long the score takes to fade out under a cached page being crossfaded in.
const FADE_OUT_MS = 300;


export interface ScoreViewProps {
    backgroundColor?: string | undefined;
}


function ScoreView(scoreViewProps: ScoreViewProps) {

    const { backgroundColor } = scoreViewProps;
    const { verovio } = useContext(Context);

    const splitViewOrientation = useStore.use.splitViewOrientation();
    const isSplitView = useStore.use.isSplitView();

    // Store state management
    const targetHeight = useStore.use.targetHeight();
    const targetWidth = useStore.use.targetWidth();
    const setTargetWidth = useStore.use.setTargetWidth();
    const setTargetHeight = useStore.use.setTargetHeight();
    const setIsLoading = useStore.use.setIsLoading();
    const pendingAction = useStore.use.pendingAction();
    const setPendingAction = useStore.use.setPendingAction();

    const score = useStore.use.score();

    const showingMei = useStore.use.showingMei();
    const setShowingMei = useStore.use.setShowingMei();
    const playingState = useStore.use.playingState();
    const scale = useStore.use.scale();
    const setScale = useStore.use.setScale();
    const reachedEffectiveMaxScale = useStore.use.reachedEffectiveMaxScale();
    const setReachedEffectiveMaxScale = useStore.use.setReachedEffectiveMaxScale();
    const currentPage = useStore.use.currentPage();
    const pageCount = useStore.use.pageCount();
    const showNVerses = useStore.use.showNVerses();

    const normalizeFicta = useStore.use.normalizeFicta();
    const showEditorial = useStore.use.showEditorial();
    const showingEditorial = useStore.use.showingEditorial();
    const setShowingEditorial = useStore.use.setShowingEditorial();
    const appOptions = useStore.use.appOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const substOptions = useStore.use.substOptions();
    const withoutTransposition = useStore.use.withoutTransposition();
    const renderedSvgData = useStore.use.renderedSvgData();
    const setRenderedSvgData = useStore.use.setRenderedSvgData();
    const showOriginalClefs = useStore.use.showOriginalClefs();
    const showColoredNotes = useStore.use.showColoredNotes();
    const getCachedPage = useStore.use.getCachedPage();
    const setCachedPage = useStore.use.setCachedPage();
    const clearPageCache = useStore.use.clearPageCache();
    const pageCacheAccepts = useStore.use.pageCacheAccepts();
    const pageCache = useStore.use.pageCache();

    const showMusicAnalysis = useStore.use.showMusicAnalysis();
    const measureNumberInterval = useStore.use.measureNumberInterval();

    const { handleElementClick } = useEditorialHandler();
    const { ref: svgContainerRef, width: svgContainerWidth, height: svgContainerHeight } = useComponentSize();

    const [showSpinner, setShowSpinner] = useState(false);
    const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRenderedUrl = useRef<string | undefined | null>(null);

    // Serialization of the verovio pipeline. The worker holds a single toolkit
    // instance, so only one load/render chain may run at a time; and a setting
    // changed while one is running must not be lost. New requests are coalesced into
    // `queuedAction` (newest wins) and flushed when the chain ends, while
    // `generation` is bumped by every request so a chain that was superseded
    // mid-flight discards its results instead of overwriting the newer configuration.
    const runningRef = useRef(false);
    const generationRef = useRef(0);
    const queuedActionRef = useRef<Action | null>(null);
    const continuationRef = useRef<Action | null>(null);
    const pendingActionRef = useRef<Action | null>(null);

    pendingActionRef.current = pendingAction;

    // The spinner must only ever be up while the pipeline still owes us a page.
    const isPipelineBusy = () =>
        runningRef.current || queuedActionRef.current != null || pendingActionRef.current != null;

    const cancelSpinnerTimer = () => {
        if (spinnerTimerRef.current != null) {
            clearTimeout(spinnerTimerRef.current);
            spinnerTimerRef.current = null;
        }
    };


    const spinnerVisibleRef = useRef(false);
    const setSpinner = useCallback((visible: boolean, reason: string) => {
        cancelSpinnerTimer();
        if (spinnerVisibleRef.current !== visible) {
            console.log(`[ScoreView] Spinner ${visible ? "on" : "off"} (${reason})`);
        }
        spinnerVisibleRef.current = visible;
        setShowSpinner(visible);
    }, []);

    // The spinner is never raised on the spot: something is always covering the first
    // moments of a wait — a fade out, an editorial element dimming — and a spinner on
    // top of it only adds a flash of dimmed score for a change that was already through.
    const showSpinnerAfter = useCallback((delay: number, reason: string) => {
        cancelSpinnerTimer();
        console.log(`[ScoreView] Spinner scheduled in ${delay}ms (${reason})`);
        spinnerTimerRef.current = setTimeout(() => {
            spinnerTimerRef.current = null;
            if (isPipelineBusy()) {
                setSpinner(true, reason);
            } else {
                console.log(`[ScoreView] Spinner not raised (${reason}): pipeline idle`);
            }
        }, delay);
    }, []);

    // What covers a wait and when the spinner takes over, decided on what the same
    // work took last time. Logged here so every plan shows up once, wherever it is made.
    // `canFade` widens the default (an editorial element being dimmed) for callers that
    // also fade the rendered score out.
    const planFor = useCallback((
        actionType: Action["type"],
        wantsSpinner: boolean,
        canFade: boolean = showingEditorial !== null,
    ): PendingPlan => {
        const expectedMs = expectedTotalWaitTime(actionType);
        const plan = planPendingTransition(expectedMs, canFade, wantsSpinner);
        console.log(
            `[waiting plan for ${actionType}] expected time: ${describeExpected(expectedMs)}, ` +
            `fade: ${describeFade(plan)}, showing spinner: ${describeSpinner(plan)}`
        );

        return plan;
    }, [showingEditorial]);

    const fadeOutScore = useCallback((fadeMs: number) => {
        const currentSvg = svgContainerRef.current?.querySelector("svg") as SVGSVGElement | null;
        if (currentSvg) {
            currentSvg.style.transition = `opacity ${fadeMs}ms ease-out`;
            currentSvg.style.opacity = '0';
        }
    }, [svgContainerRef]);

    // `raiseNow` puts a spinner due at 0ms up synchronously instead of through a timer,
    // for callers about to block the thread with work the spinner should be seen during.
    // `fadeScore` fades the rendered score out over the plan's fade, for the paths that
    // replace the page on screen (a page turn, a zoom, a resize) rather than redraw it.
    const applyPendingPlan = useCallback((
        plan: PendingPlan,
        reason: string,
        opts: { raiseNow?: boolean, fadeScore?: boolean } = {},
    ) => {
        if (opts.fadeScore && plan.fadeMs !== null) {
            fadeOutScore(plan.fadeMs);
        }
        if (showingEditorial) {
            if (plan.fadeMs !== null) {
                markEditorialPending(showingEditorial, plan.fadeMs);
            }
            setShowingEditorial(null);
        }
        if (plan.spinnerAfterMs === null) {
            return;
        }
        if (plan.spinnerAfterMs === 0 && opts.raiseNow) {
            setSpinner(true, reason);
        } else {
            showSpinnerAfter(plan.spinnerAfterMs, reason);
        }
    }, [showingEditorial, setShowingEditorial, setSpinner, showSpinnerAfter, fadeOutScore]);



    const {
        svgContainerClasses,
        calculateEffectiveMaxScale,
    } = useScoreRenderer({
        autoScroll: false,
        showEditorial,
        playingState,
        svgContainerRef,
        svgContainerHeight
    });

    const { executeAction, scoreRenderOptions } = useScoreActions({
        verovio,
    });

    // Identifies the settings a load would hand to verovio, so a change that leaves
    // them untouched does not trigger a reload: turning off a transposition on a score
    // that is not transposed resolves to the same empty `transpose` either way.
    const renderKey = useMemo(() => JSON.stringify({
        ...scoreRenderOptions,
        transpose: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : "",
    }), [scoreRenderOptions, withoutTransposition, score?.properties?.encodedTransposition]);
    const loadedRenderKeyRef = useRef<string | null>(null);

    // The store outlives this component, so `showingMei` and `renderedSvgData` may
    // still describe what a previous instance rendered. Both no-op guards below rely
    // on them, so they also check that the SVG is really in this container: on a
    // remount it is empty and the score has to be rendered again.
    const showsRenderedScore = () =>
        renderedSvgData?.scoreUrl === score?.url && svgContainerRef.current?.querySelector("svg") != null

    const canSchedule = () => (score && verovio && svgContainerWidth > 0 && svgContainerHeight > 0)
    const isReady = () => (canSchedule() && !pendingAction)

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
            // Hide spinner when all actions complete
            setSpinner(false, "chain finished");
            // Nothing else is coming: a chain that failed left the old SVG on screen,
            // and with it the spinner marking a change that is no longer on its way.
            clearEditorialPending(svgContainerRef.current);
        }
    }, [flushQueuedAction, setPendingAction, setSpinner, svgContainerRef]);

    // Single entry point for every configuration-driven (re)load: it never drops a
    // request, so the last option the user picked is always the one rendered.
    const scheduleAction = useCallback((action: Action, plan?: PendingPlan) => {

        applyPendingPlan(
            plan ?? planFor(action.type, shouldShowSpinner(action)),
            `${action.type} action`,
        );

        if (action.type === "load") {
            // A load repaginates the score, so every cached page becomes stale. Doing
            // it here rather than on every settings change means a change that ends up
            // not reloading also keeps the cache.
            loadedRenderKeyRef.current = renderKey;
            clearPageCache();
        }
        generationRef.current += 1;
        if (runningRef.current) {
            queuedActionRef.current = action;
            return;
        }
        queuedActionRef.current = null;
        // isPipelineBusy() reads this ref, which is otherwise only refreshed on render:
        // a spinner scheduled with no delay would fire before that and find the pipeline
        // idle, so it would never come up.
        pendingActionRef.current = action;
        setPendingAction(action);
    }, [setPendingAction, renderKey, clearPageCache, showingEditorial, setShowingEditorial, showSpinnerAfter]);

    const processPendingAction = useCallback(async (action: Action) => {

        const generation = generationRef.current;
        const startedAt = performance.now();
        const { success, nextAction, result } = await executeAction(action, svgContainerRef.current!);
        const elapsed = performance.now() - startedAt;

        if (action.type === "load" || action.type === "render") {
            recordCost(action.type, elapsed);
        }


        // A newer configuration was requested while this chain was running, so its
        // results describe a state the user already moved away from. Drop them and
        // let the queued request take over.
        if (generation !== generationRef.current) {
            console.log(`[ScoreView] Discarding superseded ${action.type} action`);
            finishChain();
            return;
        }

        if (success) {
            if (nextAction) {
                continuationRef.current = nextAction;
                setPendingAction(nextAction);
            }

            if (action.type === "render" && result) {
                // Handle the results of render actions

                const renderResult = result as RenderActionResult
                const { newSvg, scale: newScale } = renderResult;

                // Capture the SVG HTML for caching
                const svgHTML = svgContainerRef.current?.innerHTML || '';
                const svgDataWithHTML = { ...newSvg, svgHTML };

                setRenderedSvgData(svgDataWithHTML);

                // Cache the current page for instant back navigation
                setCachedPage(svgDataWithHTML.page, svgDataWithHTML);

                // Fade in only what asked for it: the paths that fade the old score out
                // first (a page turn, a zoom, a resize) and the ones that put a different
                // score on screen. A reload that only changes what is drawn — a reading,
                // a verse count — replaces a score the reader is still looking at, and
                // there is nothing to fade from.
                const svgElement = svgContainerRef.current?.querySelector("svg") as SVGSVGElement | null;
                if (svgElement && (action.config as RenderConfig).transition != undefined) {
                    svgElement.style.opacity = '0';
                    svgElement.style.transition = 'opacity 300ms ease-in';
                    setTimeout(() => {
                        svgElement.style.opacity = '1';
                    }, 10);
                }


                setIsLoading(false);

                setScale(newScale);

                // Calculate max scale after transition completes
                setTimeout(() => {
                    const newMaxScale = calculateEffectiveMaxScale(reachedEffectiveMaxScale);
                    if (newMaxScale !== reachedEffectiveMaxScale) {
                        setReachedEffectiveMaxScale(newMaxScale);
                    }
                }, 400);
            }

            if (!nextAction) {
                finishChain();
            }
        } else {
            console.error("Action execution failed");
            // Always close the chain, otherwise isReady() stays false and every
            // later render/page-turn is silently dropped (e.g. audio-driven page changes).
            finishChain();
            setIsLoading(false);
        }
    }, [executeAction, svgContainerRef, setPendingAction, finishChain, setRenderedSvgData, setCachedPage, setIsLoading, setScale, calculateEffectiveMaxScale, reachedEffectiveMaxScale, setReachedEffectiveMaxScale]);


    // Process pending actions
    useEffect(() => {
        if (!pendingAction || !verovio || !svgContainerRef.current) {
            return;
        }

        if (targetHeight <= 0) {
            setPendingAction(null);
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

        (async () => {
            await processPendingAction(pendingAction);
        }
        )();
    }, [pendingAction]);

    useEffect(() => {
        if (!verovio || !showingMei || !renderedSvgData || !score) {
            return
        }
        // A layout change zeroes the target size on purpose, to hold the reload until
        // the reflow settles the final container size.
        if (targetHeight <= 0 || targetWidth <= 0) {
            return
        }
        console.log(`[ScoreView] Reloading score for new target size ${targetWidth}x${targetHeight}`);

        // The old layout is replaced wholesale, so its fade covers the wait; the load's
        // FADE_IN then crossfades the new one in.
        const plan = planFor("load", true,
            showingEditorial !== null || svgContainerRef.current?.querySelector("svg") != null);
        applyPendingPlan(plan, "new target size", { fadeScore: true });

        const anchor = (renderedSvgData.scoreUrl == score.url && renderedSvgData.anchorElement) ? renderedSvgData.anchorElement : undefined
        const action = loadAction({
            scoreUrl: score.url,
            postLoadTransition: Transition.FADE_IN,
            meiStr: showingMei,
            page: 1,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
            restorePositionForAchor: anchor
        });
        scheduleAction(action, PENDING_HANDLED);

    }, [targetHeight, targetWidth]);


    // Must stay reproducible: `updateLoadedScore` compares its output against the
    // currently loaded MEI to decide whether a reload is needed at all. The three
    // filters below only drop nodes and attributes, unlike the ones applied when the
    // score is fetched, which mint random xml:ids. Adding an id-generating filter here
    // would make every call produce a different string and silently defeat that check.
    const generateShowingScore = useCallback(() => {
        if (!score) return null;

        const scoreProcessor = new ScoreProcessor(score.originalMei);
        if (normalizeFicta) {
            scoreProcessor.addNormalizeFictaFilter();
        }
        if (showNVerses != null && showNVerses != score.properties?.numVerses) {
            scoreProcessor.addNVersesFilter(showNVerses);
        }
        if (!showColoredNotes) {
            scoreProcessor.addRemoveBracketSpanFilter();
        }
        return scoreProcessor.filterScore();
    }, [score, normalizeFicta, showNVerses, showColoredNotes]);

    const updateLoadedScore = useCallback((restoreAnchor: boolean, fadeIn: boolean) => {
        const startTime = performance.now();

        // Rebuilding the MEI, loading it and rendering it is the whole wait here, and the
        // rebuild runs synchronously: whatever covers the wait has to be in place before
        // it starts, or it will not paint until it is over. The load scheduled below is
        // told so, rather than planning again for a wait that is already covered.
        const plan = planFor("generate", true);
        applyPendingPlan(plan, "rebuilding score", { raiseNow: true });

        const newShowingMei = generateShowingScore();
        const generateMs = performance.now() - startTime;
        recordCost("generate", generateMs);
        console.log(`[ScoreView] generateShowingScore took ${generateMs.toFixed(2)}ms`);

        if (!newShowingMei) {
            console.log(`Error generating showing MEI`);
            setSpinner(false, "could not generate MEI");
            return;
        }

        // An identical MEI means the setting that triggered this is a no-op for this
        // score (normalizing ficta where there is none, a verse limit above the verse
        // count, removing coloration brackets that do not exist...), so there is
        // nothing to reload. Only skip when that MEI is what is actually on screen: a
        // previous load may have failed and left `showingMei` set with nothing rendered.
        if (newShowingMei === showingMei && showsRenderedScore()) {
            console.log(`[ScoreView] Skipping reload: the generated MEI is unchanged`);
            setSpinner(false, "reload skipped");
            return;
        }

        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: fadeIn ? Transition.FADE_IN : undefined,
            meiStr: newShowingMei,
            page: 1,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
            restorePositionForAchor: restoreAnchor && renderedSvgData?.anchorElement ? renderedSvgData.anchorElement : undefined
        });
        scheduleAction(action, PENDING_HANDLED);
        setShowingMei(newShowingMei);
    }, [score, renderedSvgData?.anchorElement, renderedSvgData?.scoreUrl, showingMei, scale, scheduleAction, setShowingMei, generateShowingScore]);

    useEffect(() => cancelSpinnerTimer, []);



    useEffect(() => {
        if (!score) return;

        const isNewScore = lastRenderedUrl.current != score.url;
        if (isNewScore) {
            // Its size, its editorial apparatus and its page count are all different, so
            // there is nothing to carry over: the wait is unknown again, and unknown is
            // what gives the spinner the benefit of the doubt.
            forgetLastCost();
        }
        updateLoadedScore(false, isNewScore);
        return () => {
            lastRenderedUrl.current = score?.url
        }
    }, [score]);


    // This group of changes require rebuilding the score and reloading it
    // (updateLoadedScore skips the reload when the rebuilt MEI turns out identical)
    useEffect(() => {
        if (!score) return;
        updateLoadedScore(true, false);
    }, [showNVerses, normalizeFicta, showColoredNotes]);



    // Handle the initial load when verovio has been initialized and when the container is ready
    // and queued render actions because the container was not visible (when shoing only text tab, for example).
    // As the component might have been removed from the tree (svgContainerHeight = 0),
    // we check if we have loaded and rendered the same score. Page is also checked because
    // whe might support keep the player going when the component is not visible (switching to text tab,
    // for example).
    useEffect(() => {
        if (!isReady() || !showingMei) {
            return;
        }

        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: Transition.FADE_IN,
            meiStr: showingMei,
            page: 1,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
        });
        scheduleAction(action);


    }, [verovio, svgContainerRef.current]);


    useEffect(() => {
        if (svgContainerHeight <= 0 || svgContainerWidth <= 0) {
            return;
        }
        // The measured size is always recorded, even with a load in flight: this effect
        // only re-runs when the container changes, so bailing out here used to lose the
        // final size of a layout change for good (closing the split view left the score
        // laid out for the old pane). scheduleAction coalesces it against what is running.
        if (renderedSvgData && renderedSvgData?.scoreUrl == score?.url) {
            if (renderedSvgData?.height && renderedSvgData?.width &&
                Math.abs(renderedSvgData.height - svgContainerHeight) < 100 &&
                Math.abs(renderedSvgData.width - svgContainerWidth) < 100 &&
                renderedSvgData?.page == currentPage &&
                renderedSvgData?.scale == scale) {
                return
            }
        }
        // Covering the wait is left to the reload this triggers, which plans it.
        setTargetHeight(svgContainerHeight);
        setTargetWidth(svgContainerWidth);
    }, [svgContainerHeight, svgContainerWidth]);

    useEffect(() => {
        // prevent reloading score until layout change reflow sets the final container size
        setTargetHeight(0);
        setTargetWidth(0);
    }, [splitViewOrientation, isSplitView]);


    // Handle scale changes
    useEffect(() => {
        if (!canSchedule() || !showingMei) return;

        // Fade the old scale out for the crossfade with the load's FADE_IN below.
        const plan = planFor("load", true,
            showingEditorial !== null || svgContainerRef.current?.querySelector("svg") != null);
        applyPendingPlan(plan, "scale change", { fadeScore: true });

        const anchorElement = renderedSvgData?.anchorElement || undefined;

        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: Transition.FADE_IN, // crossfades with the fade out above
            meiStr: showingMei,
            page: currentPage,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
            restorePositionForAchor: anchorElement
        });
        scheduleAction(action, PENDING_HANDLED);
    }, [scale]);

    const reloadScore = () => {
        if (!canSchedule() || !showingMei) return;

        // Same reasoning as the MEI comparison in updateLoadedScore, on the other half
        // of the settings: if what reaches verovio is what is already rendered, the
        // change was a no-op for this score.
        if (renderKey === loadedRenderKeyRef.current && showsRenderedScore()) {
            console.log(`[ScoreView] Skipping reload: verovio options unchanged`);
            return;
        }

        const page = currentPage > 0 ? currentPage : 1;
        const anchor = renderedSvgData?.anchorElement || undefined;
        const action = loadAction(
            {
                scoreUrl: score?.url || "",
                meiStr: showingMei,
                page: page,
                scale,
                transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
                restorePositionForAchor: anchor
            });
        scheduleAction(action);
    }

    // These changes requires reloading the currently built score
    useEffect(() => {
        reloadScore();
    }, [appOptions, choiceOptions, substOptions, withoutTransposition, showMusicAnalysis, measureNumberInterval]);

    useEffect(() => {
        reloadScore()
    }, [showOriginalClefs]);


    useEffect(() => {
        if (!isReady() || !showingMei || !renderedSvgData) return;

        if (currentPage < 1 || currentPage == renderedSvgData.page) {
            return;
        }

        // Try to get from cache first
        const cachedPage = getCachedPage(currentPage);
        if (cachedPage && cachedPage.svgHTML) {
            console.log(`[ScoreView] Using cached page ${currentPage}`);

            setSpinner(false, `cached page ${currentPage}`);
            // No wait to plan for: just crossfade with the cached page appended below.
            fadeOutScore(FADE_OUT_MS);

            // Create new SVG element for fade in
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cachedPage.svgHTML;
            const newSvg = tempDiv.querySelector("svg") as SVGSVGElement | null;

            if (newSvg && svgContainerRef.current) {
                // Reset opacity to 1 first (cached SVG has opacity: 0 from rendering)
                newSvg.style.opacity = '1';

                // Position new SVG absolutely on top
                newSvg.style.position = 'absolute';
                newSvg.style.top = '0';
                newSvg.style.left = '0';

                // Add new SVG to container
                svgContainerRef.current.appendChild(newSvg);

                // Now set to 0 and animate to 1 for fade in
                newSvg.style.opacity = '0';
                newSvg.style.transition = 'opacity 200ms ease-in';

                // Trigger fade in
                setTimeout(() => {
                    newSvg.style.opacity = '1';
                }, 10);

                // Clean up after animation
                setTimeout(() => {
                    if (svgContainerRef.current) {
                        svgContainerRef.current.innerHTML = cachedPage.svgHTML;
                        // Reset opacity on the final SVG
                        const finalSvg = svgContainerRef.current.querySelector("svg") as SVGSVGElement | null;
                        if (finalSvg) {
                            finalSvg.style.opacity = '1';
                            finalSvg.style.transition = '';
                        }
                    }
                    setRenderedSvgData(cachedPage);
                    setIsLoading(false);
                }, 220); // Slightly longer than animation
            } else {
                // Fallback if something goes wrong
                if (svgContainerRef.current) {
                    svgContainerRef.current.innerHTML = cachedPage.svgHTML;
                    const finalSvg = svgContainerRef.current.querySelector("svg") as SVGSVGElement | null;
                    if (finalSvg) {
                        finalSvg.style.opacity = '1';
                    }
                }
                setRenderedSvgData(cachedPage);
                setIsLoading(false);
            }

            return;
        }

        // Not in cache: the fade of the outgoing page covers the render. The spinner is
        // asked for explicitly, since the action's FADE_IN only covers the end of the
        // wait, not its middle.
        const currentSvg = svgContainerRef.current?.querySelector("svg") as SVGSVGElement | null;
        const plan = planFor("render", true, showingEditorial !== null || currentSvg != null);
        applyPendingPlan(plan, `page ${currentPage} render`, { fadeScore: true });

        const action = renderAction({
            scoreUrl: renderedSvgData.scoreUrl,
            transition: Transition.FADE_IN,  // crossfades with the fade out above
            renderPage: currentPage,
            loadedWidth: renderedSvgData.width || svgContainerWidth,
            loadedHeight: renderedSvgData.height || svgContainerHeight,
            scale,
            loadedPagesCount: pageCount,
            timemap: renderedSvgData.timemap
        });
        scheduleAction(action, PENDING_HANDLED);
    }, [currentPage, getCachedPage, setRenderedSvgData, setIsLoading]);

    // Reading position at which a pre-rendered page was evicted as soon as it was cached:
    // the cache is full here, and every page left is further from the reader than the one
    // just dropped, so the fill stops until the reader moves.
    const preRenderStalledAt = useRef<number | null>(null);

    // Fill the cache outwards from the page on screen, one page per idle slot: caching a
    // page changes `pageCache`, which schedules the next idle callback for the page after
    // it, so the browser keeps a say between pages and a page turn always comes first.
    useIdleCallback(() => {
        if (!verovio || !svgContainerRef.current || !renderedSvgData || !isReady()) return;
        if (preRenderStalledAt.current === renderedSvgData.page) return;

        const page = preRenderOrder(renderedSvgData.page, pageCount).find(p => !getCachedPage(p));
        if (page === undefined || !pageCacheAccepts(page)) return;

        console.log(`[ScoreView] Pre-rendering page ${page}`);
        preRenderPage(page);
    }, [renderedSvgData, pageCache, pageCount, verovio]);

    const preRenderPage = async (page: number) => {
        if (!verovio || !renderedSvgData || runningRef.current) return;

        // A pre-render drives the same toolkit as a load/render chain, so it has to
        // hold the pipeline too: a setting changed meanwhile is queued, not run on top.
        runningRef.current = true;
        const generation = generationRef.current;

        try {
            const startTime = performance.now();

            // Create a temporary container for pre-rendering
            const tempContainer = document.createElement('div');
            tempContainer.style.display = 'none';
            tempContainer.style.position = 'absolute';
            tempContainer.style.top = '-9999px';
            document.body.appendChild(tempContainer);

            const action = renderAction({
                scoreUrl: renderedSvgData.scoreUrl,
                transition: undefined,  // No transition for pre-render
                renderPage: page,
                loadedWidth: renderedSvgData.width || targetWidth,
                loadedHeight: renderedSvgData.height || targetHeight,
                scale: renderedSvgData.scale,
                loadedPagesCount: pageCount,
                timemap: renderedSvgData.timemap
            });

            const result = await executeAction(action, tempContainer);

            if (result.success && result.result) {
                const renderResult = result.result as RenderActionResult;

                // Capture the SVG HTML from temp container
                const svgHTML = tempContainer.innerHTML;
                const svgDataWithHTML = { ...renderResult.newSvg, svgHTML };

                // Only cache it if the configuration it was rendered with is still the
                // current one; otherwise it would repopulate a cache that was just
                // cleared for the new settings.
                if (generation === generationRef.current) {
                    setCachedPage(page, svgDataWithHTML);
                    if (getCachedPage(page)) {
                        console.log(`[ScoreView] Pre-rendered page ${page} in ${(performance.now() - startTime).toFixed(0)}ms`);
                    } else {
                        console.log(`[ScoreView] Page cache full at page ${renderedSvgData.page}: page ${page} was evicted on arrival`);
                        preRenderStalledAt.current = renderedSvgData.page;
                    }
                }
            }

            // Clean up temp container
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error(`Error pre-rendering page ${page}:`, error);
        } finally {
            runningRef.current = false;
            flushQueuedAction();
        }
    };



    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div ref={svgContainerRef}
                className={"static-score " + svgContainerClasses.join(" ")}
                style={{
                    width: "100%",
                    height: "100%",
                    background: backgroundColor || 'white',
                    "--score-bg-color": backgroundColor
                } as React.CSSProperties}
                onClick={handleElementClick} />
            <LoadingSpinner visible={showSpinner} />
        </div>

    );
}

export default ScoreView;
