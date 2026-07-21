import { TimeMapEvent } from "../types";

export type NoteTiming = {
    /** Sounding length in milliseconds, for animation timing. */
    durationMs: number;
    /** Sounding length in quarter notes, for tempo-independent visual sizing. */
    durationQuarters: number;
};

/**
 * Pair every `on` with its later `off` to recover how long each note sounds.
 * Notes left without an `off` (the timemap is truncated, or the score ends on
 * them) are simply absent from the result.
 */
export const buildNoteTimings = (timemap: TimeMapEvent[]): Map<string, NoteTiming> => {
    const timings = new Map<string, NoteTiming>();
    const pending = new Map<string, { tstamp: number; qstamp: number }>();

    for (const event of timemap) {
        event.on?.forEach(id => pending.set(id, { tstamp: event.tstamp, qstamp: event.qstamp }));
        event.off?.forEach(id => {
            const start = pending.get(id);
            if (start == null) {
                return;
            }
            pending.delete(id);
            timings.set(id, {
                durationMs: event.tstamp - start.tstamp,
                durationQuarters: event.qstamp - start.qstamp,
            });
        });
    }

    return timings;
};
