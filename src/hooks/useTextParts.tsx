import { useCallback } from 'react';
import { FetchError, LyricItem, TextPartsCache } from '../types';
import useStore from '../store';
import { ScoreViewerConfig, ScoreViewerConfigScore, ScoreViewerConfigScoreText } from '../types/config';
import { unstable_batchedUpdates } from 'react-dom';

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
    return Promise.reject(new FetchError("Network error",`Failed to fetch text from url ${url} (${error.message})`))
  })
}

const getTitleFromItem = (textItem: ScoreViewerConfigScoreText) => {
  if (textItem.name && textItem.name.length > 0) {
    return textItem.name
  } else if (textItem.type && textItem.type.length > 0) {
    return textItem.type[0].toUpperCase() + textItem.type.substring(1);
  }
  return ""
}


interface UseTextPartsProps {
  config: ScoreViewerConfig;
}

export function useTextParts({
  config,
}: UseTextPartsProps) {
  const textCache = useStore.use.textCache();
  const setTextCache = useStore.use.setTextCache();
  const textComments = useStore.use.textComments();
  const setTextComments = useStore.use.setTextComments();
  const textIntroduction = useStore.use.textIntroduction();
  const setTextIntroduction = useStore.use.setTextIntroduction();
  const textLyrics = useStore.use.textLyrics();
  const setTextLyrics = useStore.use.setTextLyrics();



  const getPath = useCallback((scoreDef: ScoreViewerConfigScore, path: string) => {
    return config.settings.basePath + scoreDef.path + "/" + path
  }, [config.settings.basePath])

  const hasSection = (section: string | undefined | ScoreViewerConfigScoreText[]) => section != undefined && section.length > 0

  const getUrlsForScore = useCallback((scoreDef: ScoreViewerConfigScore) => {
    const path = getPath(scoreDef, "")

    const lyricsUrls = hasSection(scoreDef?.text) ? scoreDef.text!.map((textItem) => path + textItem.file) : null
    const commentsUrl = hasSection(scoreDef?.textCommentsFile) ? path + scoreDef.textCommentsFile : null
    const introductionUrl = hasSection(scoreDef?.introductionFile) ? path + scoreDef.introductionFile : null
    return { lyricsUrls, commentsUrl, introductionUrl }
  }, [getPath])

  const getLyricItemsFromCache = useCallback((scoreDef: ScoreViewerConfigScore) => {
    const lyricItems: LyricItem[] = []
    scoreDef?.text?.forEach((textItem) => {
      const path = getPath(scoreDef, textItem.file)
      const text = textCache[path]
      if (text && text != CACHE_UPDATING_MARK) {
        lyricItems.push({ title: getTitleFromItem(textItem), text: text })
      }
    })
    return lyricItems
  }, [textCache, getPath])



  const fetchTextParts = useCallback((scoreIndex: number) => {

    const scoreDef = config.scores[scoreIndex]

    if (!scoreDef) return;

    const { lyricsUrls, commentsUrl, introductionUrl } = getUrlsForScore(scoreDef)

    const urls =
      [...lyricsUrls ? lyricsUrls : [],
      ...commentsUrl ? [commentsUrl] : [],
      ...introductionUrl ? [introductionUrl] : []]

    if (urls.length == 0) return;

    const cachedUrls = Object.keys(textCache).filter(url => textCache[url] != CACHE_UPDATING_MARK)

    console.log(`Fetching text parts for score ${scoreIndex}: introductionUrl: ${introductionUrl}`)

    // null: when the score does not have the part
    // undefined: when score has it but is missing from the cache of being retrieved
    if (commentsUrl) {
      setTextComments(cachedUrls.includes(commentsUrl) ? textCache[commentsUrl] : undefined)
    } else {
      setTextComments(null)
    }
    if (introductionUrl) {
      setTextIntroduction(cachedUrls.includes(introductionUrl) ? textCache[introductionUrl] : undefined)
    } else {
      setTextIntroduction(null)
    }
    if (lyricsUrls) {
      setTextLyrics(lyricsUrls.every(u => cachedUrls.includes(u)) ? getLyricItemsFromCache(scoreDef) : undefined, true)
    } else {
      setTextLyrics(null, true)
    }

    const urlsToUpdate = urls.filter(url => !Object.keys(textCache).includes(url))
    if (urlsToUpdate.length == 0) return;

    const updatingCache: TextPartsCache = {}
    urlsToUpdate.forEach((url) => {
      updatingCache[url] = CACHE_UPDATING_MARK
    })
    setTextCache(updatingCache, false)

    urlsToUpdate.forEach((url) => {
      getText(url).then((res: string) => {

        unstable_batchedUpdates(() => {
          setTextCache({ [url]: res }, false)
          if (commentsUrl && url == commentsUrl) {
            setTextComments(res)
          } else if (introductionUrl && url == introductionUrl) {
            setTextIntroduction(res)
          } else if (lyricsUrls && lyricsUrls.includes(url)) {
            const textItem = scoreDef.text?.find((textItem) => url == getPath(scoreDef, textItem.file))
            if (textItem)
              setTextLyrics([{ title: getTitleFromItem(textItem), text: res }], false)
          }
        })
      }, (error: FetchError) => {
        console.log(`${error.type}: ${error.message}`)
         unstable_batchedUpdates(() => {
          setTextCache({ [url]: error }, false)
          if (commentsUrl && url == commentsUrl) {
            setTextComments(error)
          } else if (introductionUrl && url == introductionUrl) {
            setTextIntroduction(error)
          } else if (lyricsUrls && lyricsUrls.includes(url)) {
            const textItem = scoreDef.text?.find((textItem) => url == getPath(scoreDef, textItem.file))
            if (textItem)
              setTextLyrics([{ title: getTitleFromItem(textItem), text: error }], false)
          }
        })
      })
    })
  }, [getPath, config.scores, textCache, getLyricItemsFromCache, setTextCache, setTextComments, setTextIntroduction, setTextLyrics])

  return { fetchTextParts, textIntroduction, textLyrics, textComments }
}
