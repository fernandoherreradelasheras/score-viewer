import { useCallback } from 'react';
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
} from '../types';
import { RenderedData } from './useScoreRenderer';
import useStore from '../store';
import { resolveSvgNoteId } from '../utils/svg-note-id';


// Constants moved from ScoreView
const EXTRA_SVG_ATTRIBUTES = ["measure@n", "staff@n", "clef@corresp", "verse@n", "note@dur", "rdg@label"];
const AUTO_SCROLL_RENDERING_WIDTH_LIMIT = 60000;

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
  smuflTextFont: "embedded"
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
 * Transform a timemap with staff animation references
 */
const staffAnimationRef = (id: string): string => {
  // Repeated renditions carry `-rendN` ids absent from a non-expanded SVG; fall
  // back to the original id so the staff (and its glow animation) is found.
  const lookupId = resolveSvgNoteId(id) ?? id;
  const escapedId = CSS.escape(lookupId);
  const staff = document.querySelector(`.staff:has(#${escapedId})`)?.getAttribute("data-n");
  return `#radius-${staff}-animation`;
};

const resolveTimemapAnimations = (timemap: TimeMapEvent[]): TimeMapEvent[] =>
  timemap.map(e => {
    return {
      ...e,
      stavesOn: e.on?.map(staffAnimationRef),
      stavesOff: e.off?.map(staffAnimationRef)
    } as TimeMapEvent;
  });

const buildAppOptions = (appOptions: string[], showOriginalClefs: boolean, showMusicAnalysis: boolean) => {

  return [
    ...appOptions,
    ...showOriginalClefs ? [`./rdg[contains(@label, 'app_clefs')]`] : [],
    ...showMusicAnalysis ? [`./rdg[contains(@type, 'dissonant_analysis')]`] : []
  ]
}

