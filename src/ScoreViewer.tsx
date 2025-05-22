import './App.css'
import useStore from "./store";
import { useEffect, useMemo, useState } from 'react';
import useVerovio from './useVerovio';
import { Context } from './Context';
import ScoreAnalyzer from './ScoreAnalyzer';
import ScoreProcessor from './ScoreProcessor';
import { ConfigProvider, Select, Space, Tabs, TabsProps, theme, Typography } from 'antd'
import { isMobile } from 'react-device-detect';
import ErrorBoundary from './ErrorBoundary';
import { LyricItem, PlayingState, Score, ScoreProperties, VisualizationOptions } from './types';
import ScoreViewContainer from './ScoreViewContainer';
import { DefaultOptionType } from 'antd/es/select';
import TextView from './TextView';
import Icon, { FileImageOutlined, FileTextOutlined } from '@ant-design/icons';
import MusicSvg from "../assets/music.svg?react";
import FacsimileView from './FacsimileView';
import { ScoreViewerConfig, ScoreViewerConfigScoreText } from './types/config';



export interface ScoreViewerProps {
  config: ScoreViewerConfig
  width: string
  height: string
  scoreIndex?: number
  scoreSectionId?: string
  onScoreAnalyzed?: (scoreIndex: number, properties: ScoreProperties) => void
  onVisualizationOptionsChanged?: (scoreIndex: number, options: VisualizationOptions) => void
}

const getLyrics = async (path: string, textItems: ScoreViewerConfigScoreText[]) => {
  const lyrics: LyricItem[] = []
  for (let textItem of textItems) {
    let text = await fetch(path + textItem.file).then(res => res.text())
    lyrics.push({
      title: textItem.name,
      text: text
    } as LyricItem)
  }
  return lyrics
}

