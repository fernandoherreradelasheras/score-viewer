import { AudioSync, AudioSyncAnchor, TimeMapEvent } from "../types";

type SyncPoint = { quarters: number; ms: number };

export const measureStarts = (timemap: TimeMapEvent[]): number[] =>
    timemap.filter(e => e.measureOn !== undefined).map(e => e.qstamp);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

export const parseAudioSync = (data: unknown): AudioSync => {
    const sync = data as AudioSync;
    if (!sync || typeof sync !== "object") {
        throw new Error("not a JSON object");
    }
    if (sync.version !== 1) {
        throw new Error(`unsupported version ${String(sync.version)}`);
    }
    if (!Array.isArray(sync.anchors) || sync.anchors.length < 2) {
        throw new Error("anchors must be an array of at least two anchors");
    }
    sync.anchors.forEach((anchor: AudioSyncAnchor, i) => {
        if (!isFiniteNumber(anchor?.time) || anchor.time < 0) {
            throw new Error(`anchors[${i}].time must be a number of seconds`);
        }
        if (!Number.isInteger(anchor.measure) || anchor.measure < 0) {
            throw new Error(`anchors[${i}].measure must be a measure position (0 is the first)`);
        }
        if (anchor.offset !== undefined && (!isFiniteNumber(anchor.offset) || anchor.offset < 0)) {
            throw new Error(`anchors[${i}].offset must be a number of quarters`);
        }
        if (i > 0 && anchor.time < sync.anchors[i - 1].time) {
            throw new Error(`anchors must be sorted by time (anchors[${i}])`);
        }
    });
    if (sync.end !== undefined && !isFiniteNumber(sync.end)) {
        throw new Error("end must be a number of seconds");
    }
    if (sync.holds !== undefined && !Array.isArray(sync.holds)) {
        throw new Error("holds must be an array");
    }
    sync.holds?.forEach((hold, i) => {
        if (!Number.isInteger(hold?.measure) || hold.measure < 0 || !Number.isInteger(hold.staff) || hold.staff < 1) {
            throw new Error(`holds[${i}] must give a measure position and a staff number`);
        }
    });
    return sync;
};

export type StaffOf = (id: string) => number | undefined;

// The notes of a staff that the recording holds through the rests of a measure end where the
// next note starts, or the measure ends, and the rests are not marked.
const withHolds = (timemap: TimeMapEvent[], sync: AudioSync, staffOf: StaffOf): TimeMapEvent[] => {
    const starts = measureStarts(timemap);
    const events = timemap.map(e => ({ ...e }));
    sync.holds?.forEach(({ measure, staff }, i) => {
        if (measure >= starts.length) {
            throw new Error(`holds[${i}] points at measure ${measure}, but the score has ${starts.length}`);
        }
        const from = starts[measure];
        const to = starts[measure + 1] ?? events[events.length - 1].qstamp;
        const onStaff = (ids: string[] | undefined) => (ids ?? []).filter(id => staffOf(id) === staff);
        let held: string[] = [];
        events.forEach(e => {
            if (e.qstamp < from || e.qstamp > to) {
                return;
            }
            const starting = onStaff(e.on);
            if (held.length > 0 && (starting.length > 0 || e.qstamp === to)) {
                e.off = [...e.off ?? [], ...held];
                held = [];
            }
            if (e.qstamp === to) {
                return;
            }
            if (onStaff(e.restsOn).length > 0 && starting.length === 0) {
                const ending = onStaff(e.off);
                e.off = (e.off ?? []).filter(id => !ending.includes(id));
                held.push(...ending);
            }
            e.restsOn = (e.restsOn ?? []).filter(id => staffOf(id) !== staff);
            e.restsOff = (e.restsOff ?? []).filter(id => staffOf(id) !== staff);
        });
    });
    return events;
};

// Piecewise linear through (xs, ys), carried on past both ends with the slope of the
// segment nearest to them. `xs` must not decrease. Where it stands still, as two anchors on
// the same point of the score do around a pause, that point takes the later value.
const interpolate = (xs: number[], ys: number[], x: number): number => {
    if (xs.length < 2) {
        return xs.length === 0 ? x : ys[0] + (x - xs[0]);
    }
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (xs[mid] <= x) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    while (lo > 0 && xs[hi] === xs[lo]) {
        lo--;
    }
    while (hi < xs.length - 1 && xs[hi] === xs[lo]) {
        hi++;
    }
    if (xs[hi] === xs[lo]) {
        return ys[lo];
    }
    return ys[lo] + (x - xs[lo]) * (ys[hi] - ys[lo]) / (xs[hi] - xs[lo]);
};

// The stretches the recording plays straight through, as the indices of their anchors. A
// new one starts where the anchors go back in the score, or move in the score without
// moving in time: a jump, back for a repeat or forward past something the recording leaves out.
export const anchorPasses = (starts: number[], sync: AudioSync): number[][] => {
    const passes: number[][] = [];
    let previous: SyncPoint | null = null;
    sync.anchors.forEach((anchor, i) => {
        if (anchor.measure >= starts.length) {
            throw new Error(`anchors[${i}] points at measure ${anchor.measure}, but the score has ${starts.length}`);
        }
        const point = { quarters: starts[anchor.measure] + (anchor.offset ?? 0), ms: anchor.time * 1000 };
        const jumps = previous == null || point.quarters < previous.quarters ||
            (point.ms === previous.ms && point.quarters !== previous.quarters);
        if (jumps) {
            passes.push([i]);
        } else {
            passes[passes.length - 1].push(i);
        }
        previous = point;
    });
    return passes;
};

