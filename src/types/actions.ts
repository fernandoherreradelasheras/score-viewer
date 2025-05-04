// Action-related types
import { Transition } from './ui';

export type LoadConfig = {
    postLoadTransition?: Transition
    meiStr: string
    page?: number
    scale: number
    restorePositionForAchor? : string
}

export type LoadAutoScrollConfig = {
    height: number
    meiStr: string
}

export type RenderConfig = {
    loadedWidth: number
    loadedHeight: number
    transition?: Transition
    renderPage: number
    loadedPagesCount: number
    scale: number
}

export type RenderAutoScrollConfig = {
    height: number
}

export type Action = {
    type: string
    config: LoadConfig | LoadAutoScrollConfig | RenderConfig | RenderAutoScrollConfig
}

export const loadAction = (config: LoadConfig): Action => ({type: "load", config})
export const loadAutoScrollAction = (config: LoadAutoScrollConfig): Action => ({type: "loadAutoScroll", config})
export const renderAction = (config: RenderConfig): Action => ({type: "render", config})
export const renderAutoScrollAction = (config: RenderAutoScrollConfig): Action => ({type: "renderAutoScroll", config})