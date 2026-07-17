// Player-related types

export enum PlayingState {
    PLAYING,
    PAUSED,
    STOPPED,
}

export type TimeMapEvent = {
    on?: string[] | undefined;
    off?: string[] | undefined;
    measureOn?: string | undefined;
    qstamp: number;
    tstamp: number;
    tempo?: number | undefined;
    stavesOn?: string[] | undefined;
}


