import { useEffect, useRef } from 'react';
import { isMobile, useMobileOrientation } from 'react-device-detect';
import { ScoreViewContainerRef } from '../ScoreViewContainer';
import { VisualizationOptions } from '../types';
import { LANGUAGE_SESSION_STORAGE_KEY } from '../types';
import { ScoreViewerConfigScore } from '../types/config';

interface UseScoreViewerEffectsProps {
  configLanguage?: string;
  configScores: ScoreViewerConfigScore[];
  configShowScoreSelector: boolean;
  activeTab: string;
  scoreViewContainerRef: React.RefObject<ScoreViewContainerRef | null>;
  showOriginalClefs: boolean | null;
  onVisualizationOptionsChanged?: (options: VisualizationOptions) => void;
  i18n: any;
  loadAll: (scoreIndex: number) => void;
}

export function useScoreViewerEffects({
  configLanguage,
  configScores,
  configShowScoreSelector,
  activeTab,
  scoreViewContainerRef,
  showOriginalClefs,
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
    if (isMobile && mobileOrientation.isLandscape && activeTab == "music") {
      setTimeout(() => {
        scoreViewContainerRef.current?.scrollIntoView();
      }, 100);
    }
  }, [mobileOrientation.orientation, activeTab, scoreViewContainerRef]);
}
