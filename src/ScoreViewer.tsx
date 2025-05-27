import './App.css'
import useStore from "./store";
import React, { forwardRef, Ref, useEffect, useMemo, useState } from 'react';
import useVerovio from './useVerovio';
import { Context } from './Context';
import { ConfigProvider, Select, Space, Tabs, TabsProps, theme, Typography } from 'antd'
import { isMobile } from 'react-device-detect';
import ErrorBoundary from './ErrorBoundary';
import { LyricItem, PlayingState, ScoreProperties, VisualizationOptions } from './types';
import ScoreViewContainer from './ScoreViewContainer';
import { DefaultOptionType } from 'antd/es/select';
import TextView from './TextView';
import Icon, { FileImageOutlined, FileTextOutlined } from '@ant-design/icons';
import MusicSvg from "../assets/music.svg?react";
import FacsimileView from './FacsimileView';
import { ScoreViewerConfig } from './types/config';
import { useScoreManager } from './hooks/useScoreManager';
import { useTextParts } from './hooks/useTextParts';
import { useImperativeHandle } from 'react';


export interface ScoreViewerProps {
  ref?: React.Ref<unknown>
  config: ScoreViewerConfig
  width: string
  height: string
  scoreIndex?: number
  onScoreAnalyzed?: (scoreIndex: number, properties: ScoreProperties) => void
  onVisualizationOptionsChanged?: (scoreIndex: number, options: VisualizationOptions) => void
  onTextPartChanged?: (scoreIndex: number, partName: string, text: LyricItem[] | string | null | undefined) => void
}

export interface ScoreViewerRef {
  goToSection: (sectionId: string) => void
}




const ScoreViewer = ({ config, width, height, scoreIndex, onScoreAnalyzed, onTextPartChanged, onVisualizationOptionsChanged }: ScoreViewerProps, ref: Ref<ScoreViewerRef>) => {

  const currentScoreIdx = useStore.use.currentScoreIdx()
  const setCurrentScoreIdx = useStore.use.setCurrentScoreIdx()
  const score = useStore.use.score()
  const setScore = useStore.use.setScore()
  const showReconstructions = useStore.use.showReconstructions()
  const setAudioOverlayTracks = useStore.use.setAudioOverlayTracks()
  const normalizeFicta = useStore.use.normalizeFicta()
  const setAudioUrl = useStore.use.setAudioUrl()
  const showOriginalClefs = useStore.use.showOriginalClefs()

  const playingState = useStore.use.playingState()
  const setPlayingState = useStore.use.setPlayingState()

  const goToSection = useStore.use.goToSection()

  const [activeTab, setActiveTab] = useState<string>("music")

  const verovio = useVerovio()

  useImperativeHandle(ref, () => ({
    goToSection: (section: string) => {
        goToSection(section)
    }
  }));

  useEffect(() => {
    if (config.settings.showScoreSelector && config.scores.length > 0) {
      setCurrentScoreIdx(0)
    }

    return () => {
      setCurrentScoreIdx(null)
      setAudioUrl(null)
      setScore(null)
    }
  }, [config]);



  useEffect(() => {
    if (!score || currentScoreIdx == null) return;

    if (playingState == PlayingState.PLAYING) {
      setPlayingState(PlayingState.STOPPED)
    }

    const currentScoreItem = config.scores[currentScoreIdx];
    if (!currentScoreItem?.audioOverlays) return;

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
  }, [showReconstructions, score]);


  useEffect(() => {
    if (onVisualizationOptionsChanged && currentScoreIdx != null && showOriginalClefs != null) {
      onVisualizationOptionsChanged(currentScoreIdx,
        { showOriginalClefs })
    }
  }, [showOriginalClefs])

  useEffect(() => {
    if (onVisualizationOptionsChanged && currentScoreIdx != null && Object.keys(showReconstructions).length > 0) {
      onVisualizationOptionsChanged(currentScoreIdx,
        { showReconstructions })
    }
  }, [showReconstructions])

  useEffect(() => {
    if (config.settings.showScoreSelector) {
      return
    }

    if (scoreIndex !== undefined && scoreIndex !== currentScoreIdx) {
      setCurrentScoreIdx(scoreIndex)
    }

  }, [scoreIndex])


  useScoreManager({
    config,
    currentScoreIdx,
    normalizeFicta,
    activeTab,
    onScoreAnalyzed
  });

  const { textIntroduction, textLyrics, textComments } = useTextParts({ config, currentScoreIdx, onTextPartChanged })


  const onScoreChanged = (value: number) => {
    setCurrentScoreIdx(value);
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
      <Space direction='horizontal' style={{ marginBottom: "10px", textAlign: "start" }}>
        <Typography.Text style={{ marginLeft: "10px" }}>Parte:</Typography.Text>
        <Select
          style={{ minWidth: "200px", marginRight: "10px" }}
          defaultValue={0}
          options={scoreItems}
          onChange={onScoreChanged} />
      </Space>
      : null
    , [config])

  const scoreView = <ScoreViewContainer
    backgroundColor={config.settings.backgroundColor}
    showDownloadButton={config.settings.showDownloadButton}
  />



  const tabsItems: TabsProps['items'] = useMemo(() =>
    config.settings.showIntroductionSection ||
      config.settings.showTextSection ||
      config.settings.showFacsimileSection ? [
        config.settings.showIntroductionSection && textIntroduction != null ? {
          key: 'intro',
          label: <Space direction='horizontal'>Introducción</Space>,
          children: <TextView title="Introducción" intro={textIntroduction} />
        } : null,
        {
          key: 'music',
          label: <Space direction='horizontal'><Icon component={MusicSvg} />Musica</Space>,
          children: scoreView
        },
        config.settings.showTextSection && textLyrics != null ? {
          key: 'text',
          label: <Space direction='horizontal'><FileTextOutlined />Texto</Space>,
          children: <TextView title={score?.title || ""} items={textLyrics} comments={textComments} />
        } : null,
        config.settings.showFacsimileSection && score?.fascimileItems?.length ? {
          key: 'facsimile',
          label: <Space direction='horizontal'> <FileImageOutlined />Facsimil</Space>,
          children: <FacsimileView path={config.settings.facsimileImagesPath} items={score.fascimileItems} />
        } : null
      ].filter(t => t != null) : [], [config, score, textIntroduction, textLyrics])


  const tabs = useMemo(() =>
    tabsItems ? <Tabs items={tabsItems}
                    defaultActiveKey="music"
                    activeKey={activeTab}
                    onChange={onTabChange}
                    style={{ width: "100%", height: "100%" }} /> : null
  , [config, score, tabsItems, activeTab])

  const content = tabs && tabsItems.length > 1 ? tabs : scoreView

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
          <div className="score-viewer" style={{ width: width, height: height }}>
            <div style={{ width: "calc(100% - 12px)", height: "calc(100% - 12px)", padding: "6px" }}>
              {scoreSelector}
              {content}
            </div>
          </div>
        </ErrorBoundary>
      </Context.Provider>
    </ConfigProvider>
  )
}



export default forwardRef<ScoreViewerRef, ScoreViewerProps>(ScoreViewer)
