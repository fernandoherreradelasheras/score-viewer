import { useCallback, useMemo } from 'react';
import { VerovioOptions } from 'verovio';
import ScoreAnalyzer from '../ScoreAnalyzer';

import {
  TimeMapEvent,
  Transition,
  Action,
  LoadConfig,
  LoadAutoScrollConfig,
  RenderConfig,
  RenderAutoScrollConfig,
  renderAction,
  renderAutoScrollAction,
  EDITORIAL_ALL_TAGS,
  EDITORIAL_SELECTION_TAGS,
} from '../types';
import { RenderedData } from './useScoreRenderer';
import useStore from '../store';
import { EDITORIAL_COLORS } from '../types/colors';



// Global readings are marked with @type, never @label: verovio renders @label as an
// SVG <title>, which the browser shows as a tooltip, so the token leaked to the user.
const APP_CLEFS_READING = {
  option: 'clefs',
  app_attr_name: 'type',
  app_attr_value: 'app_clefs',
  svg_extra_attributes: ['rdg@type', 'lem@type'],
  svg_query_selector: '.app:has(> :is(.lem, .rdg)[data-type="app_clefs"])'
}
const APP_HARMONIC_ANALYSIS_READING = {
  option: 'analysis',
  app_attr_name: 'type',
  app_attr_value: 'dissonant_analysis',
  svg_extra_attributes: ['rdg@type', 'lem@type'],
  svg_query_selector: '.app:has(> :is(.lem, .rdg)[data-type="dissonant_analysis"])'
}

const GLOBAL_APP_READINGS = [
  APP_CLEFS_READING,
  APP_HARMONIC_ANALYSIS_READING
];


// `rdg@class` / `lem@class` carry the variant group a reading belongs to, so the
// rendered SVG can be asked which <app> elements move together with a given one.
const EXTRA_SVG_ATTRIBUTES = [...new Set([
  "measure@n", "staff@n", "clef@corresp", "verse@n", "note@dur", "rdg@class", "lem@class",
  ...GLOBAL_APP_READINGS.flatMap(r => r.svg_extra_attributes)
])];



const AUTO_SCROLL_RENDERING_WIDTH_LIMIT = 60000;

/**
 * Workaround for https://github.com/rism-digital/verovio/issues/4240
 *
 * Since 5.4.0 `Doc::GetAdjustedDrawingPageHeight()` multiplies the content height by
 * `scale / 100` when `scaleToPageSize` is on, and that value is what `shrinkToFit` is
 * tested against. With our default scale of 50 the check only fires once the content
 * is more than twice the page height, so a system that does not fit is drawn past the
 * bottom of the page instead of being scaled down. The issue was closed without a fix.
 *
 * `scaleToPageSize` lays out over `pageSize * 1000 / scale` verovio units, so scaling
 * the page up by `100 / scale` and rendering at scale 100 gives byte-identical
 * pagination and layout while leaving the buggy factor at 1. Only the px dimensions of
 * the root <svg> grow, and those are replaced by 100% before the SVG is inserted.
 */
const shrinkToFitPageSize = (width: number, height: number, scale: number) => ({
  pageWidth: Math.round(width * 100 / scale),
  pageHeight: Math.round(height * 100 / scale),
  scale: 100,
});

const verovioBaseOptions: VerovioOptions = {
  breaks: 'auto',
  footer: 'none',
  header: 'none',
  pageMarginBottom: 0,
  pageMarginTop: 16,
  pageMarginLeft: 16,
  pageMarginRight: 16,
  bottomMarginHarm: 0.0,
  scaleToPageSize: true,
  shrinkToFit: true,
  spacingLinear: 0.25,
  spacingNonLinear: 0.6,
  mdivAll: true,
  svgHtml5: false,
  svgViewBox: false,
  svgRemoveXlink: false,
  svgBoundingBoxes: true,
  svgContentBoundingBoxes: true,
  lyricElision: "regular",
  lyricTopMinMargin: 4.0,
  lyricVerseCollapse: true,
  smuflTextFont: "embedded",
  expand: "",
  expandNever: true, // avoid verovio expand repeats for the timemap
  expandAlways: false
};

