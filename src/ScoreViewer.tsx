import './App.css'
import useStore from "./store";
import { forwardRef, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useVerovio from './useVerovio';
import { Context } from './Context';
import { ConfigProvider, Select, Space, Splitter, Tabs, TabsProps, theme, Typography } from 'antd'
import { isMobile, useMobileOrientation } from 'react-device-detect';
import ErrorBoundary from './ErrorBoundary';
import { FacsimileItem, LANGUAGE_SESSION_STORAGE_KEY, PlayingState, ScoreProperties, VisualizationOptions } from './types';
import ScoreViewContainer, { ScoreViewContainerRef } from './ScoreViewContainer';
import { DefaultOptionType } from 'antd/es/select';
import TextView from './TextView';
import Icon, { FileImageOutlined, FileTextOutlined } from '@ant-design/icons';
import MusicSvg from "../assets/music.svg?react";
import FacsimileView from './FacsimileView';
import { ScoreViewerConfig } from './types/config';
import { useScoreManager } from './hooks/useScoreManager';
import { useTextParts } from './hooks/useTextParts';
import { useImperativeHandle } from 'react';
import { useConfigValidation } from './hooks/useConfigValidation';
import { useTranslation } from 'react-i18next';
import ErrorView from './ErrorView';


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

  const playingState = useStore.use.playingState()
  const setPlayingState = useStore.use.setPlayingState()

  const goToSection = useStore.use.goToSection()

  const [fetchScoreError, setFetchScoreError] = useState<FetchError|null>(null);

  const verovio = useVerovio()
  const mobileOrientation = useMobileOrientation()

  const [facsimileItems, setFacsimileItems] = useState<FacsimileItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("music")
  const [sizes, setSizes] = useState<(number | string)[]>(['50%', '50%']);

  const scoreViewContainerRef = useRef<ScoreViewContainerRef>(null);

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

  const loadAll = (scoreIndex: number) => {
    setFetchScoreError(null);
    setFacsimileItems(config.scores[scoreIndex].facsimileItems || []);
    fetchScore(scoreIndex);
    fetchTextParts(scoreIndex);
    updateAudioOverlayTracks(scoreIndex);
  }


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



  useEffect(() => {
    if (config.settings.language && config.settings.language !== "autodetect" && sessionStorage.getItem(LANGUAGE_SESSION_STORAGE_KEY) == null) {
      i18n.changeLanguage(config.settings.language);
    }
  }, [config]);

  useEffect(() => {
    if (config.scores.length > 0 && config.settings.showScoreSelector) {
      loadAll(0)
    }
  }, [config]);


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
  }, [config, showReconstructions, setAudioOverlayTracks]);

  const tabContentNotAvailable = useCallback(() => {
    if (activeTab == "facsimile" && (!facsimileItems || facsimileItems.length === 0)) {
      return true
    } else if (activeTab == "text" && textLyrics  === null) {
      return true
    } else if (activeTab == "intro" && textIntroduction === null) {
      return true
    }
    return false

  }, [score, textIntroduction, textLyrics, facsimileItems, activeTab])

  useEffect(() => {
    if (playingState == PlayingState.PLAYING) {
      setPlayingState(PlayingState.STOPPED)
    }

    if (tabContentNotAvailable()) {
      setActiveTab("music")
    }
  }, [showReconstructions, score, textIntroduction, textLyrics, facsimileItems]);


  useEffect(() => {
    if (onVisualizationOptionsChanged && showOriginalClefs != null) {
      onVisualizationOptionsChanged({ showOriginalClefs })
    }
  }, [showOriginalClefs])

  useEffect(() => {
    if (onVisualizationOptionsChanged && Object.keys(showReconstructions).length > 0) {
      onVisualizationOptionsChanged({ showReconstructions })
    }
  }, [showReconstructions])

  const onScoreChanged = (value: number) => {
    loadAll(value);
  };

  const onTabChange = (key: string) => {
    setActiveTab(key)
  }

  const scoreItems: DefaultOptionType[] = useMemo(() => config.scores.map((score, index) => ({
    label: score.title,
    value: index,
  })), [config])


  const scoreSelector = useMemo(() =>
    config.scores.length > 1 && config.settings.showScoreSelector ?
      <Space direction='horizontal' style={{ marginBottom: "10px", textAlign: "start", flex: "0" }}>
        <Typography.Text style={{ marginLeft: "10px" }}>{t('heading.work')}:</Typography.Text>
        <Select
          style={{ minWidth: "200px", marginRight: "10px" }}
          defaultValue={0}
          options={scoreItems}
          onChange={onScoreChanged} />
      </Space>
      : null
    , [config, onScoreChanged, t])

  // On mobile devices we give the controls + score the full height assigned
  // to the component + scrolling  on the top element to maximize the space
  // available for the score
  const containerHeight = useMemo(() => isMobile && mobileOrientation.isLandscape ? height : "100%"
    , [isMobile, mobileOrientation, height])

  const overflow = useMemo(() =>
    isMobile && mobileOrientation.isLandscape ? "scroll" : "hidden"
    , [isMobile, mobileOrientation, height])


  const scoreViewContainer = useMemo(() => {
    if (fetchScoreError != null) {
      return <ErrorView message={t('error.fetchingScore.title')} description={
        <div>
          <p>{t('error.fetchingScore.details', { url: fetchScoreError.url })}</p>
          {fetchScoreError.error.message.split('\n').map((c, i) => { return ( <p key={i}> {c} </p>) })}
        </div>
      } />
    } else {
      return <ScoreViewContainer
        ref={scoreViewContainerRef}
        backgroundColor={config.settings.backgroundColor}
        showDownloadButton={config.settings.showDownloadButton}
        allowUserLanguageChange={config.settings.allowUserLanguageChange}
        height={containerHeight} />
    }
  }, [config, containerHeight, fetchScoreError, t])

  const title = useMemo(() => config.settings.showTitle && score?.title ?
    <Typography.Title style={{ flex: "0" }} level={3}>{score.title}</Typography.Title> : null
  , [config, score])

  const facsimileView = useMemo(() => {
    if (config.settings.showFacsimileSection && facsimileItems?.length) {
        return <FacsimileView path={config.settings.facsimileImagesPath} items={facsimileItems} />
    } else {
      return null
    }
  }, [config, score, facsimileItems, config.settings.facsimileImagesPath])


  const scoreView = useMemo(() => {
    if (splitView) {
      return <Splitter
        onResize={setSizes}
        style={{ height: "100%", boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)' }}
      >
        <Splitter.Panel size={sizes[0]} resizable={true} >
          {scoreViewContainer}
        </Splitter.Panel>
        <Splitter.Panel size={sizes[1]}>
          {facsimileView}
        </Splitter.Panel>
      </Splitter>
    }
    return scoreViewContainer
  }, [scoreViewContainer, splitView, facsimileView])


  const tabsItems: TabsProps['items'] = useMemo(() =>
    config.settings.showIntroductionSection ||
      config.settings.showTextSection ||
      config.settings.showFacsimileSection ? [
        config.settings.showIntroductionSection && textIntroduction !== null ? {
          key: 'intro',
          label: <Space direction='horizontal'>{t('tab.introduction')}</Space>,
          children: <TextView intro={textIntroduction} />
        } : null,
        {
          key: 'music',
          label: <Space direction='horizontal'><Icon component={MusicSvg} />{t('tab.music')}</Space>,
          children: scoreView
        },
        config.settings.showTextSection && textLyrics !== null ? {
          key: 'text',
          label: <Space direction='horizontal'><FileTextOutlined />{t('tab.text')}</Space>,
          children: <TextView items={textLyrics} comments={textComments} />
        } : null,
        !splitView && facsimileView ? {
          key: 'facsimile',
          label: <Space direction='horizontal'> <FileImageOutlined />{t('tab.facsimile')}</Space>,
          children: facsimileView
        } : null
      ].filter(tab => tab != null) : [], [config, score, textIntroduction, textLyrics, facsimileView, title, scoreView, splitView, t])


  const tabs = useMemo(() =>
    tabsItems ? <Tabs items={tabsItems}
                    defaultActiveKey="music"
                    activeKey={activeTab}
                    onChange={onTabChange}
                    style={{ width: "100%", flex: "1" , ...(activeTab == "text" || activeTab == "intro" ? {height: "100%"} : {}) }} /> : null
  , [config, score, tabsItems, activeTab])


  const content = tabs && tabsItems.length > 1 ? tabs : scoreView

  useEffect(() => {
    if (isMobile && mobileOrientation.isLandscape && activeTab == "music") {
      setTimeout(() => {
        scoreViewContainerRef.current?.scrollIntoView()
      }, 100)
    }
  }, [mobileOrientation.orientation])


  return renderMainContent(<>
      {scoreSelector}
      {title}
      {content}
    </>)
}

export default forwardRef<ScoreViewerRef, ScoreViewerProps>(ScoreViewer)
