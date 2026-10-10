// Player-related types

export enum PlayingState {
    PLAYING,
    PAUSED,
    STOPPED,
}

export type TimeMapEvent = {
    on?: string[] | undefined;
    off?: string[] | undefined;
    restsOn?: string[] | undefined;
    restsOff?: string[] | undefined;
    measureOn?: string | undefined;
    qstamp: number;
    tstamp: number;
    tempo?: number | undefined;
    /** Staff number of each entry in `on`, positionally aligned with it. */
    stavesOn?: number[] | undefined;
    /** First event after a jump in a synced recording: a repeat, or a passage left out. */
    passStart?: boolean | undefined;
}


