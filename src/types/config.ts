import { FacsimileItem } from "./score";

// An alternative rendered-audio version of the score. The first entry is played
// by default; the options panel lets the user switch version for the current
// score (not a persistent selection).
export interface ScoreViewerConfigAudioFile {
  file: string;
  name?: string;
  // An AudioSync JSON file that ties a recording to the score. Without it the audio
  // is expected to follow verovio's timing.
  sync?: string;
}

/**
 * @deprecated The poetic text is now read from the MEI `<back>` block, not from
 * external text files. This type is kept transitionally while `tonos.json` still
 * carries `text[]`; it is ignored at runtime.
 */
export interface ScoreViewerConfigScoreText {
  file: string;
  append_to?: string | undefined;
  type?: string | undefined;
  name?: string | undefined;
}


export interface ScoreViewerConfigScore {
  title: string;
  path: string;
  audioFiles?: ScoreViewerConfigAudioFile[] | undefined;
  introductionFile?: string | undefined;
  /** @deprecated Text notes are now read from the MEI `<back>` block; ignored at runtime. */
  textCommentsFile?: string | undefined;
  meiFile: string;
  /** @deprecated Poetic text is now read from the MEI `<back>` block; ignored at runtime. */
  text?: ScoreViewerConfigScoreText[] | undefined;
  facsimileItems?: FacsimileItem[] | undefined;
  encodingProperties: {
    encodedTransposition?: string | undefined;
  };
}

export type InitialTab = "intro" | "text" | "music" | "facsimile";

export interface ScoreViewerConfigSettings {
  showScoreSelector: boolean;
  showTitle: boolean;
  showDownloadButton: boolean;
  showIntroductionSection: boolean;
  showTextSection: boolean;
  showFacsimileSection: boolean;
  showOptions: boolean;
  renderTitlesFromMEI: boolean;
  backgroundColor?: string | undefined;
  basePath: string;
  facsimileImagesPath: string;
  language?: string | "autodetect";
  allowUserLanguageChange: boolean;
  selectorLabel?: string | "work" | "section";
  initialTab?: InitialTab;
  // The score loaded when the viewer mounts: its index in `scores` or its `path`.
  // When given, it is loaded even with `showScoreSelector: false`.
  initialScore?: number | string;
}

export interface ScoreViewerConfig {
  settings: ScoreViewerConfigSettings;
  scores: ScoreViewerConfigScore[];
}
