import './App.css'
import useStore from "./store";
import { forwardRef, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import LayoutManager, { hasSecondaryContent, rendersTabBar } from './components/LayoutManager';
import ScoreViewerHeader from './components/ScoreViewerHeader';
import SettingsButton from './components/SettingsButton';
import { useScoreViewerEffects } from './hooks/useScoreViewerEffects';
import { useFullscreenElement } from './hooks/useFullscreenElement';


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
  const isSplitView = useStore.use.isSplitView()
  const setScore = useStore.use.setScore()
  const setSelectedAudioIndex = useStore.use.setSelectedAudioIndex()

  const setAppOptions = useStore.use.setAppOptions()
  const setChoiceOptions = useStore.use.setChoiceOptions()
  const setSubstOptions = useStore.use.setSubstOptions()

  const normalizeFicta = useStore.use.normalizeFicta()
  const showOriginalClefs = useStore.use.showOriginalClefs()
  const activeTab = useStore.use.activeTab()

  const goToSection = useStore.use.goToSection()

  const verovio = useVerovio()
  const mobileOrientation = useMobileOrientation()
  const fullscreenElement = useFullscreenElement()

  const [fetchScoreError, setFetchScoreError] = useState<FetchError | null>(null);


  const [introAvailable, setIntroAvailable] = useState<boolean>(false);
  const [textAvailable, setTextAvailable] = useState<boolean>(false);
  const [facsimileItems, setFacsimileItems] = useState<FacsimileItem[]>([]);

  const scoreViewContainerRef = useRef<ScoreViewContainerRef>(null);
  const loadingScoreIndexRef = useRef<number | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);


  const onFetchScoreError = (url: string, error: Error) => {
    console.error("Fetch score error handler called:", url, error);
    setFetchScoreError({ url, error });
    unloadScore()
  }

  const { fetchScore, unloadScore, hasIntro } = useScoreManager({ config, normalizeFicta, onScoreAnalyzed, onFetchScoreError });

  const { fetchTextParts, textIntroduction } = useTextParts({ config })

  const overflow = useMemo(() =>
    isMobile && mobileOrientation.isLandscape ? "scroll" : "hidden"
    , [isMobile, mobileOrientation, height])

  // Every overlay hangs off the fullscreen element while there is one: the editorial
  // dialog and the player tooltips are portalled out of the tree, and outside the top
  // layer they would not be painted at all. Modal takes its container from here too,
  // falling back to this when it has no `getContainer` of its own.
  const renderMainContent = (content: React.ReactNode) =>
    <ConfigProvider
      getPopupContainer={() => fullscreenElement ?? document.body}
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



  const loadAll = useCallback(async (scoreIndex: number) => {
    console.log(`Loading all for score index ${scoreIndex}`);
    setScore(null)
    setChoiceOptions([], true)
    setAppOptions([], true)
    setSubstOptions([], true)
    setFetchScoreError(null);
    // Which sections the new score offers is settled when it arrives, not here: see the
    // effect below.
    loadingScoreIndexRef.current = scoreIndex;
    setSelectedAudioIndex(0);
    await fetchTextParts(scoreIndex);
    // Allow the container to get the final size (might depend on having tabs content)
    setTimeout(() => {
      fetchScore(scoreIndex);
    }, 0);

  }, [config.scores, fetchScore, fetchTextParts, hasIntro, setScore, setSelectedAudioIndex]);

  useImperativeHandle(ref, () => ({
    goToSection: (section: string) => {
      goToSection(section)
    },
    selectScore: async (scoreIndex: number | null) => {
      if (scoreIndex === null) {
        unloadScore()
      } else if (scoreIndex >= 0 && scoreIndex < config.scores.length) {
        await loadAll(scoreIndex);
      }
    }
  }), [goToSection, unloadScore, loadAll]);

  // All effects moved to useScoreViewerEffects hook
  useScoreViewerEffects({
    configLanguage: config.settings.language,
    configScores: config.scores,
    configShowScoreSelector: config.settings.showScoreSelector,
    activeTab,
    scoreViewContainerRef,
    showOriginalClefs,
    onVisualizationOptionsChanged,
    i18n,
    loadAll
  });

  const onScoreSelectedChanged = async (value: number) => {
    await loadAll(value);
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
        height={containerHeight} />
    }
  }, [config.settings.backgroundColor, config.settings.showDownloadButton, containerHeight, fetchScoreError, t])


  // Which sections the current score carries. Updated only once a score is loaded (not
  // while `score` is transiently null during a tono switch) so a tab does not flicker
  // out and steal focus to another tab mid-load: dropping the facsimile the moment the
  // switch starts sent a reader looking at it to the music tab, where what was still on
  // screen was the previous score, until the new one came in and replaced it. The
  // sections of the score being left stand until the one arriving can replace them.
  useEffect(() => {
    if (score) {
      setTextAvailable(!!(score.scoreText && score.scoreText.length > 0))
      const loaded = loadingScoreIndexRef.current;
      if (loaded != null) {
        setIntroAvailable(hasIntro(loaded));
        setFacsimileItems(config.scores[loaded].facsimileItems || []);
      }
    }
  }, [score])

  const textView = useMemo(() =>
    config.settings.showTextSection && textAvailable ?
      <TextView items={score?.scoreText ?? null} comments={score?.scoreTextComments ?? null} /> : null
    , [config.settings.showTextSection, textAvailable, score])

  const title = useMemo(() => config.settings.showTitle && score?.title ?
    <Typography.Title style={{ flex: "0" }} level={3}>{score.title}</Typography.Title> : null
    , [config.settings.showTitle, score])

  const facsimileView = useMemo(() =>
    config.settings.showFacsimileSection && facsimileItems?.length ?
      <FacsimileView path={config.settings.facsimileImagesPath} items={facsimileItems} /> : null
    , [config.settings.showFacsimileSection, config.settings.facsimileImagesPath, facsimileItems])



  const showDrawer = useCallback(() => {
    setOpenDrawer(true);
  }, []);

  const showScoreSelector = config.scores.length > 1 && config.settings.showScoreSelector;

  // With an external score selector and no split view the header holds nothing but the
  // settings button, and a whole row for one button is expensive on mobile. When there
  // is a tab bar, the button moves into it and the header row disappears.
  const settingsInTabBar = useMemo(() =>
    config.settings.showOptions && !showScoreSelector &&
    rendersTabBar({
      introView, textView, facsimileView,
      showIntroductionSection: config.settings.showIntroductionSection,
      showTextSection: config.settings.showTextSection,
      showFacsimileSection: config.settings.showFacsimileSection
    }, isSplitView)
    , [config.settings.showOptions, config.settings.showIntroductionSection, config.settings.showTextSection,
    config.settings.showFacsimileSection, showScoreSelector, introView, textView, facsimileView, isSplitView]);

  const content = useMemo(() => (
    <LayoutManager
      scoreView={scoreView}
      textView={textView}
      introView={introView}
      facsimileView={facsimileView}
      showIntroductionSection={config.settings.showIntroductionSection}
      showTextSection={config.settings.showTextSection}
      showFacsimileSection={config.settings.showFacsimileSection}
      tabBarExtra={settingsInTabBar ? <SettingsButton onClick={showDrawer} /> : null}
    />
  ), [
    scoreView, textView, introView, facsimileView,
    config.settings.showIntroductionSection, config.settings.showTextSection, config.settings.showFacsimileSection,
    settingsInTabBar, showDrawer,
  ]);

  const onDrawerClose = useCallback(() => {
    setOpenDrawer(false);
  }, []);

  // A score with nothing but music is shown the same way whichever layout is picked,
  // so the panel says so instead of offering a setting with nothing to act on.
  const scoreHasSecondaryContent = useMemo(() => hasSecondaryContent({
    introView, textView, facsimileView,
    showIntroductionSection: config.settings.showIntroductionSection,
    showTextSection: config.settings.showTextSection,
    showFacsimileSection: config.settings.showFacsimileSection
  }), [introView, textView, facsimileView, config.settings.showIntroductionSection,
    config.settings.showTextSection, config.settings.showFacsimileSection]);

  const drawer = useMemo(() =>
    openDrawer ? <ScoreOptionsPanel
      allowUserLanguageChange={config.settings.allowUserLanguageChange}
      hasSecondaryContent={scoreHasSecondaryContent}
      onClose={onDrawerClose}
      open={openDrawer} /> : null
    , [openDrawer, config.settings.allowUserLanguageChange, scoreHasSecondaryContent, onDrawerClose])


  // settingsInTabBar already implies the header would have nothing else to show
  const header = useMemo(() => settingsInTabBar ? null : (
    <ScoreViewerHeader
      showScoreSelector={showScoreSelector}
      showOptions={config.settings.showOptions && !settingsInTabBar}
      selectorLabel={config.settings.selectorLabel || "work"}
      scoreItems={scoreItems}
      onScoreSelectedChanged={onScoreSelectedChanged}
      facsimileView={facsimileView}
      introView={introView}
      textView={textView}
      onShowDrawer={showDrawer}
    />
  ), [
    showScoreSelector, settingsInTabBar, config.settings.showOptions,
    config.settings.selectorLabel, scoreItems, onScoreSelectedChanged,
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
