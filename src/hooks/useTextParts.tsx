import { useCallback } from 'react';
import { FetchError } from '../types';
import useStore from '../store';
import { ScoreViewerConfig, ScoreViewerConfigScore } from '../types/config';

const CACHE_UPDATING_MARK = "updating"

const getText = async (url: string): Promise<string> => {
  return fetch(url).then((res) => {
    const contentType = res.headers.get('Content-Type')
    if (res.ok && contentType && (contentType.includes('text/markdown') || contentType.includes('text/plain'))) {
      return res.text()
    } else {
      const error = new FetchError("Content error", `Unsupported content type from url ${url} (${contentType})`);
      return Promise.reject(error)
    }
  }, (error) => {
    console.error(`Error fetching text from ${url}:`, error);
    return Promise.reject(new FetchError("Network error", `Failed to fetch text from url ${url} (${error.message})`))
  })
}

interface UseTextPartsProps {
  config: ScoreViewerConfig;
}


// The only external text file now is the introduction text, as poem text and comments are now
// extracted from the <back> section in the MEI files.
export function useTextParts({
  config,
}: UseTextPartsProps) {
  const textCache = useStore.use.textCache();
  const setTextCache = useStore.use.setTextCache();
  const textIntroduction = useStore.use.textIntroduction();
  const setTextIntroduction = useStore.use.setTextIntroduction();

  const getPath = useCallback((scoreDef: ScoreViewerConfigScore, path: string) => {
    return config.settings.basePath + scoreDef.path + "/" + path
  }, [config.settings.basePath])

  const hasSection = (section: string | undefined) => section != undefined && section.length > 0

  const fetchIntroduction = useCallback(async (introductionUrl: string | null) => {
    if (!introductionUrl) {
      setTextIntroduction(null)
      return
    }
    const cached = textCache[introductionUrl]
    if (cached === CACHE_UPDATING_MARK) {
      setTextIntroduction(undefined)
      return
    }
    if (cached !== undefined) {
      setTextIntroduction(cached)
      return
    }
    setTextIntroduction(undefined)
    setTextCache({ [introductionUrl]: CACHE_UPDATING_MARK }, false)
    try {
      const res = await getText(introductionUrl)
      setTextCache({ [introductionUrl]: res }, false)
      setTextIntroduction(res)
    } catch (e) {
      const error = e as FetchError
      console.log(`${error.type}: ${error.message}`)
      setTextCache({ [introductionUrl]: error }, false)
      setTextIntroduction(error)
    }
  }, [textCache, setTextCache, setTextIntroduction])

  const fetchTextParts = useCallback(async (scoreIndex: number) => {
    const scoreDef = config.scores[scoreIndex]
    if (!scoreDef) return

    const introductionUrl = hasSection(scoreDef.introductionFile) ? getPath(scoreDef, scoreDef.introductionFile!) : null
    console.log(`Fetching text parts for score ${scoreIndex}: introductionUrl: ${introductionUrl}`)

    await fetchIntroduction(introductionUrl)
  }, [config.scores, getPath, fetchIntroduction])

  return { fetchTextParts, textIntroduction }
}
