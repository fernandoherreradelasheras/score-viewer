import { TimeMapEvent } from "../types";

export type NoteTiming = {
    /** Position in the timemap at which the note starts sounding. */
    onsetMs: number;
    /** Sounding length in milliseconds, for animation timing. */
    durationMs: number;
    /** Sounding length in quarter notes, for tempo-independent visual sizing. */
    durationQuarters: number;
};

/**
 * Pair every `on` with its later `off` to recover how long each note sounds, once
 * for every time it is played: a synced recording may play it again in a repeat.
 * Notes left without an `off` (the timemap is truncated, or the score ends on
 * them) are simply absent from the result.
 */
export const buildNoteTimings = (timemap: TimeMapEvent[]): Map<string, NoteTiming[]> => {
    const timings = new Map<string, NoteTiming[]>();
    const pending = new Map<string, { tstamp: number; qstamp: number }>();

    for (const event of timemap) {
        event.on?.forEach(id => pending.set(id, { tstamp: event.tstamp, qstamp: event.qstamp }));
        event.off?.forEach(id => {
            const start = pending.get(id);
            if (start == null) {
                return;
            }
            pending.delete(id);
            timings.set(id, [...timings.get(id) ?? [], {
                onsetMs: start.tstamp,
                durationMs: event.tstamp - start.tstamp,
                durationQuarters: event.qstamp - start.qstamp,
            }]);
        });
    }

    return timings;
};

// The time a note is played that is under way, or last was, at `position`.
export const noteTimingAt = (timings: NoteTiming[] | undefined, position: number): NoteTiming | undefined =>
    timings?.filter(timing => timing.onsetMs <= position).pop() ?? timings?.[0];

export type ElementInterval = { onsetMs: number; endMs: number };

/** When each note and rest starts and stops sounding, every time it does. */
export const buildElementIntervals = (timemap: TimeMapEvent[]): Map<string, ElementInterval[]> => {
    const intervals = new Map<string, ElementInterval[]>();

    for (const event of timemap) {
        [...event.on ?? [], ...event.restsOn ?? []]
            .forEach(id => intervals.set(id, [...intervals.get(id) ?? [], { onsetMs: event.tstamp, endMs: Infinity }]));
        [...event.off ?? [], ...event.restsOff ?? []].forEach(id => {
            const interval = intervals.get(id)?.slice(-1)[0];
            if (interval != null && interval.endMs == Infinity) {
                interval.endMs = event.tstamp;
            }
        });
    }

    return intervals;
};
