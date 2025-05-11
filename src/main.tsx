import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ScoreViewer, { ScoreViewerConfig } from './ScoreViewer'

// Default test configuration for development
const defaultConfig: ScoreViewerConfig = {
  settings: {
    showDownloadButton: true,
    showFacsimileSection: true,
    showTextSection: true,
    renderTitlesFromMEI: true,
    showScoreSelector: true,
    backgroundColor: "#f6eee3"
  },
  scores: [
    {
      title: "Airecillos mansos",
      audioUrl: "/1-base.mp3",
      audioOverlays: [
        { staff: "3", appLabel: "reconstruction:3:IA:DeepSeek-V3-0324", url: "/1-DeepSeek-V3-0324.mp3" }
      ],

      meiUrl: "/1.mei",
      textUrl: "/test.txt",
      encodingProperties: { encodedTransposition: "-P4" },
      facsimileItems: [
        { name: "Page 32", url: "/page32.jpg" },
        { name: "Page 33", url: "/page33.jpg" }
      ]
    },
    {
      title: "Un imposible me mata",
      audioUrl: "/test2.mp3",
      meiUrl: "/test2.mei",
      encodingProperties: { encodedTransposition: undefined }
    },
    {
      title: "test 3",
      meiUrl: "/test3.mei",
      encodingProperties: { encodedTransposition: undefined }
    },
    {
      title: "test 4",
      meiUrl: "/test4.mei",
      encodingProperties: { encodedTransposition: undefined }
    },
    {
      title: "test 5",
      meiUrl: "/test5.mei",
      encodingProperties: { encodedTransposition: undefined }
    },
    {
      title: "test 6",
      audioUrl: "/test6.mp3",
      meiUrl: "/test6.mei",
      encodingProperties: { encodedTransposition: undefined }
    }
  ]
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScoreViewer width="100%" height="95vh" config={defaultConfig} />
  </StrictMode>,
)
