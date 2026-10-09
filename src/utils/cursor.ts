import { TimeMapEvent } from "../types";

// The instants where something starts, notes or rests: where the cursor stops.
export type CursorStop = { tstamp: number, ids: string[] };

export const cursorStops = (timemap: TimeMapEvent[]): CursorStop[] => timemap
    .map(event => ({ tstamp: event.tstamp, ids: [...event.on ?? [], ...event.restsOn ?? []] }))
    .filter(stop => stop.ids.length > 0);

export const lastStopAt = (stops: CursorStop[], position: number) => {
    let low = 0;
    let high = stops.length - 1;
    let found = -1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        if (stops[middle].tstamp <= position) {
            found = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return found;
};
