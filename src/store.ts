import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSelectors } from './utils/zustand-utils'

import {
    DEFAULT_SCALE,
    MIN_SCALE,
    MAX_SCALE,
    Action,
    Score,
    PlayingState,
    TextPartsCache,
    LyricItem,
    FetchError,
} from './types'

import { RenderedData } from './hooks/useScoreRenderer'


interface RenderingState {
    pendingAction: Action | null
    queuedAction: Action | null
    setPendingAction: (action: Action | null) => void
    setQueuedAction: (action: Action | null) => void
}

const createRenderingStore = create<RenderingState>((set) => ({
    pendingAction: null,
    queuedAction: null,
    setPendingAction: (action: Action | null) => set(() => ({ pendingAction: action })),
    setQueuedAction: (action: Action | null) => set(() => ({ queuedAction: action })),
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
    setTextCache: (textCache: TextPartsCache, replace: boolean) => void
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
    setTextIntroduction: (textIntroduction: string | FetchError | null | undefined) => set(() => ({ textIntroduction })),
    setTextLyrics: (textLyrics: LyricItem[] | null | undefined, replace: boolean) => set((state) => ({
        textLyrics: replace ? textLyrics : [...state.textLyrics || [], ...(textLyrics || [])]
    }))
}))


interface ScoreNavigationState {
    pageCount: number
    currentPage: number

    sectionPageMap: Record<string, number>

    setScoreLayout: (layout: { pageCount: number, sectionPageMap: Record<string, number>, currentPage: number }) => void

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
    sectionPageMap: {},

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
    isSplitView: boolean
    activeSplitView: string
    splitViewOrientation: 'horizontal' | 'vertical'
    activeTab: string


    setIsLoading: (isLoading: boolean) => void
    setScoreSvg: (svg: string | null) => void
    setScale: (scale: number) => void
    increaseScale: () => void
    decreaseScale: () => void
    setReachedEffectiveMaxScale: (value: boolean) => void
    setIsSplitView: (splitView: boolean) => void
    setActiveSplitView: (view: string) => void
    setSplitViewOrientation: (orientation: 'horizontal' | 'vertical') => void
    setActiveTab: (tab: string) => void
    reset: () => void
}

const DEFAULT_UI_LAYOUT_STATE = {
    isSplitView: false,
    activeSplitView: 'facsimile',
    splitViewOrientation: 'horizontal' as const,
    activeTab: 'music',
}


const createUILayoutStore = create<UILayoutState>()(persist((set) => ({
    isLoading: true,
    scoreSvg: null,
    scale: DEFAULT_SCALE,
    reachedEffectiveMaxScale: false,
    ...DEFAULT_UI_LAYOUT_STATE,


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
    setIsSplitView: (splitView: boolean) => set(() => ({ isSplitView: splitView })),
    setActiveSplitView: (view: string) => set(() => ({ activeSplitView: view })),
    setSplitViewOrientation: (orientation: 'horizontal' | 'vertical') => set(() => ({ splitViewOrientation: orientation })),
    setActiveTab: (tab: string) => set(() => ({ activeTab: tab })),
    reset: () => set(DEFAULT_UI_LAYOUT_STATE),
}), {
    name: 'ui-layout-store',
    partialize: (state) => ({
        isSplitView: state.isSplitView,
        activeSplitView: state.activeSplitView,
        splitViewOrientation: state.splitViewOrientation,
        activeTab: state.activeTab,
    }),
}))


interface PlayerState {
    playingState: PlayingState
    playingPosition: number
    seekPosition: number
    autoScroll: boolean

    setPlayingState: (state: PlayingState) => void
    setPlayingPosition: (position: number) => void
    setSeekPosition: (position: number) => void
    setAutoScroll: (autoScroll: boolean) => void
    resetPlayerPosition: () => void
}

const createPlayerStore = create<PlayerState>((set) => ({
    playingState: PlayingState.STOPPED,
    playingPosition: 0,
    seekPosition: -1,
    autoScroll: false,

    setPlayingState: (playingState: PlayingState) => set(() => ({ playingState: playingState })),
    setPlayingPosition: (position: number) => set(() => ({ playingPosition: position })),
    setSeekPosition: (position: number) => set(() => ({ seekPosition: position })),
    setAutoScroll: (autoScroll: boolean) => set(() => ({ autoScroll: autoScroll })),
    resetPlayerPosition: () => set(() => ({
        playingPosition: 0,
        seekPosition: 0,
    })),
}))


interface ScoreSettings {
    showNVerses: number
    showEditorial: boolean
    showOriginalClefs: boolean
    normalizeFicta: boolean
    showingEditorial: string | null
    appOptions: string[]
    choiceOptions: string[]
    withoutTransposition: boolean
    showMusicAnalysis: boolean
    measureNumberInterval: number

