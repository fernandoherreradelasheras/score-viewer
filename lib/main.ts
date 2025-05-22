import ScoreViewer, { ScoreViewerProps } from '../src/ScoreViewer';
import ScoreView from '../src/ScoreView';
import useStore from '../src/store';
import { Context } from '../src/Context';
import '../src/style.css';
import { Reconstruction, ScoreProperties, VisualizationOptions } from '../src/types';
import { ScoreViewerConfig, ScoreViewerConfigSettings, ScoreViewerConfigScore, ScoreViewerConfigScoreText, AudioOverlay } from '../src/types/config';

export {
  ScoreViewer,
  ScoreView,
  useStore,
  Context
};

export type {
  ScoreViewerConfig,
  ScoreViewerConfigSettings,
  ScoreViewerConfigScore,
  ScoreViewerConfigScoreText,
  AudioOverlay,
  ScoreViewerProps,
  ScoreProperties,
  Reconstruction,
  VisualizationOptions,
};
