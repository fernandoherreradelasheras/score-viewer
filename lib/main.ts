import '../src/i18n';
import ScoreViewer from '../src/ScoreViewer';
import type { ScoreViewerProps } from '../src/ScoreViewer';
import type { ScoreViewerRef } from '../src/ScoreViewer';
import ScoreView from '../src/ScoreView';
import useStore from '../src/store';
import { Context } from '../src/Context';
import '../src/style.css';
import { Reconstruction, ScoreProperties, VisualizationOptions, LyricItem, Score, TextParts } from '../src/types';
import { ScoreViewerConfig, ScoreViewerConfigSettings, ScoreViewerConfigScore, ScoreViewerConfigScoreText, AudioOverlay } from '../src/types/config';
import { useScoreManager } from '../src/hooks/useScoreManager';
import { useTextParts } from '../src/hooks/useTextParts';


export { ScoreViewer as ScoreViewer };
export { ScoreView, useStore, Context };
export { useScoreManager, useTextParts }; // TODO: are these hooks really needed?

export type {
  ScoreViewerProps,
  ScoreViewerRef,
  ScoreViewerConfig,
  ScoreViewerConfigSettings,
  ScoreViewerConfigScore,
  ScoreViewerConfigScoreText,
  AudioOverlay,
  Score,
  ScoreProperties,
  Reconstruction,
  VisualizationOptions,
  LyricItem,
  TextParts
};

export default ScoreViewer;