// Keep the timemap consistent with the externally-generated audio.
// If audio does not play repeats: expandNever: true -> (timemap, midi and SVG unexpanded)
// if audio plays repeats: expandNever: false + expandAlways: false -> (timemap and midi expanded, SVG unexpanded)
const expansionOptions = (repeats?: boolean): VerovioOptions => {
  return {
    expand: "", // Not supported yet
    expandNever: !repeats,
    expandAlways: false,
  };
};

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
  const showOriginalClefs = useStore.use.showOriginalClefs();
  const showMusicAnalysis = useStore.use.showMusicAnalysis();
  const measureNumberInterval = useStore.use.measureNumberInterval();
  const setScoreLayout = useStore.use.setScoreLayout();
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
      appXPathQuery: buildAppOptions(appOptions, showOriginalClefs || false, showMusicAnalysis),
      choiceXPathQuery: choiceOptions,
      pageHeight: loadedHeight,
      pageWidth: loadedWidth,
      scale: scale,
      transpose: config.transposition != null ? config.transposition : "",
      mnumInterval: measureNumberInterval ?? 0,
      ...expansionOptions(score?.audioFiles?.[selectedAudioIndex]?.repeats)
    };

    console.log("VerovioOptions: ", options)


    try {
      const startTime = performance.now();
      console.log(`[useScoreActions] performLoadAction started`);

      await verovio.setOptions(options);
      await verovio.loadData(meiStr);
      const timemap = await verovio.renderToTimemap({ includeMeasures: true });
      console.log("timemap duration: ", timemap.slice(-1)[0].tstamp)


      const countStart = performance.now();
      const loadedPagesCount = await verovio.getPageCount();
      console.log(`[useScoreActions] getPageCount took ${(performance.now() - countStart).toFixed(2)}ms`);

      // Build the section -> page map only after the data is loaded and
      // paginated.
      const analyzer = new ScoreAnalyzer(0, meiStr);
      const sectionMap = await getSectionMap(analyzer);


      console.log(`Score loaded in ${(performance.now() - startTime).toFixed(0)}ms, page count: ${loadedPagesCount}`);
      console.log(`[useScoreActions] performLoadAction completed in ${(performance.now() - startTime).toFixed(2)}ms`);

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
    appOptions,
    showOriginalClefs,
    showMusicAnalysis,
    choiceOptions,
    measureNumberInterval,
    score,
    selectedAudioIndex
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
      appXPathQuery: buildAppOptions(appOptions, showOriginalClefs || false, false),
      choiceXPathQuery: choiceOptions,
      pageHeight: height,
      pageWidth: AUTO_SCROLL_RENDERING_WIDTH_LIMIT,
      scale: 100,
      transpose: config.transposition != null ? config.transposition : "",
      ...expansionOptions(score?.audioFiles?.[selectedAudioIndex]?.repeats)
    };

    try {

      await verovio.setOptions(options);
      await verovio.loadData(meiStr)
      const timemap = await verovio.renderToTimemap({ includeMeasures: true });
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
    showOriginalClefs,
    showMusicAnalysis,
    measureNumberInterval,
    score,
    selectedAudioIndex
  ]);

  // Merge a single concrete tied pair so the second note stays highlighted from
  // the first note's onset until the second note's release (a sustained tie).
  const mergeTiePair = (timemap: TimeMapEvent[], first: string, second: string) => {
    const firstOnIndex = timemap.findIndex(e => e.on != null && e.on.includes(first));
    const firstOffIndex = timemap.findIndex(e => e.off != null && e.off.includes(first));
    const secondOnIndex = timemap.findIndex(e => e.on != null && e.on.includes(second));
    const secondOffIndex = timemap.findIndex(e => e.off != null && e.off.includes(second));
    if (firstOnIndex == -1 || firstOffIndex == -1 || secondOnIndex == -1 || secondOffIndex == -1) {
      // The tie may be for a reconstructed voice not selected, or a rendition
      // whose partner is absent.
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
      // In an expanded timemap the tie appears once per rendition (verovio tags
      // repeats as `<id>-rendN`). Merge every rendition of `first`, pairing it
      // with the `second` note carrying the same suffix.
      const renditionPrefix = first + '-rend';
      const firstIds = new Set<string>();
      for (const e of newTimeMap) {
        for (const id of e.on ?? []) {
          if (id === first || id.startsWith(renditionPrefix)) firstIds.add(id);
        }
      }
      for (const firstId of firstIds) {
        const suffix = firstId.slice(first.length); // '' | '-rendN'
        mergeTiePair(newTimeMap, firstId, second + suffix);
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
    console.log(`[useScoreActions] performRenderAction started`);

    try {

      const svgStart = performance.now();
      const svgData = (await verovio.renderToSVG(renderPage))
        .replace(`width="${loadedWidth}px"`, 'width="100%"')
        .replace(`height="${loadedHeight}px"`, 'height="100%"');
      console.log(`[useScoreActions] renderToSVG took ${(performance.now() - svgStart).toFixed(2)}ms`);


      const domStart = performance.now();
      element.innerHTML = svgData;
      const svgElement = element.querySelector("svg") as SVGSVGElement | null;
      if (!svgElement) {
        console.log("Error rendering page: no svg element found");
        return null;
      }

      // Set initial opacity to 0 for fade-in animation (will be animated in ScoreView)
      svgElement.style.opacity = '0';

      if (svgElement.classList.contains("transition-zero-end")) {
        svgElement.classList.remove("transition-zero-end");
      }
      if (transition != undefined) {
        svgElement.classList.add("with-transition", initialClassForTransition(transition));
        setTimeout(() => {
          svgElement.classList.add("transition-end");
        }, 0);
      }
      console.log(`[useScoreActions] DOM manipulation took ${(performance.now() - domStart).toFixed(2)}ms`);

      const meiStart = performance.now();
      const mei = await verovio.getMEI({ pageNo: renderPage });

      const analyzer = new ScoreAnalyzer(0, mei);
      const firstMeasureId = analyzer.getFirstMeasureId();
      console.log(`[useScoreActions] getMEI + analysis took ${(performance.now() - meiStart).toFixed(2)}ms`);


      const resolvedTimemap = await resolveTimemapAnimations(timemap);

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
      console.log(`[useScoreActions] Rendering + post-processing took ${duration.toFixed(0)}ms`);
      console.log(`[useScoreActions] performRenderAction completed in ${duration.toFixed(2)}ms`);

      return { newSvg, loadedPagesCount, scale, renderPage } as RenderActionResult;
    } catch (error) {
      console.log(`Error rendering page: ${error}`);
      return null;
    }
  }, [verovio, resolveTimemap]);

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



      const newSvg: RenderedData = {
        id: "svg-auto-scrolling",
        scale: 100, // Auto-scroll uses fixed scale
        scoreUrl: "",
        timemap: timemap,
        width: renderedWidth,
        height: renderedHeight,
        anchorElement: null,
        page: 1,
      };

      return { newSvg };
    } catch (error) {
      console.log(`Error rendering auto-scroll page: ${error}`);
      return null;
    }
  }, [verovio]);

  /**
   * Determine if spinner should be shown for this action
   */
  const shouldShowSpinner = (action: Action): boolean => {
    const config = action.config as any;
    const transition = config.transition || config.postLoadTransition;

    // Always show for operations without transitions
    if (!transition) {
      return true;
    }


    // Don't show for other transitions (SLIDE, FADE)
    return false;
  };

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
    executeAction
  };
}
