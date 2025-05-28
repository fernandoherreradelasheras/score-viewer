import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ScoreViewer, { ScoreViewerRef } from './ScoreViewer'
import testConfig from '../assets/test.json'
import { ScoreViewerConfig } from './types/config'
import { Button, Space } from 'antd'
import { ScoreProperties } from './types'

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
    backgroundColor: "#f6eee3",
    basePath: "/",
    facsimileImagesPath: "/",
  },
  scores: [
    {
      title: "Airecillos mansos",
      path: "",
      audioBaseFile: "1-base.mp3",
      audioOverlays: [
        { staff: "3", appLabel: "reconstruction:3:IA:DeepSeek-V3-0324", file: "/1-DeepSeek-V3-0324.mp3" }
      ],

      meiFile: "1.mei",
      text: [
        { "file": "test.txt", "append_to": "coplas", "name": "Coplas" },
        { "file": "test3.txt", "type": "estribillo" },


      ],
      encodingProperties: { encodedTransposition: "-P4" },
      facsimileItems: [
        { name: "Page 32", file: "page32.jpg" },
        { name: "Page 33", file: "page33.jpg" }
      ]
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
      <Space direction="horizontal" size="large">
        {sections.map((section) => (
          <Button key={section.id} onClick={() => ref.current?.goToSection(section.id)}>
            {section.label}
          </Button>
        ))}
        </Space>
      <ScoreViewer ref={ref} width="100%" height="95vh" config={config} onScoreAnalyzed={onScoreAnalyzed}/>
    </div>
  )
}


function TestBasic() {
  return (
    <ScoreViewer width="100%" height="95vh" config={config} />
  )
}

const testUi = false ? <TestSections /> : <TestBasic />


createRoot(document.getElementById('root')!).render(
  <StrictMode>
 { testUi  }
  </StrictMode>,
)
