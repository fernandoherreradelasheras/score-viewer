import { useEffect, useRef } from 'react';
import { isMobile, useMobileOrientation } from 'react-device-detect';
import { ScoreViewContainerRef } from '../ScoreViewContainer';
import { PlayingState, VisualizationOptions } from '../types';
import { LANGUAGE_SESSION_STORAGE_KEY } from '../types';
import { ScoreViewerConfigScore } from '../types/config';

interface UseScoreViewerEffectsProps {
  configLanguage?: string;
  configScores: ScoreViewerConfigScore[];
  configShowScoreSelector: boolean;
  playingState: PlayingState;
  setPlayingState: (state: PlayingState) => void;
  activeTab: string;
  scoreViewContainerRef: React.RefObject<ScoreViewContainerRef | null>;
  showOriginalClefs: boolean | null;
  showReconstructions: { [staff: string]: string };
  onVisualizationOptionsChanged?: (options: VisualizationOptions) => void;
  i18n: any;
  loadAll: (scoreIndex: number) => void;
}

export function useScoreViewerEffects({
  configLanguage,
  configScores,
  configShowScoreSelector,
  playingState,
  setPlayingState,
  activeTab,
  scoreViewContainerRef,
  showOriginalClefs,
  showReconstructions,
  onVisualizationOptionsChanged,
  i18n,
  loadAll
}: UseScoreViewerEffectsProps) {
  const mobileOrientation = useMobileOrientation();
  const hasInitiallyLoaded = useRef(false);

  useEffect(() => {
    if (configLanguage && configLanguage !== "autodetect" && sessionStorage.getItem(LANGUAGE_SESSION_STORAGE_KEY) == null) {
      i18n.changeLanguage(configLanguage);
    }
  }, [configLanguage, i18n]);

  // Initial score loading effect
  useEffect(() => {
    if (configScores.length > 0 && configShowScoreSelector && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      loadAll(0);
    }
  }, []);

  useEffect(() => {
    if (onVisualizationOptionsChanged && showOriginalClefs != null) {
      onVisualizationOptionsChanged({ showOriginalClefs });
    }
  }, [showOriginalClefs]);

  useEffect(() => {
    if (onVisualizationOptionsChanged && Object.keys(showReconstructions).length > 0) {
      onVisualizationOptionsChanged({ showReconstructions });
    }
  }, [showReconstructions]);

  useEffect(() => {
    if (playingState == PlayingState.PLAYING) {
      setPlayingState(PlayingState.STOPPED);
    }
  }, [showReconstructions]);

  useEffect(() => {
    if (isMobile && mobileOrientation.isLandscape && activeTab == "music") {
      setTimeout(() => {
        scoreViewContainerRef.current?.scrollIntoView();
      }, 100);
    }
  }, [mobileOrientation.orientation, activeTab, scoreViewContainerRef]);
}
