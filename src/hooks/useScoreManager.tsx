import { Score, ScoreProperties, Transposition } from '../types';
import useStore from '../store';
import ScoreProcessor from '../ScoreProcessor';
import ScoreAnalyzer from '../ScoreAnalyzer';
import { ScoreViewerConfig } from '../types/config';
import { useCallback } from 'react';

interface UseScoreManagerProps {
  t: any;
  config: ScoreViewerConfig;
  normalizeFicta: boolean | null;
  onScoreAnalyzed?: ((scoreIndex: number, properties: ScoreProperties) => void) | undefined;
  onFetchScoreError?: ((url: string, error: Error) => void) | undefined;
}

export function useScoreManager({
  t,
  config,
  normalizeFicta,
  onScoreAnalyzed,
  onFetchScoreError
}: UseScoreManagerProps) {
  const scoreCache = useStore.use.scoreCache();
  const setScoreCache = useStore.use.setScoreCache();
  const score = useStore.use.score();
  const setScore = useStore.use.setScore();

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

  const updateScore = (scoreIndex: number, newScore: Score) => {
    if (score) {
      if (newScore == score) {
        return;
      } else {
        fadeOut()
      }
    }

    setScore(newScore);

    if (onScoreAnalyzed) {
      onScoreAnalyzed(scoreIndex, newScore.properties);
    }
  };



  const fetchScore = useCallback(async (scoreIndex: number) => {
    const timestamp = performance.now();
    if (scoreIndex === null) return;

    const scoreDef = config.scores[scoreIndex];
    if (!scoreDef) {
      console.error(`No score definition found for index ${scoreIndex}`);
      return;
    }
    const path = config.settings.basePath + scoreDef.path + "/";
    const meiUrl = path + scoreDef.meiFile;
    const encodingProperties = scoreDef.encodingProperties;
    if (scoreCache[meiUrl]) {
      const cachedScore = scoreCache[meiUrl];
      updateScore(scoreIndex, cachedScore);
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
        const analyzer = new ScoreAnalyzer(t, 0, originalMei);
        const properties = {
          ...analyzer.getScoreProperties(),
          encodedTransposition: encodingProperties.encodedTransposition as Transposition ?? undefined,
        }
        const audioUrl = scoreDef.audioBaseFile && scoreDef.audioBaseFile != "" ? path + scoreDef.audioBaseFile : null
        const audioOverlayTracks = []
        if (scoreDef.audioOverlays) {
          for (const overlay of scoreDef.audioOverlays) {
            audioOverlayTracks.push({
              id: `overlay-staff-${overlay.staff}`,
              label: overlay.appLabel,
              url: path + overlay.file,
              volume: 1
            });
          }
        }


        const editorialItems = analyzer.getEditorial();
        const newScore: Score = {
          url: meiUrl,
          title: scoreDef.title,
          originalMei: originalMei,
          singleVerseMei: generateOneVerseMei(originalMei),
          properties,
          editorialItems,
          audioUrl,
          audioOverlayTracks,
        }

        setScoreCache(
          { [meiUrl]: newScore }
        )
        updateScore(scoreIndex, newScore);
        console.log(`Score fetched from network: ${meiUrl} took ${performance.now() - timestamp}ms`);
      } catch (error: Error | any) {
        if (onFetchScoreError) {
          console.error(`Error fetching score MEI from ${meiUrl}:`, error);
          onFetchScoreError(meiUrl, error);
        }
      }
    }
  }, [config.scores, config.settings.basePath, config.settings.renderTitlesFromMEI, scoreCache, score, setScore, setScoreCache, onScoreAnalyzed, normalizeFicta]);

  const unloadScore = () => {
    setScore(null);
  }

  const hasIntro = useCallback((scoreIndex: number) => {
    const scoreDef = config.scores[scoreIndex];
    return (scoreDef && scoreDef.introductionFile) ? true : false;
  }, [config.scores]);

  const hasText = useCallback((scoreIndex: number) => {
    const scoreDef = config.scores[scoreIndex];
    return (scoreDef && scoreDef.text && scoreDef.text.length > 0) ? true : false;
  }, [config.scores]);


  return { fetchScore, unloadScore, hasIntro, hasText };
}
