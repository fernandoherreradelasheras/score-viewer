import { RenderedData } from "../hooks/useScoreRenderer";

/**
 * Policy for the cache of rendered pages, which is what makes turning a page instant.
 *
 * Pages are rendered one at a time, and every page rendered (the one the reader asked
 * for and the ones pre-rendered while the browser is idle) is kept as SVG markup. The
 * pre-render fills the cache outwards from the page on screen (`preRenderOrder`), so
 * what the cache holds is a window around the reader.
 *
 * The window is bounded by the size of the markup it holds in bytes with a minimum number
 * of pages.
 *
 * Once the budget is spent, `evictToBudget` gives up the pages furthest from the one
 * being read, measured from the page on screen, never from the page coming in, which
 * during a pre-render is a neighbour of it. `cacheAccepts` decides beforehand whether
 * rendering a page nobody is waiting for is worth it, and answers with the same measure:
 * either there is room for a page, or the page displaces one the reader is further from,
 * which is what re-centres the window after a jump. Sharing the measure is what stops the
 * two from disagreeing and rendering the same page over and over.
 *
 * That leaves one case the policy cannot settle on its own, because it cannot know what a
 * page will weigh before rendering it: a page accepted into what looked like room can
 * still be evicted on arrival. The caller watches for that and stops pre-rendering until
 * the reader moves (`preRenderStalledAt` in ScoreView), which is what bounds the fill
 * whatever the pages weigh.
 */

export const MAX_CACHE_BYTES = 6 * 1024 * 1024;
export const MIN_CACHED_PAGES = 3;   // kept whatever they weigh: the page on screen and both neighbours

type PageCache = Map<number, RenderedData>;

const distanceFrom = (readPage: number) => (page: number) => Math.abs(page - readPage);

export const cacheSizeInBytes = (cache: PageCache) =>
    [...cache.values()].reduce((total, data) => total + (data.svgHTML?.length ?? 0), 0);

export const formatBytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

/** The pages to pre-render, nearest first and forward before back: scores are read forward. */
export const preRenderOrder = (from: number, count: number) => {
    const pages: number[] = [];
    for (let distance = 1; distance < count; distance++) {
        if (from + distance <= count) pages.push(from + distance);
        if (from - distance >= 1) pages.push(from - distance);
    }
    return pages;
};

/** Trims `cache` in place down to the budget, returning the pages given up. */
export const evictToBudget = (cache: PageCache, readPage: number): number[] => {
    const distance = distanceFrom(readPage);
    const evicted: number[] = [];

    while (cache.size > MIN_CACHED_PAGES && cacheSizeInBytes(cache) > MAX_CACHE_BYTES) {
        let furthest: number | undefined;
        for (const cachedPage of cache.keys()) {
            if (furthest === undefined || distance(cachedPage) > distance(furthest)) {
                furthest = cachedPage;
            }
        }
        if (furthest === undefined) break;

        cache.delete(furthest);
        evicted.push(furthest);
    }
    return evicted;
};

/** Whether pre-rendering this page earns its render. See the note on the module. */
export const cacheAccepts = (cache: PageCache, page: number, readPage: number) => {
    if (cache.size === 0) return true;

    // Room is measured in whole pages, sized as the cached ones average: a sliver of
    // budget left is not room, since the page rendered into it would be the furthest from
    // the reader and evicted the moment it arrived.
    const used = cacheSizeInBytes(cache);
    if (used + used / cache.size <= MAX_CACHE_BYTES) return true;

    const distance = distanceFrom(readPage);
    return [...cache.keys()].some(cachedPage => distance(cachedPage) > distance(page));
};
