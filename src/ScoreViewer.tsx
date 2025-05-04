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
import { FacsimileItem, Score } from './types';
import ScoreViewContainer from './ScoreViewContainer';
import { DefaultOptionType } from 'antd/es/select';
import TextView from './TextView';
import Icon, { FileImageOutlined, FileTextOutlined } from '@ant-design/icons';
import MusicSvg from "../assets/music.svg?react";
import FacsimileView from './FacsimileView';



export interface ScoreItem {
  title: string
  audioUrl?: string
  meiUrl: string
  textUrl?: string
  facsimileItems?: FacsimileItem[]
  encodingProperties: {
    encodedTransposition?: string
  }
}

export interface ScoreViewerConfig {
  settings: {
    showScoreSelector: boolean,
    showDownloadButton: boolean,
    showTextSection: boolean,
    showFacsimileSection: boolean,
    renderTitlesFromMEI: boolean
    backgroundColor?: string
  },
  scores:ScoreItem[]
}


export type ScoreProperties = {
    hasFicta: boolean,
    numVerses: number,
    numMeasures: number,
    editor: string,
    reconstructionBy: string | null,
    sections: {label: string, id: string}[],
    notes: string[],
    hasEditorial: boolean,
    encodedTransposition?: string
}

export interface ScoreViewerProps {
  config: ScoreViewerConfig
  width: string
  height: string
  scoreIndex?: number
  scoreSectionId?: string
  onScoreAnalyzed?: (scoreIndex: number, properties: ScoreProperties) => void
}

function ScoreViewer({ config, width, height, scoreIndex, scoreSectionId, onScoreAnalyzed }: ScoreViewerProps) {
  const currentScoreIdx = useStore.use.currentScoreIdx()
  const setCurrentScoreIdx = useStore.use.setCurrentScoreIdx()
  const currentPage = useStore.use.currentPage()
  const setCurrentPage = useStore.use.setCurrentPage()
  const scoreCache = useStore.use.scoreCache()
  const setScoreCache = useStore.use.setScoreCache()
  const score = useStore.use.score()
  const setScore = useStore.use.setScore()
  const setAudioUrl = useStore.use.setAudioUrl()
  const normalizeFicta = useStore.use.normalizeFicta()
  const showNVerses = useStore.use.showNVerses()
  const setShowNVerses = useStore.use.setShowNVerses()

  const [activeTab, setActiveTab] = useState<string>()

  const verovio = useVerovio()

  useEffect(() => {
    if (config.settings.showScoreSelector && config.scores.length > 0) {
        setCurrentScoreIdx(0)
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


  const generateOneVerseMei = (mei: string) => {
    const scoreProcessor = new ScoreProcessor(mei)
    if (normalizeFicta) {
      scoreProcessor.addNormalizeFictaFilter()
    }
    scoreProcessor.addNVersesFilter(1)
    return scoreProcessor.filterScore()
  }

  const updateScore = (scoreIndex: number, newScore: Score, audioUrl?: string) => {
    setScore(newScore)
    setAudioUrl(audioUrl || null)
    if (showNVerses) {
      setShowNVerses(null)
    }
    if (onScoreAnalyzed) {
      onScoreAnalyzed(scoreIndex, newScore.properties)
    }
    if ((activeTab == "text" && !newScore.text) ||
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

      const meiUrl = config.scores[currentScoreIdx].meiUrl
      const textUrl = config.settings.showTextSection ? config.scores[currentScoreIdx].textUrl : undefined

      const encodingProperties = config.scores[currentScoreIdx].encodingProperties
      const audioUrl = config.scores[currentScoreIdx].audioUrl

      if (scoreCache[meiUrl]) {
        const cachedScore = scoreCache[meiUrl]
        updateScore(currentScoreIdx, cachedScore, audioUrl)
      } else {
        const meiString = await fetchMei(meiUrl)
        const textString = textUrl ? await fetch(textUrl).then(res => res.text()) : undefined
        const scoreProcessor = new ScoreProcessor(meiString)
        if (config.settings.renderTitlesFromMEI) {
          scoreProcessor.addTitlesFilter()
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
          text: textString,
          fascimileItems: scoreEntry.facsimileItems,
        }

        setScoreCache(
          { [meiUrl]: newScore }
        )
        updateScore(currentScoreIdx, newScore, audioUrl)

      }
    })()
  }, [config, currentScoreIdx])


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
    config.settings.showTextSection && score?.text ? {
      key: 'text',
      label: <Space direction='horizontal'><FileTextOutlined />Texto</Space>,
      children: <TextView title={score.title} text={score.text} />
    } : null,
    config.settings.showFacsimileSection && score?.fascimileItems?.length ? {
      key: 'facsimile',
      label: <Space direction='horizontal'> <FileImageOutlined />Facsimil</Space>,
      children: <FacsimileView items={score.fascimileItems} />
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

