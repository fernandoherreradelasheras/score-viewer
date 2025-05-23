import { FacsimileItem } from "./score";

export interface AudioOverlay {
  staff: string;
  appLabel: string;
  file: string;
}

export interface ScoreViewerConfigScoreText  {
  file: string;
  append_to?: string | undefined;
  type?: string | undefined;
  name?: string | undefined;
}


export interface ScoreViewerConfigScore  {
  title: string;
  path: string;
  audioBaseFile?: string | undefined;
  audioOverlays?: AudioOverlay[] | undefined;
  introductionFile?: string | undefined;
  textCommentsFile?: string | undefined;
  meiFile: string;
  text?: ScoreViewerConfigScoreText[] | undefined;
  facsimileItems?: FacsimileItem[] | undefined;
  encodingProperties: {
    encodedTransposition?: string | undefined;
  };
}

export interface ScoreViewerConfigSettings {
    showScoreSelector: boolean;
    showDownloadButton: boolean;
    showTextSection: boolean;
    showFacsimileSection: boolean;
    renderTitlesFromMEI: boolean;
    backgroundColor?: string | undefined;
    basePath: string;
    facsimileImagesPath: string;
}

export interface ScoreViewerConfig  {
  settings: ScoreViewerConfigSettings;
  scores: ScoreViewerConfigScore[];
}
