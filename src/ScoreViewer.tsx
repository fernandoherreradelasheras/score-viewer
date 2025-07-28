import './App.css'
import useStore from "./store";
import { forwardRef, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useVerovio from './useVerovio';
import { Context } from './Context';
import { Alert, ConfigProvider, Select, Space, Tabs, TabsProps, theme, Typography } from 'antd'
import { isMobile, useMobileOrientation } from 'react-device-detect';
import ErrorBoundary from './ErrorBoundary';
import { LANGUAGE_SESSION_STORAGE_KEY, PlayingState, ScoreProperties, VisualizationOptions } from './types';
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
import { useTranslation } from 'react-i18next';
import { useConfigValidation } from './hooks/useConfigValidation';

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

const ScoreViewer = ({ config, width, height, onScoreAnalyzed, onVisualizationOptionsChanged }: ScoreViewerProps, ref: Ref<ScoreViewerRef>) => {
  const { t, i18n } = useTranslation("common");

  const { configErrors, hasConfigErrors } = useConfigValidation(config);

  const score = useStore.use.score()
  const showReconstructions = useStore.use.showReconstructions()
  const setAudioOverlayTracks = useStore.use.setAudioOverlayTracks()
  const normalizeFicta = useStore.use.normalizeFicta()
  const showOriginalClefs = useStore.use.showOriginalClefs()

  const playingState = useStore.use.playingState()
  const setPlayingState = useStore.use.setPlayingState()

  const goToSection = useStore.use.goToSection()

  // If there are config validation errors, render error UI
  if (hasConfigErrors) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            fontSize: isMobile ? 12 : 16
          },
        }}>
        <div className="score-viewer-top-element" style={{ width: width, height: height, overflow: "hidden" }}>
          <div style={{
            width: "calc(100% - 12px)",
            height: "calc(100% - 12px)",
            padding: "6px",
            display: "flex",
            flexDirection: "column"
          }}>
            <Alert
              message={t('configValidation.configurationError')}
              description={
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
              }
              type="error"
              showIcon
              style={{ margin: "16px 0" }}
            />
          </div>
        </div>
      </ConfigProvider>
    );
  }

  const verovio = useVerovio()
  const mobileOrientation = useMobileOrientation()

  const [activeTab, setActiveTab] = useState<string>("music")
  const scoreViewContainerRef = useRef<ScoreViewContainerRef>(null);

  const { fetchTextParts, textIntroduction, textLyrics, textComments } = useTextParts({ config })

  const { fetchScore, unloadScore } = useScoreManager({ config, normalizeFicta, onScoreAnalyzed });

  const loadAll = (scoreIndex: number) => {
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
    if (score && activeTab == "facsimile" && (!score.fascimileItems || score.fascimileItems.length === 0)) {
      return true
    } else if (score && activeTab == "text" && textLyrics  === null) {
      return true
    } else if (score && activeTab == "intro" && textIntroduction === null) {
      return true
    }
    return false

  }, [score, textIntroduction, textLyrics, activeTab])

  useEffect(() => {
    if (!score) return;

    if (playingState == PlayingState.PLAYING) {
      setPlayingState(PlayingState.STOPPED)
    }

    if (tabContentNotAvailable()) {
      setActiveTab("music")
    }

  }, [showReconstructions, score]);


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
    fetchScore(value);
    fetchTextParts(value);
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
    , [config, t])

  // On mobile devices we give the controls + score the full height assigned
  // to the component + scrolling  on the top element to maximize the space
  // available for the score
  const containerHeight = useMemo(() => isMobile && mobileOrientation.isLandscape ? height : "100%"
    , [isMobile, mobileOrientation, height])

  const overflow = useMemo(() =>
    isMobile && mobileOrientation.isLandscape ? "scroll" : "hidden"
    , [isMobile, mobileOrientation, height])


  const scoreView = useMemo(() => <ScoreViewContainer
    ref={scoreViewContainerRef}
    backgroundColor={config.settings.backgroundColor}
    showDownloadButton={config.settings.showDownloadButton}
    allowUserLanguageChange={config.settings.allowUserLanguageChange}
    height={containerHeight} />
    , [config, containerHeight])

  const title = useMemo(() => config.settings.showTitle && score?.title ?
    <Typography.Title style={{ flex: "0" }} level={3}>{score.title}</Typography.Title> : null
  , [config, score])


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
        config.settings.showFacsimileSection && score?.fascimileItems?.length ? {
          key: 'facsimile',
          label: <Space direction='horizontal'> <FileImageOutlined />{t('tab.facsimile')}</Space>,
          children: <FacsimileView path={config.settings.facsimileImagesPath} items={score.fascimileItems} />
        } : null
      ].filter(t => t != null) : [], [config, score, textIntroduction, textLyrics, title, scoreView, t])


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

  return (
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
              {scoreSelector}
              {title}
              {content}
            </div>
          </div>
        </ErrorBoundary>
      </Context.Provider>
    </ConfigProvider>
  )
}

export default forwardRef<ScoreViewerRef, ScoreViewerProps>(ScoreViewer)
