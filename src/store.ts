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
    TextPartsCache,
    LyricItem,
    FetchError,
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
    score: Score | null
    showingMei: string | null
    scoreCache: { [index: string]: Score }
    textCache: TextPartsCache
    textComments: string | FetchError | null | undefined
    textIntroduction: string | FetchError | null | undefined
    textLyrics: LyricItem[] | null | undefined

    setScore: (score: Score | null) => void

    setShowingMei: (mei: string | null) => void
    setScoreCache: (scoreCache: { [index: string]: Score }) => void
    setTextCache: (textCache: TextPartsCache, replace:boolean ) => void
    setTextComments: (textComments: string | FetchError | null | undefined) => void
    setTextIntroduction: (textIntroduction: string | FetchError | null | undefined) => void
    setTextLyrics: (textLyrics: LyricItem[] | null | undefined, replace: boolean) => void
}

const createScoreManagementStore = create<ScoreManagementState>((set) => ({
    score: null,
    showingMei: null,
    scoreCache: {},
    textCache: {},
    textComments: undefined,
    textIntroduction: undefined,
    textLyrics: undefined,

    setScore: (score: Score | null) => set(() => ({ score: score })),

    setShowingMei: (mei: string | null) => set(() => ({ showingMei: mei })),
    setScoreCache: (scoreCache: { [index: string]: Score }) => set((state) => ({
        scoreCache: { ...state.scoreCache, ...scoreCache }
    })),
    setTextCache: (textCache: TextPartsCache, replace: boolean) => set((state) => ({
        textCache: replace ? textCache : { ...state.textCache, ...textCache }
    })),
    setTextComments: (textComments: string | FetchError | null | undefined) => set(() => ({ textComments })),
    setTextIntroduction: (textIntroduction: string | FetchError |null | undefined) => set(() => ({ textIntroduction })),
    setTextLyrics: (textLyrics: LyricItem[] | null | undefined, replace: boolean) => set((state) => ({
        textLyrics: replace ? textLyrics : [...state.textLyrics || [],  ...(textLyrics || [])]}))
}))


interface ScoreNavigationState {
    pageCount: number
    currentPage: number

    sectionPageMap: Record<string, number>

    setScoreLayout : (layout: { pageCount: number, sectionPageMap: Record<string, number>, currentPage: number }) => void

    goToPage: (page: number) => void
    goToNextPage: () => void
    goToPreviousPage: () => void

    goToSection: (sectionId: string) => void
    navigationCommand: { type: 'section' | 'page', target: string | number } | null

    clearNavigationCommand: () => void
}

export const createScoreViewerStore = create<ScoreNavigationState>((set, get) => ({
  pageCount: 0,
  currentPage: 1,
  sectionPageMap: { },

  setScoreLayout: ({ pageCount, sectionPageMap, currentPage }) => {
    set({
      pageCount,
      sectionPageMap,
      currentPage,
      navigationCommand: null
    });
  },

  goToPage: (page) => set({
    currentPage: Math.max(1, Math.min(page, get().pageCount))
  }),
  goToNextPage: () => get().goToPage(get().currentPage + 1),
  goToPreviousPage: () => get().goToPage(get().currentPage - 1),

  goToSection: (sectionId) => {
    const page = get().sectionPageMap[sectionId];
    if (page) {
      set({
        navigationCommand: { type: 'section', target: sectionId },
        currentPage: page
      });
    }
  },

  navigationCommand: null,

  clearNavigationCommand: () => set({ navigationCommand: null }),
}));


interface UILayoutState {
    isLoading: boolean
    scoreSvg: string | null
    scale: number
    reachedEffectiveMaxScale: boolean
    splitView: boolean
    splitViewOrientation: 'horizontal' | 'vertical'


    setIsLoading: (isLoading: boolean) => void
    setScoreSvg: (svg: string | null) => void
    setScale: (scale: number) => void
    increaseScale: () => void
    decreaseScale: () => void
    setReachedEffectiveMaxScale: (value: boolean) => void
    setSplitView: (splitView: boolean) => void
    setSplitViewOrientation: (orientation: 'horizontal' | 'vertical') => void
}

