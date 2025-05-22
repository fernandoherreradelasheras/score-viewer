import { create } from 'zustand'
import { createSelectors } from './utils/zustand-utils'


import {
    DEFAULT_SCALE,
    MIN_SCALE,
    MAX_SCALE,
    Action,
    Score,
    PlayingState,
    AudioTrack,
} from './types'
import { RenderedData } from './hooks/useScoreRenderer'



interface RenderingState {
    pendingAction: Action | null
    setPendingAction: (action: Action | null) => void
}

const createRenderingStore = create<RenderingState>((set) => ({
    pendingAction: null,
    setPendingAction: (action: Action | null) => set(() => ({ pendingAction: action })),
}))


interface ScoreManagementState {
    currentScoreIdx: number | null
    score: Score | null
    showingMei: string | null
    scoreCache: { [index: string]: Score }

    setCurrentScoreIdx: (idx: number | null) => void
    setScore: (score: Score | null) => void
    setShowingMei: (mei: string | null) => void
    setScoreCache: (scoreCache: { [index: string]: Score }) => void
}

const createScoreManagementStore = create<ScoreManagementState>((set) => ({
    currentScoreIdx: null,
    score: null,
    showingMei: null,
    scoreCache: {},

    setCurrentScoreIdx: (idx: number | null) => set(() => ({ currentScoreIdx: idx })),
    setScore: (score: Score | null) => set(() => ({ score: score })),
    setShowingMei: (mei: string | null) => set(() => ({ showingMei: mei })),
    setScoreCache: (scoreCache: { [index: string]: Score }) => set((state) => ({
        scoreCache: { ...state.scoreCache, ...scoreCache }
    })),
}))


interface UILayoutState {
    isLoading: boolean
    scoreSvg: string | null
    scale: number
    reachedEffectiveMaxScale: boolean
    pageCount: number
    currentPage: number

    setIsLoading: (isLoading: boolean) => void
    setScoreSvg: (svg: string | null) => void
    setScale: (scale: number) => void
    increaseScale: () => void
    decreaseScale: () => void
    setReachedEffectiveMaxScale: (value: boolean) => void
    setPageCount: (count: number) => void
    setCurrentPage: (page: number) => void
}

const createUILayoutStore = create<UILayoutState>((set) => ({
    isLoading: true,
    scoreSvg: null,
    scale: DEFAULT_SCALE,
    reachedEffectiveMaxScale: false,
    pageCount: 0,
    currentPage: 1,

    setIsLoading: (isLoading: boolean) => set(() => ({ isLoading })),
    setScoreSvg: (svg: string | null) => set(() => ({ scoreSvg: svg })),
    setScale: (scale: number) => set((state) => ({
        scale: scale <= MAX_SCALE && scale >= MIN_SCALE ? scale : state.scale,
    })),
    increaseScale: () => set((state) => ({
        scale: Math.min(state.scale + 10, MAX_SCALE),
    })),
    decreaseScale: () => set((state) => ({
        scale: Math.max(state.scale - 10, MIN_SCALE),
    })),
    setReachedEffectiveMaxScale: (value: boolean) => set(() => ({ reachedEffectiveMaxScale: value })),
    setPageCount: (count: number) => set(() => ({ pageCount: count })),
    setCurrentPage: (page: number) => set(() => ({ currentPage: page })),
}))


interface PlayerState {
    audioUrl: string | null
    audioOverlayTracks: AudioTrack[]
    playingState: PlayingState
    playingPosition: number
    seekPosition: number
    autoScroll: boolean

    setAudioUrl: (audioUrl: string | null) => void
    setAudioOverlayTracks: (tracks: AudioTrack[]) => void
    setPlayingState: (state: PlayingState) => void
    setPlayingPosition: (position: number) => void
    setSeekPosition: (position: number) => void
    setAutoScroll: (autoScroll: boolean) => void
    resetPlayerPosition: () => void
}

const createPlayerStore = create<PlayerState>((set) => ({
    audioUrl: null,
    audioOverlayTracks:[],
    playingState: PlayingState.STOPPED,
    playingPosition: 0,
    seekPosition: -1,
    autoScroll: false,

    setAudioUrl: (audioUrl: string | null) => set(() => ({ audioUrl })),
    setAudioOverlayTracks: (audioOverlayTracks: AudioTrack[]) => set(() => ({ audioOverlayTracks })),
    setPlayingState: (playingState: PlayingState) => set(() => ({ playingState: playingState })),
    setPlayingPosition: (position: number) => set(() => ({ playingPosition: position })),
    setSeekPosition: (position: number) => set(() => ({ seekPosition: position })),
    setAutoScroll: (autoScroll: boolean) => set(() => ({ autoScroll: autoScroll })),
    resetPlayerPosition: () => set(() => ({
        playingPosition: 0,
        seekPosition: 0,
    })),
}))


