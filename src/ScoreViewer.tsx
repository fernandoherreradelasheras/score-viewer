import './App.css'
import useStore from "./store";
import { forwardRef, Ref, useCallback, useMemo, useRef, useState } from 'react';
import useVerovio from './useVerovio';
import { Context } from './Context';
import { ConfigProvider, theme, Typography } from 'antd'
import { isMobile, useMobileOrientation } from 'react-device-detect';
import ErrorBoundary from './ErrorBoundary';
import { FacsimileItem, ScoreProperties, VisualizationOptions } from './types';
import ScoreViewContainer, { ScoreViewContainerRef } from './ScoreViewContainer';
import { DefaultOptionType } from 'antd/es/select';
import TextView from './TextView';
import FacsimileView from './FacsimileView';
import { ScoreViewerConfig } from './types/config';
import { useScoreManager } from './hooks/useScoreManager';
import { useTextParts } from './hooks/useTextParts';
import { useImperativeHandle } from 'react';
import { useConfigValidation } from './hooks/useConfigValidation';
import { useTranslation } from 'react-i18next';
import ErrorView from './ErrorView';
import ScoreOptionsPanel from './ScoreOptionsPanel';
import LayoutManager from './components/LayoutManager';
import ScoreViewerHeader from './components/ScoreViewerHeader';
import { useLayoutState } from './hooks/useLayoutState';
import { useScoreViewerEffects } from './hooks/useScoreViewerEffects';


export interface ScoreViewerProps {
  config: ScoreViewerConfig
  width: string
  height: string
  onScoreAnalyzed?: (scoreIndex: number, properties: ScoreProperties) => void
  onVisualizationOptionsChanged?: (options: VisualizationOptions) => void
}

export interface ScoreViewerRef {
  goToSection: (sectionId: string) => void
  selectScore: (scoreIndex: number | null) => void
}


type FetchError = {
  url: string
  error: Error;
}


