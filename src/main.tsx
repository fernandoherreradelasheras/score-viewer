import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ScoreViewer from './ScoreViewer'
import testConfig from '../assets/test.json'
import { ScoreViewerConfig } from './types/config'

const USE_TEST_CONFIG = true

// Default test configuration for development
const defaultConfig: ScoreViewerConfig = {
  settings: {
    showDownloadButton: true,
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
    },
    {
      title: "Un imposible me mata",
      path: "",
      audioBaseFile: "test2.mp3",
      meiFile: "test2.mei",
      encodingProperties: { encodedTransposition: "" }
    },
    {
      title: "test 3",
      path: "",
      meiFile: "test3.mei",
      encodingProperties: { encodedTransposition: "" }
    },
    {
      title: "test 4",
      path: "",
      meiFile: "test4.mei",
      encodingProperties: { encodedTransposition: "" }
    },
    {
      title: "test 5",
      path: "",
      meiFile: "test5.mei",
      encodingProperties: { encodedTransposition: "" }
    },
    {
      title: "test 6",
      path: "",
      audioBaseFile: "test6.mp3",
      meiFile: "test6.mei",
      encodingProperties: { encodedTransposition: "" }
    }
  ]
};



/*
function TestWrapper() {
  const [away, setAway] = useState(false)
  const toggleAway = () => setAway(!away)

  return (
    <div>
      <Button type="primary" onClick={toggleAway}>Toggle away</Button>
      { !away ? <ScoreViewer width="100%" height="95vh" config={defaultConfig} /> : <div>Score is away</div>}
    </div>
  )
}
*/


const config = USE_TEST_CONFIG ? testConfig : defaultConfig

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScoreViewer width="100%" height="95vh" config={config} />
  </StrictMode>,
)