interface EditorialState {
    showNVerses: number | null
    showReconstructions: { [staff: string]: string }
    showEditorial: boolean | null
    showOriginalClefs: boolean | null
    normalizeFicta: boolean | null
    showingEditorial: string | null
    appOptions: string[]
    choiceOptions: string[]
    section: string | null
    transposition: string | null

    setShowNVerses: (n: number | null) => void
    setShowReconstructions: (reconstructions: { [staff: string]: string }, replace: boolean) => void
    setShowEditorial: (showEditorial: boolean) => void
    setShowOriginalClefs: (showOriginalClefs: boolean | null) => void
    setNormalizeFicta: (normalizeFicta: boolean | null) => void
    setShowingEditorial: (editorial: string | null) => void
    setAppOptions: (options: string[], replace: boolean) => void
    setChoiceOptions: (options: string[], replace: boolean) => void
    setSection: (section: string | null) => void
    setTransposition: (transposition: string | null) => void
}

const createEditorialStore = create<EditorialState>((set) => ({
    showNVerses: null,
    showReconstructions: {},
    showEditorial: false,
    showOriginalClefs: null,
    normalizeFicta: null,
    showingEditorial: null,
    appOptions: [],
    choiceOptions: [],
    section: null,
    transposition: null,

    setShowNVerses: (n: number | null) => set(() => ({ showNVerses: n })),
    setShowReconstructions: (reconstructions: { [staff: string]: string }, replace: boolean) => set((state) => ({
        showReconstructions: replace ? reconstructions : { ...state.showReconstructions, ...reconstructions }
     })),
    setShowEditorial: (showEditorial: boolean) => set(() => ({ showEditorial })),
    setShowOriginalClefs: (showOriginalClefs: boolean | null) => set(() => ({ showOriginalClefs })),
    setNormalizeFicta: (normalizeFicta: boolean | null) => set(() => ({ normalizeFicta })),
    setShowingEditorial: (editorial: string | null) => set(() => ({ showingEditorial: editorial })),
    setAppOptions: (options: string[], replace: boolean) => set((state) => ({
        appOptions: replace ? options : [...state.appOptions, ...options]
    })),
    setChoiceOptions: (options: string[], replace: boolean) => set((state) => ({
        choiceOptions: replace ? options : [...state.choiceOptions, ...options]
    })),
    setSection: (section: string | null) => set(() => ({ section })),
    setTransposition: (transposition: string | null) => set(() => ({ transposition })),
}))


interface RenderedSvgState {
    renderedSvgData: RenderedData | null;
    setRenderedSvgData: (data: RenderedData) => void;
}

const createRenderedSvgStore = create<RenderedSvgState>((set) => ({
    renderedSvgData: null,
    setRenderedSvgData: (data: RenderedData) => set(() => ({ renderedSvgData: data })),
}))


