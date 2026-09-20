import { useEffect, useRef } from 'react';
import type { i18n as I18n } from 'i18next';
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
  i18n: I18n;
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
    console.log("iniital effect to load score");
    if (configScores.length > 0 && configShowScoreSelector && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      loadAll(0);
    }
    // A one-shot load on mount: the guard above already makes it one, and re-running it
    // whenever the config or the loader identity changes would only repeat that check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (onVisualizationOptionsChanged) {
      onVisualizationOptionsChanged({ showOriginalClefs: showOriginalClefs ?? false });
    }
    // Only a change of the option notifies the host: the callback comes from outside the
    // library, so reacting to its identity would report the same value on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOriginalClefs]);


  useEffect(() => {
    if (isMobile && mobileOrientation.isLandscape && activeTab == "music") {
      setTimeout(() => {
        scoreViewContainerRef.current?.scrollIntoView();
      }, 100);
    }
  }, [mobileOrientation.orientation, mobileOrientation.isLandscape, activeTab, scoreViewContainerRef]);
}
