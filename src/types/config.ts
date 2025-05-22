import { FacsimileItem } from "./score";

export interface AudioOverlay {
  staff: string;
  appLabel: string;
  file: string;
}

export interface ScoreViewerConfigScoreText  {
  file: string
  append_to?: string
  type?: string
  name?: string
}


export interface ScoreViewerConfigScore  {
  title: string
  path: string
  audioBaseFile?: string
  audioOverlays?: AudioOverlay[]
  introductionFile?: string
  textCommentsFile?: string
  meiFile: string
  text?: ScoreViewerConfigScoreText[]
  facsimileItems?: FacsimileItem[]
  encodingProperties: {
    encodedTransposition?: string
  }
}

export interface ScoreViewerConfigSettings {
    showScoreSelector: boolean
    showDownloadButton: boolean
    showTextSection: boolean
    showFacsimileSection: boolean
    renderTitlesFromMEI: boolean
    backgroundColor?: string
    basePath: string
    facsimileImagesPath: string
}

export interface ScoreViewerConfig  {
  settings: ScoreViewerConfigSettings
  scores:ScoreViewerConfigScore[]
}