class StoreApi {
    public use = {
        // Rendering Store
        pendingAction: createRenderingStoreWithSelectors.use.pendingAction,
        setPendingAction: createRenderingStoreWithSelectors.use.setPendingAction,

        // Score Management Store
        currentScoreIdx: createScoreManagementStoreWithSelectors.use.currentScoreIdx,
        score: createScoreManagementStoreWithSelectors.use.score,
        showingMei: createScoreManagementStoreWithSelectors.use.showingMei,
        scoreCache: createScoreManagementStoreWithSelectors.use.scoreCache,
        setCurrentScoreIdx: createScoreManagementStoreWithSelectors.use.setCurrentScoreIdx,
        setScore: createScoreManagementStoreWithSelectors.use.setScore,
        setShowingMei: createScoreManagementStoreWithSelectors.use.setShowingMei,
        setScoreCache: createScoreManagementStoreWithSelectors.use.setScoreCache,

        // UI/Layout Store
        isLoading: createUILayoutStoreWithSelectors.use.isLoading,
        scoreSvg: createUILayoutStoreWithSelectors.use.scoreSvg,
        scale: createUILayoutStoreWithSelectors.use.scale,
        reachedEffectiveMaxScale: createUILayoutStoreWithSelectors.use.reachedEffectiveMaxScale,
        pageCount: createUILayoutStoreWithSelectors.use.pageCount,
        currentPage: createUILayoutStoreWithSelectors.use.currentPage,
        setIsLoading: createUILayoutStoreWithSelectors.use.setIsLoading,
        setScoreSvg: createUILayoutStoreWithSelectors.use.setScoreSvg,
        setScale: createUILayoutStoreWithSelectors.use.setScale,
        increaseScale: createUILayoutStoreWithSelectors.use.increaseScale,
        decreaseScale: createUILayoutStoreWithSelectors.use.decreaseScale,
        setReachedEffectiveMaxScale: createUILayoutStoreWithSelectors.use.setReachedEffectiveMaxScale,
        setPageCount: createUILayoutStoreWithSelectors.use.setPageCount,
        setCurrentPage: createUILayoutStoreWithSelectors.use.setCurrentPage,

        // Player Store
        audioUrl: createPlayerStoreWithSelectors.use.audioUrl,
        audioOverlayTracks: createPlayerStoreWithSelectors.use.audioOverlayTracks,
        playingState: createPlayerStoreWithSelectors.use.playingState,
        playingPosition: createPlayerStoreWithSelectors.use.playingPosition,
        seekPosition: createPlayerStoreWithSelectors.use.seekPosition,
        autoScroll: createPlayerStoreWithSelectors.use.autoScroll,
        setAudioUrl: createPlayerStoreWithSelectors.use.setAudioUrl,
        setAudioOverlayTracks: createPlayerStoreWithSelectors.use.setAudioOverlayTracks,
        setPlayingState: createPlayerStoreWithSelectors.use.setPlayingState,
        setPlayingPosition: createPlayerStoreWithSelectors.use.setPlayingPosition,
        setSeekPosition: createPlayerStoreWithSelectors.use.setSeekPosition,
        setAutoScroll: createPlayerStoreWithSelectors.use.setAutoScroll,
        resetPlayerPosition: createPlayerStoreWithSelectors.use.resetPlayerPosition,

        // Editorial Store
        showNVerses: createEditorialStoreWithSelectors.use.showNVerses,
        showReconstructions: createEditorialStoreWithSelectors.use.showReconstructions,
        showEditorial: createEditorialStoreWithSelectors.use.showEditorial,
        showOriginalClefs: createEditorialStoreWithSelectors.use.showOriginalClefs,
        normalizeFicta: createEditorialStoreWithSelectors.use.normalizeFicta,
        showingEditorial: createEditorialStoreWithSelectors.use.showingEditorial,
        appOptions: createEditorialStoreWithSelectors.use.appOptions,
        choiceOptions: createEditorialStoreWithSelectors.use.choiceOptions,
        section: createEditorialStoreWithSelectors.use.section,
        transposition: createEditorialStoreWithSelectors.use.transposition,
        setShowNVerses: createEditorialStoreWithSelectors.use.setShowNVerses,
        setShowReconstructions: createEditorialStoreWithSelectors.use.setShowReconstructions,
        setShowEditorial: createEditorialStoreWithSelectors.use.setShowEditorial,
        setShowOriginalClefs: createEditorialStoreWithSelectors.use.setShowOriginalClefs,
        setNormalizeFicta: createEditorialStoreWithSelectors.use.setNormalizeFicta,
        setShowingEditorial: createEditorialStoreWithSelectors.use.setShowingEditorial,
        setAppOptions: createEditorialStoreWithSelectors.use.setAppOptions,
        setChoiceOptions: createEditorialStoreWithSelectors.use.setChoiceOptions,
        setSection: createEditorialStoreWithSelectors.use.setSection,
        setTransposition: createEditorialStoreWithSelectors.use.setTransposition,

        // Rendered SVG Store
        renderedSvgData: createRenderedSvgStoreWithSelectors.use.renderedSvgData,
        setRenderedSvgData: createRenderedSvgStoreWithSelectors.use.setRenderedSvgData,
    }
}

const createRenderingStoreWithSelectors = createSelectors(createRenderingStore);
const createScoreManagementStoreWithSelectors = createSelectors(createScoreManagementStore);
const createUILayoutStoreWithSelectors = createSelectors(createUILayoutStore);
const createPlayerStoreWithSelectors = createSelectors(createPlayerStore);
const createEditorialStoreWithSelectors = createSelectors(createEditorialStore);
const createRenderedSvgStoreWithSelectors = createSelectors(createRenderedSvgStore);

const useStore = new StoreApi();

export default useStore;