const ScoreViewer = ({ config, width, height, onScoreAnalyzed, onVisualizationOptionsChanged }: ScoreViewerProps, ref: Ref<ScoreViewerRef>) => {
  const { t, i18n } = useTranslation("common");

  const { configErrors, hasConfigErrors } = useConfigValidation(config);

  const score = useStore.use.score()

  const showReconstructions = useStore.use.showReconstructions()
  const setAudioOverlayTracks = useStore.use.setAudioOverlayTracks()
  const normalizeFicta = useStore.use.normalizeFicta()
  const showOriginalClefs = useStore.use.showOriginalClefs()
  const splitView = useStore.use.splitView()
  const splitViewOrientation = useStore.use.splitViewOrientation()

  const playingState = useStore.use.playingState()
  const setPlayingState = useStore.use.setPlayingState()

  const goToSection = useStore.use.goToSection()

  const [fetchScoreError, setFetchScoreError] = useState<FetchError | null>(null);

  const verovio = useVerovio()
  const mobileOrientation = useMobileOrientation()

  const [facsimileItems, setFacsimileItems] = useState<FacsimileItem[]>([]);

  // Layout state management
  const {
    activeTab,
    activeSplitView,
    sizes,
    openDrawer,
    setActiveTab,
    setActiveSplitView,
    setSizes,
    onTabChange,
    onSplitViewSelectorChanged,
    showDrawer,
    onDrawerClose
  } = useLayoutState();

  const scoreViewContainerRef = useRef<ScoreViewContainerRef>(null);

  // Drawer control functions - moved to useLayoutState hook


  const onFetchScoreError = (url: string, error: Error) => {
    setFetchScoreError({ url, error });
    unloadScore()
  }

  const { fetchScore, unloadScore } = useScoreManager({ config, normalizeFicta, onScoreAnalyzed, onFetchScoreError });

  const { fetchTextParts, textIntroduction, textLyrics, textComments } = useTextParts({ config })

  const renderMainContent = (content: React.ReactNode) =>
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          fontSize: isMobile ? 12 : 16
        },
      }}>
      <Context.Provider value={{ verovio }}>
        <ErrorBoundary>
          <div className="score-viewer-top-element" style={{ width: width, height: height, overflow: overflow }}>
            <div style={{
              width: "calc(100% - 12px)",
              height: "calc(100% - 12px)",
              padding: "6px",
              display: "flex",
              flexDirection: "column"
            }}>
              {content}
            </div>
          </div>
        </ErrorBoundary>
      </Context.Provider>
    </ConfigProvider>


  if (hasConfigErrors) {
    return renderMainContent(
      <ErrorView message={t('error.configValidation')} description={
        <div>
          <p>{t('configValidation.configurationErrorDescription')}</p>
          <ul>
            {configErrors.map((error, index) => (
              <li key={index}>
                <strong>{error.field}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      } />
    )
  }

  const updateAudioOverlayTracks = useCallback((scoreIndex: number) => {
    const currentScoreItem = config.scores[scoreIndex];
    if (currentScoreItem?.audioOverlays) {
      const path = config.settings.basePath + currentScoreItem.path + "/"
      const selectedReconstructions = Object.values(showReconstructions);
      const newAudioOverlayTracks = []
      for (const overlay of currentScoreItem.audioOverlays) {
        if (selectedReconstructions.includes(overlay.appLabel)) {
          newAudioOverlayTracks.push({
            id: `overlay-staff-${overlay.staff}`,
            label: overlay.appLabel,
            url: path + overlay.file,
            volume: 1
          });
        }
      }
      setAudioOverlayTracks(newAudioOverlayTracks)
    }
  }, [config.scores, config.settings.basePath, showReconstructions, setAudioOverlayTracks]);

  const loadAll = useCallback((scoreIndex: number) => {
    setFetchScoreError(null);
    setFacsimileItems(config.scores[scoreIndex].facsimileItems || []);
    fetchScore(scoreIndex);
    fetchTextParts(scoreIndex);
    updateAudioOverlayTracks(scoreIndex);
  }, [config.scores, fetchScore, fetchTextParts, updateAudioOverlayTracks]);

  useImperativeHandle(ref, () => ({
    goToSection: (section: string) => {
      goToSection(section)
    },
    selectScore: (scoreIndex: number | null) => {
      if (scoreIndex === null) {
        unloadScore()
      } else if (scoreIndex >= 0 && scoreIndex < config.scores.length) {
        loadAll(scoreIndex);
      }
    }
  }));

  // All effects moved to useScoreViewerEffects hook
  useScoreViewerEffects({
    configLanguage: config.settings.language,
    configScoresLength: config.scores.length,
    configShowScoreSelector: config.settings.showScoreSelector,
    playingState,
    setPlayingState,
    activeTab,
    scoreViewContainerRef,
    showOriginalClefs,
    showReconstructions,
    onVisualizationOptionsChanged,
    i18n,
    loadAll
  });

  const onScoreChanged = (value: number) => {
    loadAll(value);
  };

  const scoreItems: DefaultOptionType[] = useMemo(() => config.scores.map((score, index) => ({
    label: score.title,
    value: index,
  })), [config.scores])




  // On mobile devices we give the controls + score the full height assigned
  // to the component + scrolling  on the top element to maximize the space
  // available for the score
  const containerHeight = useMemo(() => isMobile && mobileOrientation.isLandscape ? height : "100%"
    , [isMobile, mobileOrientation, height])

  const overflow = useMemo(() =>
    isMobile && mobileOrientation.isLandscape ? "scroll" : "hidden"
    , [isMobile, mobileOrientation, height])

  const introView = useMemo(() =>
    config.settings.showIntroductionSection && textIntroduction ?
      <TextView intro={textIntroduction} /> : null
    , [textIntroduction])

  const scoreView = useMemo(() => {
    if (fetchScoreError != null) {
      return <ErrorView message={t('error.fetchingScore.title')} description={
        <div>
          <p>{t('error.fetchingScore.details', { url: fetchScoreError.url })}</p>
          {fetchScoreError.error.message.split('\n').map((c, i) => { return (<p key={i}> {c} </p>) })}
        </div>
      } />
    } else {
      return <ScoreViewContainer
        ref={scoreViewContainerRef}
        backgroundColor={config.settings.backgroundColor}
        showDownloadButton={config.settings.showDownloadButton}
        height={containerHeight} />
    }
  }, [config.settings.backgroundColor, config.settings.showDownloadButton, containerHeight, fetchScoreError, t])

  const textView = useMemo(() =>
    config.settings.showTextSection && textLyrics !== null ?
      <TextView items={textLyrics} comments={textComments} /> : null
    , [config.settings.showTextSection, textLyrics, textComments])

  const title = useMemo(() => config.settings.showTitle && score?.title ?
    <Typography.Title style={{ flex: "0" }} level={3}>{score.title}</Typography.Title> : null
    , [config.settings.showTitle, score])

  const facsimileView = useMemo(() => {
    if (config.settings.showFacsimileSection && facsimileItems?.length) {
      return <FacsimileView path={config.settings.facsimileImagesPath} items={facsimileItems} />
    } else {
      return null
    }
  }, [config.settings.showFacsimileSection, config.settings.facsimileImagesPath, facsimileItems])



  const content = useMemo(() => (
    <LayoutManager
      splitView={splitView}
      splitViewOrientation={splitViewOrientation}
      scoreView={scoreView}
      textView={textView}
      introView={introView}
      facsimileView={facsimileView}
      activeTab={activeTab}
      onTabChange={onTabChange}
      setActiveTab={setActiveTab}
      showIntroductionSection={config.settings.showIntroductionSection}
      showTextSection={config.settings.showTextSection}
      showFacsimileSection={config.settings.showFacsimileSection}
      activeSplitView={activeSplitView}
      onSplitViewSelectorChanged={onSplitViewSelectorChanged}
      setActiveSplitView={setActiveSplitView}
      sizes={sizes}
      setSizes={setSizes}
    />
  ), [
    splitView, splitViewOrientation, scoreView, textView, introView, facsimileView,
    activeTab, onTabChange, setActiveTab,
    config.settings.showIntroductionSection, config.settings.showTextSection, config.settings.showFacsimileSection,
    activeSplitView, onSplitViewSelectorChanged, setActiveSplitView,
    sizes, setSizes
  ]);

  const drawer = useMemo(() =>
    openDrawer ? <ScoreOptionsPanel allowUserLanguageChange={config.settings.allowUserLanguageChange} onClose={onDrawerClose} open={openDrawer} /> : null
    , [openDrawer, config.settings.allowUserLanguageChange, onDrawerClose])

  const header = useMemo(() => (
    <ScoreViewerHeader
      showScoreSelector={config.scores.length > 1 && config.settings.showScoreSelector}
      scoreItems={scoreItems}
      onScoreChanged={onScoreChanged}
      splitView={splitView}
      activeSplitView={activeSplitView}
      onSplitViewSelectorChanged={onSplitViewSelectorChanged}
      facsimileView={facsimileView}
      introView={introView}
      textView={textView}
      playingState={playingState}
      onShowDrawer={showDrawer}
    />
  ), [
    config.scores.length, config.settings.showScoreSelector, scoreItems, onScoreChanged,
    splitView, activeSplitView, onSplitViewSelectorChanged,
    facsimileView, introView, textView, playingState, showDrawer
  ]);

  return renderMainContent(<>
    {header}
    {title}
    {drawer}
    {content}
  </>)


}

export default forwardRef<ScoreViewerRef, ScoreViewerProps>(ScoreViewer)
