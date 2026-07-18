import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ScoreViewer, { ScoreViewerRef } from './ScoreViewer'
import testConfig from '../assets/test.json'
import { ScoreViewerConfig } from './types/config'
import { Button, Space } from 'antd'
import { ScoreProperties } from './types'
import { useTranslation } from 'react-i18next'


const USE_TEST_CONFIG = true

// Default test configuration for development
const defaultConfig: ScoreViewerConfig = {
  settings: {
    showDownloadButton: true,
    showTitle: false,
    showIntroductionSection: true,
    showFacsimileSection: true,
    showTextSection: true,
    renderTitlesFromMEI: true,
    showScoreSelector: true,
    showOptions: true,
    backgroundColor: "#f6eee3",
    basePath: "/",
    facsimileImagesPath: "/facsimile/",
    language: "es",
    allowUserLanguageChange: false,
    selectorLabel: "work"
  },

  scores: [
    {
      title: "Un imposible me mata",
      path: "un-imposible",
      meiFile: "music.mei",
      introductionFile: "intro.md",
      audioFiles: [
        { file: "base.mp3", name: "audio render" }
      ],
      facsimileItems: [
        { name: "Soprano 1", file: "un-imposible-s1.jpg" },
        { name: "Tenor", file: "un-imposible-tenor.jpg" }
      ],
      encodingProperties: { encodedTransposition: "" }
    },
    {
      title: "Al compás de un arroyuelo",
      path: "arroyuelo",
      meiFile: "music.mei",
      introductionFile: "intro.md",
      encodingProperties: { encodedTransposition: "" }
    },
    {
      // Editorial markup
      title: "editorial markup",
      path: "editorials",
      meiFile: "music.mei",
      audioFiles: [
        { file: "editorials.mp3", name: "audio1" },
      ],
      encodingProperties: { encodedTransposition: "" }
    },
    {
      // Multi-page score whose repeat spans a page boundary: exercises the paged
      // player turning pages.
      title: "multipage",
      path: "multipage",
      meiFile: "music.mei",
      audioFiles: [
        { file: "multipage.mp3", name: "multipage audio" },
      ],
      encodingProperties: { encodedTransposition: "" }
    }
  ]
};


const config = USE_TEST_CONFIG ? testConfig : defaultConfig


function TestSections() {
  const [sections, setSections] = useState<{ label: string; id: string }[]>([])

  const onScoreAnalyzed = (_: number, properties: ScoreProperties) => {
    setSections(properties.sections)
  }

  const ref = useRef<ScoreViewerRef>(null)

  return (
    <div>
      <Space direction="horizontal" size="large" style={{ height: "3vh" }}>
        {sections.map((section) => (
          <Button key={section.id} onClick={() => ref.current?.goToSection(section.id)}>
            {section.label}
          </Button>
        ))}
      </Space>
      <ScoreViewer ref={ref} width="100%" height="89vh" config={config} onScoreAnalyzed={onScoreAnalyzed} />
    </div>
  )
}

function TestExternalSelector() {
  const { t } = useTranslation("common");
  const customSelectorConfig = { ...config, settings: { ...config.settings, showScoreSelector: false } }

  const ref = useRef<ScoreViewerRef>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.selectScore(0)
    }
  }, [ref.current])

  return (
    <div>
      <Space direction="horizontal" size="large" style={{ height: "3vh" }}>
        <Button onClick={() => ref.current?.selectScore(0)}>
          {t('test.score1')}
        </Button>
        <Button onClick={() => ref.current?.selectScore(1)}>
          {t('test.score2')}
        </Button>
        <Button onClick={() => ref.current?.selectScore(2)}>
          {t('test.score3')}
        </Button>
      </Space>
      <ScoreViewer ref={ref} width="100%" height="89vh" config={customSelectorConfig} />
    </div>
  )
}


function TestBasic() {
  return (
    <ScoreViewer width="100%" height="92vh" config={config} />
  )
}

function TestSelector() {
  const { t } = useTranslation("common")
  const [selectedTest, setSelectedTest] = useState<'basic' | 'sections' | 'external'>('basic')

  const renderSelectedTest = () => {
    switch (selectedTest) {
      case 'basic':
        return <TestBasic />
      case 'sections':
        return <TestSections />
      case 'external':
        return <TestExternalSelector />
      default:
        return <TestBasic />
    }
  }

  return (
    <div>
      <div style={{ height: "4vh", padding: '20px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ddd' }}>
        <Space>
          <span>{t('test.selectTest')}</span>
          <Button
            type={selectedTest === 'basic' ? 'primary' : 'default'}
            onClick={() => setSelectedTest('basic')}
          >
            {t('test.basic')}
          </Button>
          <Button
            type={selectedTest === 'sections' ? 'primary' : 'default'}
            onClick={() => setSelectedTest('sections')}
          >
            {t('test.sections')}
          </Button>
          <Button
            type={selectedTest === 'external' ? 'primary' : 'default'}
            onClick={() => setSelectedTest('external')}
          >
            External Selector
          </Button>
        </Space>
      </div>
      {renderSelectedTest()}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TestSelector />
  </StrictMode>
)