const syncPasses = (timemap: TimeMapEvent[], sync: AudioSync): SyncPoint[][] => {
    const starts = measureStarts(timemap);
    return anchorPasses(starts, sync).map(pass => {
        if (pass.length === 1) {
            throw new Error(`anchors[${pass[0]}] starts a stretch with no anchor where it ends`);
        }
        return pass.map(i => ({
            quarters: starts[sync.anchors[i].measure] + (sync.anchors[i].offset ?? 0),
            ms: sync.anchors[i].time * 1000,
        }));
    });
};

const warnIfStale = (timemap: TimeMapEvent[], sync: AudioSync) => {
    if (!sync.score) {
        return;
    }
    const measures = measureStarts(timemap).length;
    const quarters = timemap[timemap.length - 1]?.qstamp ?? 0;
    if (sync.score.measures !== measures || sync.score.quarters !== quarters) {
        console.warn(`[score-viewer] The audio sync was made for a score of ${sync.score.measures} measures and ` +
            `${sync.score.quarters} quarters; this one has ${measures} and ${quarters}. Its anchors may be off.`);
    }
};

// Each stretch takes the events of the score between its first anchor and its last, so the
// notes of a repeat start again. At the end of a stretch the notes before it end, but none
// starts; the score past the last anchor is left out.
export const applyAudioSync = (score: TimeMapEvent[], sync: AudioSync, staffOf: StaffOf): TimeMapEvent[] => {
    const timemap = sync.holds?.length ? withHolds(score, sync, staffOf) : score;
    const passes = syncPasses(timemap, sync);
    warnIfStale(timemap, sync);
    const events: TimeMapEvent[] = [];
    passes.forEach((pass, p) => {
        const quarters = pass.map(point => point.quarters);
        const ms = pass.map(point => point.ms);
        const first = quarters[0];
        const last = quarters[quarters.length - 1];
        let started = false;
        timemap.forEach(e => {
            if (e.qstamp > last || (p > 0 && e.qstamp < first)) {
                return;
            }
            const tstamp = Math.max(0, interpolate(quarters, ms, e.qstamp));
            const event: TimeMapEvent = e.qstamp < last ? { ...e, tstamp } :
                { qstamp: e.qstamp, tstamp, off: e.off, restsOff: e.restsOff };
            if (p > 0 && !started) {
                event.passStart = true;
            }
            started = true;
            events.push(event);
        });
    });
    return events.sort((a, b) => a.tstamp - b.tstamp);
};

// Where playback of a synced recording stops, in ms.
export const syncEnd = (sync: AudioSync): number =>
    (sync.end ?? sync.anchors[sync.anchors.length - 1].time) * 1000;

const playbackTimemaps = new WeakMap<TimeMapEvent[], WeakMap<AudioSync, TimeMapEvent[]>>();

// The timemap on the time axis of the audio being played. Cached per timemap and sync,
// so that every consumer gets the same array and an invalid sync is reported once.
export const playbackTimemap = (timemap: TimeMapEvent[], sync: AudioSync | null | undefined,
    staffOf: StaffOf): TimeMapEvent[] => {
    if (!sync || timemap.length === 0) {
        return timemap;
    }
    let bySync = playbackTimemaps.get(timemap);
    if (!bySync) {
        bySync = new WeakMap();
        playbackTimemaps.set(timemap, bySync);
    }
    let result = bySync.get(sync);
    if (!result) {
        try {
            result = applyAudioSync(timemap, sync, staffOf);
        } catch (error) {
            console.warn(`[score-viewer] Ignoring the audio sync: ${(error as Error).message}`);
            result = timemap;
        }
        bySync.set(sync, result);
    }
    return result;
};

// When a playback timemap reaches a point of the score: the first time, if a repeat
// brings it there again.
const timeAtQuarters = (timemap: TimeMapEvent[], quarters: number): number => {
    for (let i = 0; i + 1 < timemap.length; i++) {
        const [a, b] = [timemap[i], timemap[i + 1]];
        if (!b.passStart && a.qstamp <= quarters && quarters < b.qstamp) {
            return a.tstamp + (quarters - a.qstamp) * (b.tstamp - a.tstamp) / (b.qstamp - a.qstamp);
        }
    }
    return quarters < timemap[0].qstamp ? timemap[0].tstamp : timemap[timemap.length - 1].tstamp;
};

// The same point of the score, from the time axis of one playback timemap to another's.
export const convertPosition = (from: TimeMapEvent[], to: TimeMapEvent[], ms: number): number => {
    if (from === to || from.length === 0 || to.length === 0) {
        return ms;
    }
    const quarters = interpolate(from.map(e => e.tstamp), from.map(e => e.qstamp), ms);
    return Math.max(0, timeAtQuarters(to, quarters));
};
