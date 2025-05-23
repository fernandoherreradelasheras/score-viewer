import { useEffect } from 'react';
import { Score, ScoreProperties } from '../types';
import useStore from '../store';
import ScoreProcessor from '../ScoreProcessor';
import ScoreAnalyzer from '../ScoreAnalyzer';
import { ScoreViewerConfig } from '../types/config';

interface UseScoreManagerProps {
  config: ScoreViewerConfig;
  currentScoreIdx: number | null;
  normalizeFicta: boolean | null;
  activeTab: string | undefined;
  onScoreAnalyzed?: ((scoreIndex: number, properties: ScoreProperties) => void) | undefined;
}

export function useScoreManager({
  config,
  currentScoreIdx,
  normalizeFicta,
  //activeTab,
  onScoreAnalyzed
}: UseScoreManagerProps) {
  const scoreCache = useStore.use.scoreCache();
  const setScoreCache = useStore.use.setScoreCache();
  const setScore = useStore.use.setScore();
  const setAudioUrl = useStore.use.setAudioUrl();
  const setShowNVerses = useStore.use.setShowNVerses();
  const setNormalizeFicta = useStore.use.setNormalizeFicta();
  const setShowReconstructions = useStore.use.setShowReconstructions();
  const setShowOriginalClefs = useStore.use.setShowOriginalClefs();

  const fetchMei = async (meiUrl: string) => {
    const res = await fetch(meiUrl);
    return res.text();
  };

  const generateOneVerseMei = (mei: string) => {
    const scoreProcessor = new ScoreProcessor(mei);
    if (normalizeFicta) {
      scoreProcessor.addNormalizeFictaFilter();
    }
    scoreProcessor.addNVersesFilter(1);
    return scoreProcessor.filterScore();
  };

  const addFadeOutTransiton = () => {
    const svgElement = document.querySelector(".svg-container svg") as SVGSVGElement | null;
    if (svgElement) {
      svgElement.classList.add("transition-zero-end");
    }
  };

  const updateScore = (scoreIndex: number, newScore: Score, audioUrl?: string) => {
    addFadeOutTransiton();

    // clear options that should not be persistent
    // TODO: define all these settings consistently
    setShowNVerses(null);
    setNormalizeFicta(null);
    setShowReconstructions({}, true);
    setShowOriginalClefs(null);

    setScore(newScore);
    setAudioUrl(audioUrl || null);

    if (onScoreAnalyzed) {
      onScoreAnalyzed(scoreIndex, newScore.properties);
    }
  };

  useEffect(() => {
    (async () => {
      if (currentScoreIdx === null) return;

      const scoreEntry = config.scores[currentScoreIdx];
      if (!scoreEntry) return;

      const scoreDef = config.scores[currentScoreIdx];
      const path = config.settings.basePath + scoreDef.path + "/";
      const meiUrl = path + scoreDef.meiFile;
      const encodingProperties = scoreDef.encodingProperties;
      const audioUrl = path + scoreDef.audioBaseFile;

      if (scoreCache[meiUrl]) {
        const cachedScore = scoreCache[meiUrl];
        updateScore(currentScoreIdx, cachedScore, audioUrl);
      } else {
        const meiString = await fetchMei(meiUrl);

        const scoreProcessor = new ScoreProcessor(meiString);
        if (config.settings.renderTitlesFromMEI) {
          scoreProcessor.addTitlesFilter();
          scoreProcessor.addReonstructionNamesFilter();
        }
        scoreProcessor.addEnsureMeasuresIdFilter();
        scoreProcessor.addEnsureSectionsIdFilter();
        const originalMei = scoreProcessor.filterScore();
        const analyzer = new ScoreAnalyzer(0, originalMei);
        const properties = {
          ...analyzer.getScoreProperties(),
          encodedTransposition: encodingProperties.encodedTransposition ?? undefined,
        };
        const editorialItems = analyzer.getEditorial();
        const newScore: Score = {
          url: meiUrl,
          title: scoreEntry.title,
          originalMei: originalMei,
          singleVerseMei: generateOneVerseMei(originalMei),
          properties: properties,
          editorialItems: editorialItems,
          fascimileItems: scoreEntry.facsimileItems,
        };

        setScoreCache(
          { [meiUrl]: newScore }
        );
        updateScore(currentScoreIdx, newScore, audioUrl);
      }
    })();
  }, [currentScoreIdx]);

  return { updateScore };
}