    setShowNVerses: (n: number) => void
    setShowEditorial: (showEditorial: boolean) => void
    setShowOriginalClefs: (showOriginalClefs: boolean) => void
    setNormalizeFicta: (normalizeFicta: boolean) => void
    setShowingEditorial: (editorial: string | null) => void
    setAppOptions: (options: string[], replace: boolean) => void
    setChoiceOptions: (options: string[], replace: boolean) => void
    setWithoutTransposition: (withoutTransposition: boolean) => void
    setShowMusicAnalysis: (showMusicAnalysis: boolean) => void
    setMeasureNumberInterval: (interval: number) => void
    resetScoreSettings: () => void
}

const DEFAULT_SCORE_SETTINGS = {
    showNVerses: 8,
    showEditorial: false,
    showOriginalClefs: false,
    normalizeFicta: false,
    showingEditorial: null,
    appOptions: [],
    choiceOptions: [],
    withoutTransposition: false,
    showMusicAnalysis: false,
    measureNumberInterval: 0,
}

const createScoreSettingsStore = create<ScoreSettings>()(persist((set) => ({
    ...DEFAULT_SCORE_SETTINGS,

    setShowNVerses: (n: number) => set(() => ({ showNVerses: n })),
    setShowEditorial: (showEditorial: boolean) => set(() => ({ showEditorial })),
    setShowOriginalClefs: (showOriginalClefs: boolean) => set(() => ({ showOriginalClefs })),
    setNormalizeFicta: (normalizeFicta: boolean) => set(() => ({ normalizeFicta })),
    setShowingEditorial: (editorial: string | null) => set(() => ({ showingEditorial: editorial })),
    setAppOptions: (options: string[], replace: boolean) => set((state) => ({
        appOptions: replace ? options : [...state.appOptions, ...options]
    })),
    setChoiceOptions: (options: string[], replace: boolean) => set((state) => ({
        choiceOptions: replace ? options : [...state.choiceOptions, ...options]
    })),
    setWithoutTransposition: (withoutTransposition: boolean) => set(() => ({ withoutTransposition })),
    setShowMusicAnalysis: (showMusicAnalysis: boolean) => set(() => ({ showMusicAnalysis })),
    setMeasureNumberInterval: (interval: number) => set(() => ({ measureNumberInterval: interval })),
    resetScoreSettings: () => set({ ...DEFAULT_SCORE_SETTINGS }),
}), {
    name: 'score-settings-store'
}))


interface RenderedSvgState {
    renderedSvgData: RenderedData | null;
    pageCache: Map<number, RenderedData>;
    setRenderedSvgData: (data: RenderedData) => void;
    setCachedPage: (page: number, data: RenderedData) => void;
    getCachedPage: (page: number) => RenderedData | null;
    clearPageCache: () => void;
}

const createRenderedSvgStore = create<RenderedSvgState>((set, get) => ({
    renderedSvgData: null,
    pageCache: new Map(),

    setRenderedSvgData: (data: RenderedData) => set(() => ({ renderedSvgData: data })),

    setCachedPage: (page: number, data: RenderedData) => {
        const cache = new Map(get().pageCache);
        const MAX_CACHE_SIZE = 3;

        // If cache is full and we're adding a new page, remove oldest
        if (cache.size >= MAX_CACHE_SIZE && !cache.has(page)) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined) {
                cache.delete(firstKey);
            }
        }

        cache.set(page, data);
        set({ pageCache: cache });
    },

    getCachedPage: (page: number) => {
        return get().pageCache.get(page) || null;
    },

    clearPageCache: () => set({ pageCache: new Map() }),
}))