/**
 * Whether an action needs the spinner: the ones that carry a transition of their own
 * already tell the reader that something is happening.
 */
export const shouldShowSpinner = (action: Action): boolean => {
  const config = action.config as any;
  return !(config.transition || config.postLoadTransition);
};

// Helper to get the appropriate CSS class for a transition
const initialClassForTransition = (transition: Transition) => {
  switch (transition) {
    case Transition.FADE_OUT:
      return "full-opacity";
    case Transition.FADE_IN:
      return "zero-opacity";
  }
};


export interface RenderActionResult {
  newSvg: RenderedData;
  loadedPagesCount: number;
  scale: number;
  renderPage: number;
}

interface RenderAutoScrollResult {
  newSvg: RenderedData;
}

interface ScoreActionsConfig {
  verovio: any; // Verovio toolkit instance
}

/**
 * Annotate each `on` with the staff its note belongs to, so the player can pick a
 * colour and an animation per voice. The staff comes from a page-independent map
 * rather than from the SVG, which only holds the current page.
 */
const resolveTimemapAnimations = (timemap: TimeMapEvent[], noteStaffMap: Record<string, string>): TimeMapEvent[] =>
  timemap.map(e => ({
    ...e,
    stavesOn: e.on?.map(id => parseInt(noteStaffMap[id]) || 1)
  }));

const buildAppOptions = (appOptions: string[], showOriginalClefs: boolean, showMusicAnalysis: boolean) => {
  return [
    ...appOptions,
    ...showOriginalClefs ? [`./rdg[contains(@${APP_CLEFS_READING.app_attr_name}, '${APP_CLEFS_READING.app_attr_value}')]`] : [],
    ...showMusicAnalysis ? [`./rdg[contains(@${APP_HARMONIC_ANALYSIS_READING.app_attr_name}, '${APP_HARMONIC_ANALYSIS_READING.app_attr_value}')]`] : []
  ]
}




/**
 * Stamp each <app> with the variant group its readings classify under, so the reader's
 * hover and the open dialog can light every <app> that one editorial decision moves.
 * The group only reaches the SVG through the rendered <lem>/<rdg>, as `data-class`
 * alongside whatever else @class carries, and only a term declared in <classDecls>
 * names a group: hence the score's own categories decide which token is the one.
 */
