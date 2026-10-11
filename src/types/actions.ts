// Action-related types
import { TimeMapEvent } from './player';
import { Transition } from './ui';

// What the MIDI of a score with a `midi` audio is rendered from: the music is the
// verovio options that change it (readings, transposition), as a string.
export type MidiSource = {
    scoreUrl: string;
    meiStr: string;
    music: string;
}

export type LoadConfig = {
    scoreUrl: string;
    postLoadTransition?: Transition | undefined;
    meiStr: string;
    page?: number | undefined;
    scale: number;
    transposition: string | null;
    restorePositionForAchor?: string | undefined;
}

export type LoadAutoScrollConfig = {
    scoreUrl: string;
    height: number
    meiStr: string
    transposition: string | null;
}

export type RenderConfig = {
    scoreUrl: string;
    loadedWidth: number;
    loadedHeight: number;
    transition?: Transition | undefined;
    renderPage: number;
    loadedPagesCount: number;
    scale: number;
    timemap: TimeMapEvent[]
    midi?: MidiSource | undefined;
}

export type RenderAutoScrollConfig = {
    height: number
    timemap: TimeMapEvent[]
    midi?: MidiSource | undefined;
}

export type Action = {
    type: string
    config: LoadConfig | LoadAutoScrollConfig | RenderConfig | RenderAutoScrollConfig
}


export const loadAction = (config: LoadConfig): Action => ({ type: "load", config })
export const loadAutoScrollAction = (config: LoadAutoScrollConfig): Action => ({ type: "loadAutoScroll", config })
export const renderAction = (config: RenderConfig): Action => ({ type: "render", config })
export const renderAutoScrollAction = (config: RenderAutoScrollConfig): Action => ({ type: "renderAutoScroll", config })