function ScoreViewer({ config, width, height, scoreIndex, scoreSectionId, onScoreAnalyzed, onVisualizationOptionsChanged }: ScoreViewerProps) {
  const currentScoreIdx = useStore.use.currentScoreIdx()
  const setCurrentScoreIdx = useStore.use.setCurrentScoreIdx()
  const currentPage = useStore.use.currentPage()
  const setCurrentPage = useStore.use.setCurrentPage()
  const scoreCache = useStore.use.scoreCache()
  const setScoreCache = useStore.use.setScoreCache()
  const score = useStore.use.score()
  const setScore = useStore.use.setScore()
  const setAudioUrl = useStore.use.setAudioUrl()
  const showReconstructions = useStore.use.showReconstructions()
  const setShowReconstructions = useStore.use.setShowReconstructions()
  const setAudioOverlayTracks = useStore.use.setAudioOverlayTracks()
  const normalizeFicta = useStore.use.normalizeFicta()
  const setNormalizeFicta = useStore.use.setNormalizeFicta()
  const setShowNVerses = useStore.use.setShowNVerses()
  const showOriginalClefs = useStore.use.showOriginalClefs()
  const setShowOriginalClefs = useStore.use.setShowOriginalClefs()

  const playingState = useStore.use.playingState()
  const setPlayingState = useStore.use.setPlayingState()

  const [activeTab, setActiveTab] = useState<string>()

  const verovio = useVerovio()

  useEffect(() => {
    if (config.settings.showScoreSelector && config.scores.length > 0) {
        setCurrentScoreIdx(0)
    }

    //
    return () => {
      setCurrentScoreIdx(null)
      setAudioUrl(null)
      setScore(null)
    }
  }, [config]);

  useEffect(() => {
    if (scoreSectionId && scoreIndex == currentScoreIdx) {
      const sectionPage = verovio?.getPageWithElement(scoreSectionId)
      if (sectionPage && sectionPage > 0 && sectionPage != currentPage) {
        setCurrentPage(sectionPage)
      }
    }
  }, [scoreSectionId])

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


  const generateOneVerseMei = (mei: string) => {
    const scoreProcessor = new ScoreProcessor(mei)
    if (normalizeFicta) {
      scoreProcessor.addNormalizeFictaFilter()
    }
    scoreProcessor.addNVersesFilter(1)
    return scoreProcessor.filterScore()
  }

  const addFadeOutTransiton = () => {
    const svgElement = document.querySelector(".svg-container svg") as SVGSVGElement | null;
    if (svgElement) {
      svgElement.classList.add("transition-zero-end");
    }
  }

  const updateScore = (scoreIndex: number, newScore: Score, audioUrl?: string) => {
    addFadeOutTransiton()

    // clear options that should not be persistent
    // TODO: define all these settings consistently
    setShowNVerses(null)
    setNormalizeFicta(null)
    setShowReconstructions({}, true)
    setShowOriginalClefs(null)

    setScore(newScore)

    setAudioUrl(audioUrl || null)

    if (onScoreAnalyzed) {
      onScoreAnalyzed(scoreIndex, newScore.properties)
    }
    if ((activeTab == "text" && !newScore.lyrics) ||
        (activeTab == "facsimile" && !newScore.fascimileItems)) {
      setActiveTab("music")
    }
  }

  useEffect(() => {
    if (config.settings.showScoreSelector) {
      return
    }

    if (scoreIndex !== undefined && scoreIndex !== currentScoreIdx) {
      setCurrentScoreIdx(scoreIndex)
    }

  }, [scoreIndex])


  useEffect(() => {
    (async () => {
      const fetchMei = async (meiUrl: string) => {
        const res = await fetch(meiUrl)
        return res.text()
      }

      if (currentScoreIdx == null) {
        return
      }

      const scoreEntry = config.scores[currentScoreIdx]
      if (!scoreEntry) {
        return
      }

      const scoreDef =  config.scores[currentScoreIdx]
      const path = config.settings.basePath + scoreDef.path + "/"
      const meiUrl = path + scoreDef.meiFile
      const encodingProperties = scoreDef.encodingProperties
      const audioUrl = path + scoreDef.audioBaseFile


      if (scoreCache[meiUrl]) {
        const cachedScore = scoreCache[meiUrl]
        updateScore(currentScoreIdx, cachedScore, audioUrl)
      } else {
        const meiString = await fetchMei(meiUrl)

      const lyrics = config.settings.showTextSection && scoreDef.text ?
        await getLyrics(path, scoreDef.text) : undefined

        const scoreProcessor = new ScoreProcessor(meiString)
        if (config.settings.renderTitlesFromMEI) {
          scoreProcessor.addTitlesFilter()
          scoreProcessor.addReonstructionNamesFilter()
        }
        scoreProcessor.addEnsureMeasuresIdFilter()
        scoreProcessor.addEnsureSectionsIdFilter()
        const originalMei = scoreProcessor.filterScore()
        const analyzer = new ScoreAnalyzer(0, originalMei)
        const properties = {
          ...analyzer.getScoreProperties(),
          encodedTransposition: encodingProperties.encodedTransposition || undefined,
        }
        const editorialItems = analyzer.getEditorial()
        const newScore: Score = {
          url: meiUrl,
          title: scoreEntry.title,
          originalMei: originalMei,
          singleVerseMei: generateOneVerseMei(originalMei),
          properties: properties,
          editorialItems: editorialItems,
          lyrics: lyrics,
          fascimileItems: scoreEntry.facsimileItems,
        }

        setScoreCache(
          { [meiUrl]: newScore }
        )
        updateScore(currentScoreIdx, newScore, audioUrl)

      }
    })()
  }, [currentScoreIdx])


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
                  onChange={onScoreChanged}/>
              </Space>
              : null
  , [config])

  const scoreView = <ScoreViewContainer
    backgroundColor={config.settings.backgroundColor}
    showDownloadButton={config.settings.showDownloadButton}
    />

  const tabsItems: TabsProps['items'] = useMemo(() => [
    {
      key: 'music',
      label: <Space direction='horizontal'><Icon component={MusicSvg} />Musica</Space>,
      children: scoreView
    },
    config.settings.showTextSection && score?.lyrics ? {
      key: 'text',
      label: <Space direction='horizontal'><FileTextOutlined />Texto</Space>,
      children: <TextView title={score.title} items={score.lyrics} />
    } : null,
    config.settings.showFacsimileSection && score?.fascimileItems?.length ? {
      key: 'facsimile',
      label: <Space direction='horizontal'> <FileImageOutlined />Facsimil</Space>,
      children: <FacsimileView path={config.settings.facsimileImagesPath} items={score.fascimileItems} />
    } : null
  ].filter(t => t != null), [config, score])


  const tabs = useMemo(() => config.settings.showTextSection || config.settings.showFacsimileSection  ?
    <Tabs items={tabsItems} defaultActiveKey={tabsItems[0].key} activeKey={activeTab} onChange={onTabChange} style={{ width:"100%", height: "100%" }}/> : null
  ,[config, score, activeTab])

  const content = tabs  && tabsItems.length > 1 ? tabs : scoreView

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
              { scoreSelector }
              { content }
            </div>
          </div>
        </ErrorBoundary>
      </Context.Provider>
    </ConfigProvider>
  )
}

export default ScoreViewer

