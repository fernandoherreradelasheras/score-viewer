import { Score, ScoreProperties, Transposition } from '../types';
import useStore from '../store';
import ScoreProcessor from '../ScoreProcessor';
import ScoreAnalyzer from '../ScoreAnalyzer';
import { ScoreViewerConfig } from '../types/config';
import { useCallback } from 'react';

interface UseScoreManagerProps {
  config: ScoreViewerConfig;
  normalizeFicta: boolean | null;
  onScoreAnalyzed?: ((scoreIndex: number, properties: ScoreProperties) => void) | undefined;
  onFetchScoreError?: ((url: string, error: Error) => void) | undefined;
}

export function useScoreManager({
  config,
  normalizeFicta,
  onScoreAnalyzed,
  onFetchScoreError
}: UseScoreManagerProps) {
  const scoreCache = useStore.use.scoreCache();
  const setScoreCache = useStore.use.setScoreCache();
  const score = useStore.use.score();
  const setScore = useStore.use.setScore();
  const setAudioUrl = useStore.use.setAudioUrl();
  const setShowNVerses = useStore.use.setShowNVerses();
  const setNormalizeFicta = useStore.use.setNormalizeFicta();
  const setShowReconstructions = useStore.use.setShowReconstructions();
  const setShowOriginalClefs = useStore.use.setShowOriginalClefs();

  const fetchMei = async (meiUrl: string): Promise<string> => {
      const res = await fetch(meiUrl);

    if (!res.ok) {
      throw new Error(`Failed to fetch MEI file: ${res.status} ${res.statusText}`);
    }

    const meiContent = await res.text();


    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(meiContent, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`Invalid XML content: ${parseError.textContent}`);
    }

    // Check if it has a root element
    if (!xmlDoc.documentElement) {
      throw new Error('Invalid XML: No root element found');
    }


    return meiContent;
  };

  const generateOneVerseMei = (mei: string) => {
    const scoreProcessor = new ScoreProcessor(mei);
    if (normalizeFicta) {
      scoreProcessor.addNormalizeFictaFilter();
    }
    scoreProcessor.addNVersesFilter(1);
    return scoreProcessor.filterScore();
  };

  const fadeOut = () => {
    const svgElement = document.querySelector(".svg-container svg") as SVGSVGElement | null;
    if (svgElement) {
      svgElement.classList.add("transition-zero-end");
    }
  };

  const updateScore = (scoreIndex: number, newScore: Score, audioUrl?: string) => {
    if (score) {
      if (newScore == score) {
        return;
      } else {
        fadeOut()
      }
    }
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



  const fetchScore = useCallback((scoreIndex: number) => {
    (async () => {
      if (scoreIndex === null) return;

      const scoreDef = config.scores[scoreIndex];
      if (!scoreDef) {
        console.error(`No score definition found for index ${scoreIndex}`);
        return;
      }
      const path = config.settings.basePath + scoreDef.path + "/";
      const meiUrl = path + scoreDef.meiFile;
      const encodingProperties = scoreDef.encodingProperties;
      const audioUrl = scoreDef.audioBaseFile && scoreDef.audioBaseFile != "" ? path + scoreDef.audioBaseFile : undefined;

      if (scoreCache[meiUrl]) {
        const cachedScore = scoreCache[meiUrl];
        updateScore(scoreIndex, cachedScore, audioUrl);
      } else {
        try {
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
            encodedTransposition: encodingProperties.encodedTransposition as Transposition ?? undefined,
          }

          const editorialItems = analyzer.getEditorial();
          const newScore: Score = {
            url: meiUrl,
            title: scoreDef.title,
            originalMei: originalMei,
            singleVerseMei: generateOneVerseMei(originalMei),
            properties: properties,
            editorialItems: editorialItems,
            fascimileItems: scoreDef.facsimileItems,
          }

          setScoreCache(
            { [meiUrl]: newScore }
          )
          updateScore(scoreIndex, newScore, audioUrl);
        } catch (error: Error | any) {
          if (onFetchScoreError) {
            onFetchScoreError(meiUrl, error);
          }
        }
      }
    })();
  }, [config, scoreCache, setScore, setAudioUrl, setScoreCache, onScoreAnalyzed, normalizeFicta]);

  const unloadScore = () => {
    setScore(null);
    setAudioUrl(null);
  }


  return { fetchScore, unloadScore };
}