class ScoreViewerStoreApi {
    public use = {
        // Rendering Store
        queuedAction: createRenderingStoreWithSelectors.use.queuedAction,
        setQueuedAction: createRenderingStoreWithSelectors.use.setQueuedAction,
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
        isSplitView: createUILayoutStoreWithSelectors.use.isSplitView,
        activeSplitView: createUILayoutStoreWithSelectors.use.activeSplitView,
        splitViewOrientation: createUILayoutStoreWithSelectors.use.splitViewOrientation,
        activeTab: createUILayoutStoreWithSelectors.use.activeTab,
        setIsLoading: createUILayoutStoreWithSelectors.use.setIsLoading,
        setScoreSvg: createUILayoutStoreWithSelectors.use.setScoreSvg,
        setScale: createUILayoutStoreWithSelectors.use.setScale,
        increaseScale: createUILayoutStoreWithSelectors.use.increaseScale,
        decreaseScale: createUILayoutStoreWithSelectors.use.decreaseScale,
        setReachedEffectiveMaxScale: createUILayoutStoreWithSelectors.use.setReachedEffectiveMaxScale,
        setIsSplitView: createUILayoutStoreWithSelectors.use.setIsSplitView,
        setSplitViewOrientation: createUILayoutStoreWithSelectors.use.setSplitViewOrientation,
        setActiveTab: createUILayoutStoreWithSelectors.use.setActiveTab,
        setActiveSplitView: createUILayoutStoreWithSelectors.use.setActiveSplitView,
        resetUILayout: createUILayoutStoreWithSelectors.use.reset,

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
        playingState: createPlayerStoreWithSelectors.use.playingState,
        playingPosition: createPlayerStoreWithSelectors.use.playingPosition,
        seekPosition: createPlayerStoreWithSelectors.use.seekPosition,
        autoScroll: createPlayerStoreWithSelectors.use.autoScroll,
        setPlayingState: createPlayerStoreWithSelectors.use.setPlayingState,
        setPlayingPosition: createPlayerStoreWithSelectors.use.setPlayingPosition,
        setSeekPosition: createPlayerStoreWithSelectors.use.setSeekPosition,
        setAutoScroll: createPlayerStoreWithSelectors.use.setAutoScroll,
        resetPlayerPosition: createPlayerStoreWithSelectors.use.resetPlayerPosition,

        // Score Settings Store
        showNVerses: createScoreSettingsStoreWithSelectors.use.showNVerses,
        showEditorial: createScoreSettingsStoreWithSelectors.use.showEditorial,
        showOriginalClefs: createScoreSettingsStoreWithSelectors.use.showOriginalClefs,
        normalizeFicta: createScoreSettingsStoreWithSelectors.use.normalizeFicta,
        showingEditorial: createScoreSettingsStoreWithSelectors.use.showingEditorial,
        appOptions: createScoreSettingsStoreWithSelectors.use.appOptions,
        choiceOptions: createScoreSettingsStoreWithSelectors.use.choiceOptions,
        withoutTransposition: createScoreSettingsStoreWithSelectors.use.withoutTransposition,
        showMusicAnalysis: createScoreSettingsStoreWithSelectors.use.showMusicAnalysis,
        measureNumberInterval: createScoreSettingsStoreWithSelectors.use.measureNumberInterval,
        setShowNVerses: createScoreSettingsStoreWithSelectors.use.setShowNVerses,
        setShowEditorial: createScoreSettingsStoreWithSelectors.use.setShowEditorial,
        setShowOriginalClefs: createScoreSettingsStoreWithSelectors.use.setShowOriginalClefs,
        setNormalizeFicta: createScoreSettingsStoreWithSelectors.use.setNormalizeFicta,
        setShowingEditorial: createScoreSettingsStoreWithSelectors.use.setShowingEditorial,
        setAppOptions: createScoreSettingsStoreWithSelectors.use.setAppOptions,
        setChoiceOptions: createScoreSettingsStoreWithSelectors.use.setChoiceOptions,
        setWithoutTransposition: createScoreSettingsStoreWithSelectors.use.setWithoutTransposition,
        setShowMusicAnalysis: createScoreSettingsStoreWithSelectors.use.setShowMusicAnalysis,
        setMeasureNumberInterval: createScoreSettingsStoreWithSelectors.use.setMeasureNumberInterval,
        resetScoreSettings: createScoreSettingsStoreWithSelectors.use.resetScoreSettings,


        // Rendered SVG Store
        renderedSvgData: createRenderedSvgStoreWithSelectors.use.renderedSvgData,
        setRenderedSvgData: createRenderedSvgStoreWithSelectors.use.setRenderedSvgData,
        pageCache: createRenderedSvgStoreWithSelectors.use.pageCache,
        setCachedPage: createRenderedSvgStoreWithSelectors.use.setCachedPage,
        getCachedPage: createRenderedSvgStoreWithSelectors.use.getCachedPage,
        clearPageCache: createRenderedSvgStoreWithSelectors.use.clearPageCache,
    }
}

const createRenderingStoreWithSelectors = createSelectors(createRenderingStore);
const createScoreManagementStoreWithSelectors = createSelectors(createScoreManagementStore);
const createScoreViewerStoreWithSelectors = createSelectors(createScoreViewerStore);

const createUILayoutStoreWithSelectors = createSelectors(createUILayoutStore);
const createPlayerStoreWithSelectors = createSelectors(createPlayerStore);
const createScoreSettingsStoreWithSelectors = createSelectors(createScoreSettingsStore);
const createRenderedSvgStoreWithSelectors = createSelectors(createRenderedSvgStore);

const useStore = new ScoreViewerStoreApi();

export default useStore;