const setSvgGroupsForEditorial = (svgElement: SVGElement, categoryIds: Set<string>) => {
  if (categoryIds.size == 0) {
    return;
  }
  svgElement.querySelectorAll(".app:not(.content-bounding-box):not(.bounding-box)").forEach(app => {
    const group = [...app.querySelectorAll("[data-class]")]
      .flatMap(e => (e.getAttribute("data-class") || "").split(/\s+/))
      .map(token => token.replace(/^#/, ""))
      .find(token => categoryIds.has(token));
    if (group) {
      (app as SVGElement).dataset.group = group;
    }
  });
}


const setSvgClassesForEditorial = (svgElement: SVGElement) => {
  // Global apps (original clefs / harmonic analysis) and everything inside them are
  // excluded from editorial highlighting.
  const globalApps = new Set(
    GLOBAL_APP_READINGS.flatMap(r => [...svgElement.querySelectorAll(r.svg_query_selector)])
  )
  globalApps.forEach(app => app.classList.add("mei-global-app"))

  EDITORIAL_ALL_TAGS.forEach((tag: string) => {
    const color = EDITORIAL_COLORS[tag as keyof typeof EDITORIAL_COLORS];
    svgElement
      .querySelectorAll(`.${tag}:not(.content-bounding-box):not(.bounding-box)`)
      .forEach(e => {
        const el = e as SVGGElement;
        const app = el.closest(".app");
        if (app && globalApps.has(app)) return;
        el.classList.add("mei-editorial");
        if (EDITORIAL_SELECTION_TAGS.includes(tag)) {
          el.classList.add("mei-editorial-container");
        }
        if (color) {
          el.style.setProperty("--editorial-color", color);
        }
      });
  });
}

/**
 * Custom hook that manages score action execution
 */
export default function useScoreActions({
  verovio,
}: ScoreActionsConfig) {

  const targetWidth = useStore.use.targetWidth();
  const targetHeight = useStore.use.targetHeight();
  const appOptions = useStore.use.appOptions();
  const choiceOptions = useStore.use.choiceOptions();
  const substOptions = useStore.use.substOptions();
  const showOriginalClefs = useStore.use.showOriginalClefs();
  const showMusicAnalysis = useStore.use.showMusicAnalysis();
  const measureNumberInterval = useStore.use.measureNumberInterval();
  const setScoreLayout = useStore.use.setScoreLayout();
  const setElementPages = useStore.use.setElementPages();
  const score = useStore.use.score();
  const selectedAudioIndex = useStore.use.selectedAudioIndex();


  const getSectionMap = async (analyzer: ScoreAnalyzer) => {
    const sections = analyzer.getSections()
    const sectionsMap: Record<string, number> = {}
    for (const section of sections) {
      const sectionId = section.id;
      const sectionPage = await verovio.getPageWithElement(sectionId);
      if (sectionId && sectionPage) {
        sectionsMap[sectionId] = sectionPage
      }
    }
    return sectionsMap
  }


  const loadAndBuildTimemap = useCallback(async (meiStr: string): Promise<TimeMapEvent[]> => {
    await verovio.loadData(meiStr);
    const timemap = await verovio.renderToTimemap({ includeMeasures: true });
    return timemap;
  }, [verovio]);

  // The verovio options that depend on the user's editorial/display settings: for a
  // given MEI, page size and scale, these are what change the rendered output. It is
  // exposed so callers can tell whether a settings change needs a reload at all, and
  // it is the same object performLoadAction applies, so a new option cannot be added
  // in one place and forgotten in the other.
  // Both readings are dropped on scores that do not encode them: the query would match
  // nothing anyway, and leaving it out keeps the options identical so toggling either
  // one on such a score does not force a reload.
  const scoreRenderOptions = useMemo(() => ({
    appXPathQuery: buildAppOptions(
      appOptions,
      (showOriginalClefs && score?.properties?.hasOriginalClefs) || false,
      (showMusicAnalysis && score?.properties?.hasHarmonicAnalysis) || false
    ),
    choiceXPathQuery: choiceOptions,
    substXPathQuery: substOptions,
    mnumInterval: measureNumberInterval ?? 0,
  }), [appOptions, showOriginalClefs, showMusicAnalysis, choiceOptions, substOptions, measureNumberInterval,
    score?.properties?.hasOriginalClefs, score?.properties?.hasHarmonicAnalysis]);

  /**
   * Execute the load action - prepares Verovio with options and loads the MEI data
   */
  const performLoadAction = useCallback(async (config: LoadConfig) => {
    if (!verovio) return null;

    const { postLoadTransition, meiStr, page, scale, restorePositionForAchor, scoreUrl } = config;
    const loadedWidth = targetWidth;
    const loadedHeight = targetHeight;

    console.log(`loading score: page=${page} pageWidth=${loadedWidth}, pageHeight=${loadedHeight}, scale=${scale} restorePositionForAchor=${restorePositionForAchor}, showMusicAnalysis=${showMusicAnalysis} showOriginalClefs=${showOriginalClefs}`);

    const options: VerovioOptions = {
      ...verovioBaseOptions,
      adjustPageWidth: false,
      adjustPageHeight: false,
      landscape: false,
      svgAdditionalAttribute: EXTRA_SVG_ATTRIBUTES,
      ...scoreRenderOptions,
      ...shrinkToFitPageSize(loadedWidth, loadedHeight, scale),
      transpose: config.transposition != null ? config.transposition : "",
    };

    console.log("VerovioOptions: ", options)


    try {
      const startTime = performance.now();

      await verovio.setOptions(options);
      const timemap = await loadAndBuildTimemap(meiStr);
      console.log("timemap duration: ", timemap.slice(-1)[0].tstamp)

      const loadedPagesCount = await verovio.getPageCount();

      // Build the section -> page map only after the data is loaded and
      // paginated.
      const analyzer = new ScoreAnalyzer(0, meiStr);
      const sectionMap = await getSectionMap(analyzer);

      let renderPage = undefined;
      if (restorePositionForAchor) {
        let pageForMeasureOnView = await verovio?.getPageWithElement(restorePositionForAchor);
        if (pageForMeasureOnView != null && pageForMeasureOnView > 0) {
          renderPage = pageForMeasureOnView;
        }
      }
      if (!renderPage && page) {
        renderPage = (page <= loadedPagesCount) ? page : loadedPagesCount;
      }

      setScoreLayout({ currentPage: renderPage, pageCount: loadedPagesCount, sectionPageMap: sectionMap });

      console.log(`[useScoreActions] performLoadAction for ${loadedPagesCount} pages completed in ${(performance.now() - startTime).toFixed(2)}ms`);


      return renderAction({
        scoreUrl,
        transition: postLoadTransition,
        loadedHeight,
        loadedWidth,
        renderPage,
        scale,
        loadedPagesCount,
        timemap: await resolveTimemap(timemap)
      });
    } catch (error) {
      console.error("Error performing load action:", error);
      return null;
    }
  }, [
    verovio,
    targetWidth,
    targetHeight,
    scoreRenderOptions,
    score,
    selectedAudioIndex,
    loadAndBuildTimemap
  ]);

  /**
   * Execute the load auto-scroll action - prepares Verovio for auto-scroll mode
   */
  const performLoadAutoScrollAction = useCallback(async (config: LoadAutoScrollConfig) => {
    if (!verovio) return null;

    const { height, meiStr } = config;

    console.log(`loading score: mode=autoscroll height=${height}`);


    const options: VerovioOptions = {
      ...verovioBaseOptions,
      adjustPageWidth: true,
      adjustPageHeight: true,
      svgViewBox: true,
      svgAdditionalAttribute: EXTRA_SVG_ATTRIBUTES,
      appXPathQuery: buildAppOptions(appOptions, (showOriginalClefs && score?.properties?.hasOriginalClefs) || false, false),
      choiceXPathQuery: choiceOptions,
      substXPathQuery: substOptions,
      pageHeight: height,
      pageWidth: AUTO_SCROLL_RENDERING_WIDTH_LIMIT,
      scale: 100,
      transpose: config.transposition != null ? config.transposition : "",
    };

    try {

      await verovio.setOptions(options);
      const timemap = await loadAndBuildTimemap(meiStr);
      console.log("timemap duration: ", timemap.slice(-1)[0].tstamp)
      return renderAutoScrollAction({ height, timemap: await resolveTimemap(timemap) });
    } catch (error) {
      console.error("Error performing auto-scroll load action:", error);
      return null;
    }
  }, [
    verovio,
    appOptions,
    choiceOptions,
    substOptions,
    showOriginalClefs,
    showMusicAnalysis,
    measureNumberInterval,
    score,
    selectedAudioIndex,
    loadAndBuildTimemap
  ]);

  // Merge a single concrete tied pair so the second note stays highlighted from
  // the first note's onset until the second note's release (a sustained tie).
  const mergeTiePair = (timemap: TimeMapEvent[], first: string, second: string) => {
    const firstOnIndex = timemap.findIndex(e => e.on != null && e.on.includes(first));
    const firstOffIndex = timemap.findIndex(e => e.off != null && e.off.includes(first));
    const secondOnIndex = timemap.findIndex(e => e.on != null && e.on.includes(second));
    const secondOffIndex = timemap.findIndex(e => e.off != null && e.off.includes(second));
    if (firstOnIndex == -1 || firstOffIndex == -1 || secondOnIndex == -1 || secondOffIndex == -1) {
      return;
    }
    timemap[firstOnIndex].on!.push(second)
    timemap[firstOffIndex].off = timemap[firstOffIndex].off!.filter(id => id != first)
    timemap[secondOnIndex].on = timemap[secondOnIndex].on!.filter(id => id != second)
    timemap[secondOffIndex].off!.push(first)
  }

  const mergeTimemapTies = (timemap: TimeMapEvent[], tiedNotes: { first: string; second: string; }[]) => {
    const newTimeMap = timemap.map(e => { return { ...e } as TimeMapEvent });
    for (const { first, second } of tiedNotes) {

      const firstIds = new Set<string>();
      for (const e of newTimeMap) {
        for (const id of e.on ?? []) {
          if (id === first) firstIds.add(id);
        }
      }
      for (const firstId of firstIds) {
        mergeTiePair(newTimeMap, firstId, second);
      }
    }
    return newTimeMap
  }



  const resolveTimemap = useCallback(async (timemap: TimeMapEvent[]): Promise<TimeMapEvent[]> => {
    const mei = await verovio.getMEI()
    const analyzer = new ScoreAnalyzer(0, mei)
    return mergeTimemapTies(timemap, analyzer.getTiedNotes())
  }, [verovio]);



  /**
   * Render the score as a standard page
   */
  const performRenderAction = useCallback(async (config: RenderConfig, element: HTMLDivElement): Promise<RenderActionResult | null> => {
    if (!verovio || !element) return null;

    const { transition, loadedHeight, loadedWidth, renderPage, scale, loadedPagesCount, scoreUrl, timemap } = config;
    console.log(`Rendering score: mode=normal page=${renderPage} scale=${scale} transition=${transition}`);
    const startTime = performance.now();

    try {

      const svgStart = performance.now();
      // The px size of the root svg is the compensated page size, not the container
      // one (see shrinkToFitPageSize), so it is matched by shape rather than by value.
      const svgData = (await verovio.renderToSVG(renderPage))
        .replace(/^<svg width="\d+px" height="\d+px"/, '<svg width="100%" height="100%"');
      const svgTime = performance.now() - svgStart;

      const domStart = performance.now();
      element.innerHTML = svgData;
      const svgElement = element.querySelector("svg") as SVGSVGElement | null;
      if (!svgElement) {
        console.log("Error rendering page: no svg element found");
        return null;
      }

      setSvgClassesForEditorial(svgElement)
      setSvgGroupsForEditorial(svgElement, new Set(Object.keys(score?.properties?.categories ?? {})))

      setElementPages(
        [...svgElement.querySelectorAll(".note[id], .rest[id], .chord[id]")].map(e => e.id),
        renderPage
      );

      // A transition starts from a hidden score, which ScoreView then fades in. Without
      // one the score is left visible: it replaces a score that was never faded out, and
      // fading it in would be a flash of nothing in the middle of, say, picking a reading.
      if (transition != undefined) {
        svgElement.style.opacity = '0';
      }

      if (svgElement.classList.contains("transition-zero-end")) {
        svgElement.classList.remove("transition-zero-end");
      }
      if (transition != undefined) {
        svgElement.classList.add("with-transition", initialClassForTransition(transition));
        setTimeout(() => {
          svgElement.classList.add("transition-end");
        }, 0);
      }
      const domTime = performance.now() - domStart;

      const firstMeasureId = svgElement.querySelector(".measure[id]")?.id ?? null;

      const resolvedTimemap = resolveTimemapAnimations(timemap, score?.properties.noteStaffMap ?? {});

      const newSvg: RenderedData = {
        id: svgElement.id,
        scoreUrl: scoreUrl,
        scale: scale,
        timemap: resolvedTimemap,
        anchorElement: firstMeasureId,
        page: renderPage,
        height: loadedHeight,
        width: loadedWidth,
      };

      const duration = performance.now() - startTime;
      console.log(`[useScoreActions] performRenderAction took ${duration.toFixed(0)}ms (renderToSVG ${svgTime.toFixed(0)}ms, DOM manipulation ${domTime.toFixed(0)}ms)`);

      return { newSvg, loadedPagesCount, scale, renderPage } as RenderActionResult;
    } catch (error) {
      console.log(`Error rendering page: ${error}`);
      return null;
    }
  }, [verovio, resolveTimemap, score, setElementPages]);

  /**
   * Render the score for auto-scrolling
   */
  const performRenderAutoScrollAction = useCallback(async (config: RenderAutoScrollConfig, element: HTMLDivElement): Promise<RenderAutoScrollResult | null> => {
    if (!verovio || !element) return null;

    const { height, timemap } = config;
    console.log(`Rendering score: mode=autoscroll height=${height}`);


    try {
      const svgData = await verovio.renderToSVG(1);

      const match = svgData.match(/svg viewBox="0 0 (\d+) \d+"/);
      const renderedWidth = match ? Math.round(parseInt(match[1])) : AUTO_SCROLL_RENDERING_WIDTH_LIMIT;
      const renderedHeight = Math.round(height);

      element.innerHTML = svgData.replace("<svg", `<svg class="auto-scroll" style="will-change: transform; backface-visibility: hidden; overflow: collapse; width: ${renderedWidth}px; height: ${renderedHeight}px;" `)
      //width="${renderedWidth}" height="${renderedHeight}" \
      //          .replace('<g class="page-margin" transform="translate(0, 0)">', '<g class="page-margin" transform="translate(0, 0)"><animateTransform attributeName="transform" attributeType="XML" begin="0s" dur="20s" type="translate"   from="0"    to="-16000"   />')

      element.style.height = `${renderedHeight}px`;

      const resolvedTimemap = resolveTimemapAnimations(timemap, score?.properties.noteStaffMap ?? {});

      const newSvg: RenderedData = {
        id: "svg-auto-scrolling",
        scale: 100, // Auto-scroll uses fixed scale
        scoreUrl: "",
        timemap: resolvedTimemap,
        width: renderedWidth,
        height: renderedHeight,
        anchorElement: null,
        page: 1
      };

      return { newSvg };
    } catch (error) {
      console.log(`Error rendering auto-scroll page: ${error}`);
      return null;
    }
  }, [verovio]);

  /**
   * Execute an action based on its type
   */
  const executeAction = useCallback(async (action: Action, svgContainerElement: HTMLDivElement) => {
    if (!verovio || !svgContainerElement) {
      console.log("Cannot execute action - verovio or container not ready");
      return { success: false, nextAction: null, result: null, showSpinner: false };
    }

    const showSpinner = shouldShowSpinner(action);

    try {
      if (action.type === "load") {
        const nextAction = await performLoadAction(action.config as LoadConfig);
        return {
          success: nextAction !== null,
          nextAction,
          result: null,
          showSpinner
        };
      }
      else if (action.type === "loadAutoScroll") {
        const nextAction = await performLoadAutoScrollAction(action.config as LoadAutoScrollConfig);
        return {
          success: nextAction !== null,
          nextAction,
          result: null,
          showSpinner
        };
      }
      else if (action.type === "render") {
        const result = await performRenderAction(action.config as RenderConfig, svgContainerElement);
        return {
          success: result !== null,
          nextAction: null,
          result,
          showSpinner
        };
      }
      else if (action.type === "renderAutoScroll") {
        const result = await performRenderAutoScrollAction(action.config as RenderAutoScrollConfig, svgContainerElement);
        return {
          success: result !== null,
          nextAction: null,
          result,
          showSpinner
        };
      }

      console.warn(`Unknown action type: ${action.type}`);
      return { success: false, nextAction: null, result: null, showSpinner: false };
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
      return { success: false, nextAction: null, result: null, showSpinner: false };
    }
  }, [
    verovio,
    performLoadAction,
    performLoadAutoScrollAction,
    performRenderAction,
    performRenderAutoScrollAction
  ]);

  return {
    executeAction,
    scoreRenderOptions
  };
}
