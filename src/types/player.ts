// Player-related types

export enum PlayingState {
    PLAYING,
    PAUSED,
    STOPPED,
}

export type TimeMapEvent = {
    on?: string[],
    off?: string[],
    measureOn?: string,
    qstamp: number,
    tstamp: number,
    tempo?: number,
    stavesOn?: string[],
}