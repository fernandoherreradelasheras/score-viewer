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

export interface AudioTrack {
    id: string;
    label: string;
    url: string;
    volume?: number | undefined; // Default volume (0-1)
}