const createUILayoutStore = create<UILayoutState>((set) => ({
    isLoading: true,
    scoreSvg: null,
    scale: DEFAULT_SCALE,
    reachedEffectiveMaxScale: false,
    splitView: false,
    splitViewOrientation: 'horizontal',


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
    setSplitView: (splitView: boolean) => set(() => ({ splitView })),
    setSplitViewOrientation: (orientation: 'horizontal' | 'vertical') => set(() => ({ splitViewOrientation: orientation })),
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
    transposition: string | null
    showMusicAnalysis: boolean

    setShowNVerses: (n: number | null) => void
    setShowReconstructions: (reconstructions: { [staff: string]: string }, replace: boolean) => void
    setShowEditorial: (showEditorial: boolean) => void
    setShowOriginalClefs: (showOriginalClefs: boolean | null) => void
    setNormalizeFicta: (normalizeFicta: boolean | null) => void
    setShowingEditorial: (editorial: string | null) => void
    setAppOptions: (options: string[], replace: boolean) => void
    setChoiceOptions: (options: string[], replace: boolean) => void
    setTransposition: (transposition: string | null) => void
    setShowMusicAnalysis: (showMusicAnalysis: boolean) => void
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
    transposition: null,
    showMusicAnalysis: false,

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
    setTransposition: (transposition: string | null) => set(() => ({ transposition })),
    setShowMusicAnalysis: (showMusicAnalysis: boolean) => set(() => ({ showMusicAnalysis })),
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
        score: createScoreManagementStoreWithSelectors.use.score,
        showingMei: createScoreManagementStoreWithSelectors.use.showingMei,
        scoreCache: createScoreManagementStoreWithSelectors.use.scoreCache,
        textCache: createScoreManagementStoreWithSelectors.use.textCache,
        textComments: createScoreManagementStoreWithSelectors.use.textComments,
        textIntroduction: createScoreManagementStoreWithSelectors.use.textIntroduction,
        textLyrics: createScoreManagementStoreWithSelectors.use.textLyrics,
        setScore: createScoreManagementStoreWithSelectors.use.setScore,
        setShowingMei: createScoreManagementStoreWithSelectors.use.setShowingMei,
        setScoreCache: createScoreManagementStoreWithSelectors.use.setScoreCache,
        setTextCache: createScoreManagementStoreWithSelectors.use.setTextCache,
        setTextComments: createScoreManagementStoreWithSelectors.use.setTextComments,
        setTextIntroduction: createScoreManagementStoreWithSelectors.use.setTextIntroduction,
        setTextLyrics: createScoreManagementStoreWithSelectors.use.setTextLyrics,


        // UI/Layout Store
        isLoading: createUILayoutStoreWithSelectors.use.isLoading,
        scoreSvg: createUILayoutStoreWithSelectors.use.scoreSvg,
        scale: createUILayoutStoreWithSelectors.use.scale,
        reachedEffectiveMaxScale: createUILayoutStoreWithSelectors.use.reachedEffectiveMaxScale,
        splitView: createUILayoutStoreWithSelectors.use.splitView,
        splitViewOrientation: createUILayoutStoreWithSelectors.use.splitViewOrientation,
        setIsLoading: createUILayoutStoreWithSelectors.use.setIsLoading,
        setScoreSvg: createUILayoutStoreWithSelectors.use.setScoreSvg,
        setScale: createUILayoutStoreWithSelectors.use.setScale,
        increaseScale: createUILayoutStoreWithSelectors.use.increaseScale,
        decreaseScale: createUILayoutStoreWithSelectors.use.decreaseScale,
        setReachedEffectiveMaxScale: createUILayoutStoreWithSelectors.use.setReachedEffectiveMaxScale,
        setSplitView: createUILayoutStoreWithSelectors.use.setSplitView,
        setSplitViewOrientation: createUILayoutStoreWithSelectors.use.setSplitViewOrientation,

        // Score Navigation Store
        pageCount: createScoreViewerStoreWithSelectors.use.pageCount,
        currentPage: createScoreViewerStoreWithSelectors.use.currentPage,
        sectionPageMap: createScoreViewerStoreWithSelectors.use.sectionPageMap,
        setScoreLayout: createScoreViewerStoreWithSelectors.use.setScoreLayout,
        goToPage: createScoreViewerStoreWithSelectors.use.goToPage,
        goToNextPage: createScoreViewerStoreWithSelectors.use.goToNextPage,
        goToPreviousPage: createScoreViewerStoreWithSelectors.use.goToPreviousPage,
        goToSection: createScoreViewerStoreWithSelectors.use.goToSection,
        navigationCommand: createScoreViewerStoreWithSelectors.use.navigationCommand,
        clearNavigationCommand: createScoreViewerStoreWithSelectors.use.clearNavigationCommand,


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
        transposition: createEditorialStoreWithSelectors.use.transposition,
        showMusicAnalysis: createEditorialStoreWithSelectors.use.showMusicAnalysis,
        setShowNVerses: createEditorialStoreWithSelectors.use.setShowNVerses,
        setShowReconstructions: createEditorialStoreWithSelectors.use.setShowReconstructions,
        setShowEditorial: createEditorialStoreWithSelectors.use.setShowEditorial,
        setShowOriginalClefs: createEditorialStoreWithSelectors.use.setShowOriginalClefs,
        setNormalizeFicta: createEditorialStoreWithSelectors.use.setNormalizeFicta,
        setShowingEditorial: createEditorialStoreWithSelectors.use.setShowingEditorial,
        setAppOptions: createEditorialStoreWithSelectors.use.setAppOptions,
        setChoiceOptions: createEditorialStoreWithSelectors.use.setChoiceOptions,
        setTransposition: createEditorialStoreWithSelectors.use.setTransposition,
        setShowMusicAnalysis: createEditorialStoreWithSelectors.use.setShowMusicAnalysis,


        // Rendered SVG Store
        renderedSvgData: createRenderedSvgStoreWithSelectors.use.renderedSvgData,
        setRenderedSvgData: createRenderedSvgStoreWithSelectors.use.setRenderedSvgData,
    }
}

const createRenderingStoreWithSelectors = createSelectors(createRenderingStore);
const createScoreManagementStoreWithSelectors = createSelectors(createScoreManagementStore);
const createScoreViewerStoreWithSelectors = createSelectors(createScoreViewerStore);

const createUILayoutStoreWithSelectors = createSelectors(createUILayoutStore);
const createPlayerStoreWithSelectors = createSelectors(createPlayerStore);
const createEditorialStoreWithSelectors = createSelectors(createEditorialStore);
const createRenderedSvgStoreWithSelectors = createSelectors(createRenderedSvgStore);

const useStore = new StoreApi();

export default useStore;

