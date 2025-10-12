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
  const normalizeFicta = useStore.use.normalizeFicta()
  const showOriginalClefs = useStore.use.showOriginalClefs()
  const activeTab = useStore.use.activeTab()

  const playingState = useStore.use.playingState()
  const setPlayingState = useStore.use.setPlayingState()

  const goToSection = useStore.use.goToSection()

  const verovio = useVerovio()
  const mobileOrientation = useMobileOrientation()

  const [fetchScoreError, setFetchScoreError] = useState<FetchError | null>(null);



  const [introAvailable, setIntroAvailable] = useState<boolean>(false);
  const [textAvailable, setTextAvailable] = useState<boolean>(false);
  const [facsimileItems, setFacsimileItems] = useState<FacsimileItem[]>([]);

  const scoreViewContainerRef = useRef<ScoreViewContainerRef>(null);
  const [openDrawer, setOpenDrawer] = useState(false);


  const onFetchScoreError = (url: string, error: Error) => {
    setFetchScoreError({ url, error });
    unloadScore()
  }

  const { fetchScore, unloadScore, hasIntro, hasText } = useScoreManager({ t, config, normalizeFicta, onScoreAnalyzed, onFetchScoreError });

  const { fetchTextParts, textIntroduction, textLyrics, textComments } = useTextParts({ config })

  const overflow = useMemo(() =>
    isMobile && mobileOrientation.isLandscape ? "scroll" : "hidden"
    , [isMobile, mobileOrientation, height])

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



  const loadAll = useCallback((scoreIndex: number) => {
    setFetchScoreError(null);
    setIntroAvailable(hasIntro(scoreIndex));
    setTextAvailable(hasText(scoreIndex));
    setFacsimileItems(config.scores[scoreIndex].facsimileItems || []);
    fetchScore(scoreIndex);
    fetchTextParts(scoreIndex);
  }, [config.scores, fetchScore, fetchTextParts]);

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
    configScores: config.scores,
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

  const onScoreSelectedChanged = (value: number) => {
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



  const introView = useMemo(() =>
    config.settings.showIntroductionSection && introAvailable ?
      <TextView intro={textIntroduction} /> : null
    , [config.settings.showIntroductionSection, introAvailable, textIntroduction])

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
        showMusicAnalysisByDefault={config.settings.showMusicAnalysisByDefault}
        height={containerHeight} />
    }
  }, [config.settings.backgroundColor, config.settings.showDownloadButton, containerHeight, fetchScoreError, t])

  const textView = useMemo(() =>
    config.settings.showTextSection && textAvailable ?
      <TextView items={textLyrics} comments={textComments} /> : null
    , [config.settings.showTextSection, textAvailable, textLyrics, textComments])

  const title = useMemo(() => config.settings.showTitle && score?.title ?
    <Typography.Title style={{ flex: "0" }} level={3}>{score.title}</Typography.Title> : null
    , [config.settings.showTitle, score])

  const facsimileView = useMemo(() =>
    config.settings.showFacsimileSection && facsimileItems?.length ?
      <FacsimileView path={config.settings.facsimileImagesPath} items={facsimileItems} /> : null
    , [config.settings.showFacsimileSection, config.settings.facsimileImagesPath, facsimileItems])



  const content = useMemo(() => (
    <LayoutManager
      scoreView={scoreView}
      textView={textView}
      introView={introView}
      facsimileView={facsimileView}
      showIntroductionSection={config.settings.showIntroductionSection}
      showTextSection={config.settings.showTextSection}
      showFacsimileSection={config.settings.showFacsimileSection}
    />
  ), [
    scoreView, textView, introView, facsimileView,
    config.settings.showIntroductionSection, config.settings.showTextSection, config.settings.showFacsimileSection,
  ]);

  const showDrawer = useCallback(() => {
    setOpenDrawer(true);
  }, []);

  const onDrawerClose = useCallback(() => {
    setOpenDrawer(false);
  }, []);

  const drawer = useMemo(() =>
    openDrawer ? <ScoreOptionsPanel
      allowUserLanguageChange={config.settings.allowUserLanguageChange}
      showMusicAnalysisByDefault={config.settings.showMusicAnalysisByDefault}
      onClose={onDrawerClose}
      open={openDrawer} /> : null
    , [openDrawer, config.settings.allowUserLanguageChange, onDrawerClose])


  const header = useMemo(() => (
    <ScoreViewerHeader
      showScoreSelector={config.scores.length > 1 && config.settings.showScoreSelector}
      showOptions={config.settings.showOptions}
      selectorLabel={config.settings.selectorLabel || "work"}
      scoreItems={scoreItems}
      onScoreSelectedChanged={onScoreSelectedChanged}
      facsimileView={facsimileView}
      introView={introView}
      textView={textView}
      onShowDrawer={showDrawer}
    />
  ), [
    config.scores.length, config.settings.showScoreSelector, scoreItems, onScoreSelectedChanged,
    facsimileView, introView, textView, showDrawer
  ]);

  return renderMainContent(<>
    {header}
    {title}
    {drawer}
    {content}
  </>)


}

export default forwardRef<ScoreViewerRef, ScoreViewerProps>(ScoreViewer)
