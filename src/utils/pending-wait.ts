import { Action } from '../types';
import { EDITORIAL_PENDING_MAX_FADE_MS, EDITORIAL_PENDING_MIN_FADE_MS } from '../SvgUtils';

// A wait shorter than this is not worth a spinner: by the time the reader reads it, it
// is gone, and the dimmed score it leaves behind reads as a stutter.
const SPINNER_WORTH_IT_MS = 400;

export type Phase = "generate" | "load" | "render";

// What the last generate, load and render cost, in ms, or undefined while a phase has
// not been measured for a given score
const lastCostMs: Record<Phase, number | undefined> = {
    generate: undefined,
    load: undefined,
    render: undefined,
};

export const recordCost = (phase: Phase, ms: number) => {
    lastCostMs[phase] = ms;
};

export const forgetLastCost = () =>
    Object.assign(lastCostMs, { generate: undefined, load: undefined, render: undefined });

const sumMeasured = (...costs: Array<number | undefined>): number | undefined =>
    costs.every((c): c is number => c !== undefined)
        ? costs.reduce((a, b) => a + b, 0)
        : undefined;

export const expectedTotalWaitTime = (actionType: Action["type"]): number | undefined => {
    switch (actionType) {
        case "generate":
            return sumMeasured(lastCostMs.generate, lastCostMs.load, lastCostMs.render);
        case "load":
            return sumMeasured(lastCostMs.load, lastCostMs.render);
        case "render":
            return sumMeasured(lastCostMs.render);
        default:
            return undefined;
    }
};

const spinnerWorthIt = (expectedMs: number | undefined, coveredMs = 0): boolean =>
    expectedMs === undefined || expectedMs - coveredMs > SPINNER_WORTH_IT_MS;

export type PendingPlan = {
    fadeMs: number | null;
    spinnerAfterMs: number | null;
};

/** A plan with nothing left to do: the caller already covered the wait. */
export const PENDING_HANDLED: PendingPlan = { fadeMs: null, spinnerAfterMs: null };

export const describeSpinner = ({ spinnerAfterMs }: PendingPlan): string =>
    spinnerAfterMs === null ? "never"
        : spinnerAfterMs === 0 ? "now"
            : `after ${spinnerAfterMs.toFixed(0)}ms`;

export const describeFade = ({ fadeMs }: PendingPlan): string =>
    fadeMs === null ? "none" : `${fadeMs.toFixed(0)}ms`;

export const describeExpected = (expectedMs: number | undefined): string =>
    expectedMs === undefined ? "unknown" : `${expectedMs.toFixed(0)}ms`;

// `canFade` says there is something on screen whose fade can cover the start of the
// wait: the editorial element being dimmed, the rendered score fading out, or both.
// The thresholds bound any covering fade, not just the editorial dimming they are
// named after: never longer than the wait it covers, and dropped when so short it
// would read as a flicker.
export function planPendingTransition(
    expectedMs: number | undefined,
    canFade: boolean,
    wantsSpinner: boolean,
): PendingPlan {
    const fadeCandidate = expectedMs === undefined
        ? EDITORIAL_PENDING_MAX_FADE_MS
        : Math.min(EDITORIAL_PENDING_MAX_FADE_MS, expectedMs);
    const fadeMs = canFade && fadeCandidate >= EDITORIAL_PENDING_MIN_FADE_MS
        ? fadeCandidate
        : null;

    if (!wantsSpinner) {
        return { fadeMs, spinnerAfterMs: null };
    }
    const spinnerAfterMs = fadeMs ?? 0;
    return {
        fadeMs,
        spinnerAfterMs: spinnerWorthIt(expectedMs, spinnerAfterMs) ? spinnerAfterMs : null,
    };
}
