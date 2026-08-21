import { useCallback, useEffect, useRef, useState } from 'react';
import useStore from '../store';
import { Action } from '../types';
import { markEditorialPending } from '../SvgUtils';
import {
    PendingPlan, describeExpected, describeFade, describeSpinner,
    expectedTotalWaitTime, planPendingTransition,
} from '../utils/pending-wait';


interface WaitCoverConfig {
    svgContainerRef: React.RefObject<HTMLDivElement | null>;
    /**
     * Whether the pipeline still owes a page. Read when a delayed spinner comes due,
     * so a spinner is never raised for work that was already delivered.
     */
    isBusy: () => boolean;
}

/**
 * What covers the wait while a scheduled action runs — the editorial element dimming,
 * the score fading out — and when the spinner takes over from it.
 */
export default function useWaitCover({ svgContainerRef, isBusy }: WaitCoverConfig) {
    const showingEditorial = useStore.use.showingEditorial();
    const setShowingEditorial = useStore.use.setShowingEditorial();

    const [showSpinner, setShowSpinner] = useState(false);
    const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const spinnerVisibleRef = useRef(false);

    const isBusyRef = useRef(isBusy);
    isBusyRef.current = isBusy;

    const cancelSpinnerTimer = () => {
        if (spinnerTimerRef.current != null) {
            clearTimeout(spinnerTimerRef.current);
            spinnerTimerRef.current = null;
        }
    };

    useEffect(() => cancelSpinnerTimer, []);

    const setSpinner = useCallback((visible: boolean, reason: string) => {
        cancelSpinnerTimer();
        if (spinnerVisibleRef.current !== visible) {
            console.log(`[WaitCover] Spinner ${visible ? "on" : "off"} (${reason})`);
        }
        spinnerVisibleRef.current = visible;
        setShowSpinner(visible);
    }, []);

    // The spinner is never raised on the spot: something is always covering the first
    // moments of a wait — a fade out, an editorial element dimming — and a spinner on
    // top of it only adds a flash of dimmed score for a change that was already through.
    const showSpinnerAfter = useCallback((delay: number, reason: string) => {
        cancelSpinnerTimer();
        console.log(`[WaitCover] Spinner scheduled in ${delay}ms (${reason})`);
        spinnerTimerRef.current = setTimeout(() => {
            spinnerTimerRef.current = null;
            if (isBusyRef.current()) {
                setSpinner(true, reason);
            } else {
                console.log(`[WaitCover] Spinner not raised (${reason}): pipeline idle`);
            }
        }, delay);
    }, [setSpinner]);

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

    // Whether anything on screen can fade to cover a wait that replaces the page: the
    // editorial element being dimmed or the rendered score itself.
    const canFadeScore = useCallback(() =>
        showingEditorial !== null || svgContainerRef.current?.querySelector("svg") != null,
        [showingEditorial, svgContainerRef]);

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

    return { showSpinner, setSpinner, planFor, canFadeScore, fadeOutScore, applyPendingPlan };
}
