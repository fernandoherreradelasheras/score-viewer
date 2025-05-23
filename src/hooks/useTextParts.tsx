import { useCallback, useEffect, useMemo } from 'react';
import { LyricItem, TextPartsCache } from '../types';
import useStore from '../store';
import { ScoreViewerConfig, ScoreViewerConfigScore, ScoreViewerConfigScoreText } from '../types/config';
import { unstable_batchedUpdates } from 'react-dom';

const CACHE_UPDATING_MARK = "updating"

const getText = async (url: string) => {
  return fetch(url).then((res) => {
    const contentType = res.headers.get('Content-Type')
    if (contentType && (contentType.includes('text/markdown') || contentType.includes('text/plain'))) {
      return res.text()
    } else {
      return null
    }
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
  currentScoreIdx: number | null;
  onTextPartChanged?: ((scoreIndex: number, partName: string, part: LyricItem[] | string | null | undefined) => void) | undefined;
}

export function useTextParts({
  config,
  currentScoreIdx,
  onTextPartChanged
}: UseTextPartsProps) {
  const textCache = useStore.use.textCache();
  const setTextCache = useStore.use.setTextCache();
  const textComments = useStore.use.textComments();
  const setTextComments = useStore.use.setTextComments();
  const textIntroduction = useStore.use.textIntroduction();
  const setTextIntroduction = useStore.use.setTextIntroduction();
  const textLyrics = useStore.use.textLyrics();
  const setTextLyrics = useStore.use.setTextLyrics();


  const scoreDef = useMemo(() => {
    if (currentScoreIdx === null || config === null) {
      return null
    } else {
      return config.scores[currentScoreIdx]
    }
  }, [currentScoreIdx, config])

  const getPath = useCallback((scoreDef: ScoreViewerConfigScore, path: string) => {
    return config.settings.basePath + scoreDef.path + "/" + path
  }, [currentScoreIdx, config])

  const hasSection = (section: string | undefined | ScoreViewerConfigScoreText[]) => section != undefined && section.length > 0

  const getUrlsForScore = useCallback((scoreDef: ScoreViewerConfigScore) => {
    const path = getPath(scoreDef, "")

    const lyricsUrls = hasSection(scoreDef?.text) ? scoreDef.text!.map((textItem) => path + textItem.file) : null
    const commentsUrl = hasSection(scoreDef?.textCommentsFile) ? path + scoreDef.textCommentsFile : null
    const introductionUrl = hasSection(scoreDef?.introductionFile) ? path + scoreDef.introductionFile : null
    return { lyricsUrls, commentsUrl, introductionUrl }
  }, [getPath])

  const getLyricItemsFromCache = useCallback(() => {
    const lyricItems: LyricItem[] = []
    scoreDef?.text?.forEach((textItem) => {
      const path = getPath(scoreDef, textItem.file)
      const text = textCache[path]
      if (text && text != CACHE_UPDATING_MARK) {
        lyricItems.push({ title: getTitleFromItem(textItem), text: text })
      }
    })
    return lyricItems
  }, [textCache, scoreDef, getPath])



  useEffect(() => {

    if (!scoreDef || currentScoreIdx == null) return;

    const { lyricsUrls, commentsUrl, introductionUrl } = getUrlsForScore(scoreDef)

    const urls =
      [...lyricsUrls ? lyricsUrls : [],
      ...commentsUrl ? [commentsUrl] : [],
      ...introductionUrl ? [introductionUrl] : []]

    if (urls.length == 0) return;

    const cachedUrls = Object.keys(textCache).filter(url => textCache[url] != CACHE_UPDATING_MARK)

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
      setTextLyrics(lyricsUrls.every(u => cachedUrls.includes(u)) ? getLyricItemsFromCache() : undefined, true)
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
      getText(url).then((res) => {
        if (!res) {
          return
        }

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
      })
    })
  }, [scoreDef]);

  // Callback notifications for those consumers handling text parts on their own
  useEffect(() => {
    if (currentScoreIdx && onTextPartChanged) {
      onTextPartChanged(currentScoreIdx, "introduction", textIntroduction)
    }
  }, [textIntroduction])

  useEffect(() => {
    if (currentScoreIdx && onTextPartChanged) {
      onTextPartChanged(currentScoreIdx, "comments", textComments)
    }
  }, [textComments])

    useEffect(() => {
    if (currentScoreIdx && onTextPartChanged) {
      onTextPartChanged(currentScoreIdx, "lyrics", textLyrics)
    }
  }, [textLyrics])


  return { textIntroduction, textLyrics, textComments }
}
