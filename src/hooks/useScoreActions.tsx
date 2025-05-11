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
  renderAutoScrollAction
} from '../types';

// Constants moved from ScoreView
const EXTRA_SVG_ATTRIBUTES = ["measure@n", "staff@n", "clef@corresp", "verse@n", "note@dur"];
const AUTO_SCROLL_RENDERING_WIDTH_LIMIT = 60000;

const verovioBaseOptions: VerovioOptions = {
  breaks: 'auto',
  footer: 'none',
  header: 'none',
  pageMarginBottom: 0,
  pageMarginTop: 0,
  pageMarginLeft: 16,
  pageMarginRight: 16,
  scaleToPageSize: true,
  shrinkToFit: true,
  spacingLinear: 0.25,
  spacingNonLinear: 0.6,
  mdivAll: true,
  svgHtml5: false,
  svgViewBox: false,
  svgRemoveXlink: false,
  svgBoundingBoxes: true,
  lyricElision: "regular",
  lyricTopMinMargin: 4.0,
  lyricVerseCollapse: true,
  smuflTextFont: "none"
};

// Helper to get the appropriate CSS class for a transition
const initialClassForTransition = (transition: Transition) => {
  switch (transition) {
      case Transition.GROW:
          return "underscaled";
      case Transition.NARROW:
          return "overscaled";
      case Transition.SLIDE_LEFT:
          return "displaced-right";
      case Transition.SLIDE_RIGHT:
          return "displaced-left";
      case Transition.FADE_OUT:
          return "full-opacity";
      case Transition.FADE_IN:
          return "zero-opacity";
  }
};

// Type definitions for render results
interface RenderedSvg {
  id: string;
  scale: number;
  timemap: TimeMapEvent[];
  anchorElement: string | null;
  page: number;
  width?: number;
  height?: number;
}

interface RenderActionResult {
  newSvg: RenderedSvg;
  loadedPagesCount: number;
  scale: number;
  renderPage: number;
}

interface RenderAutoScrollResult {
  newSvg: RenderedSvg;
}

interface ScoreActionsConfig {
  verovio: any; // Verovio toolkit instance
  svgContainerWidth: number;
  svgContainerHeight: number;
  appOptions: string[];
  choiceOptions: string[];
  transposition: string | null;
  showReconstructions: { [staff: string]: string };
  showOriginalClefs: boolean;
}

  /**
   * Transform a timemap with staff animation references
   */
  const resolveTimemapAnimations = (timemap: TimeMapEvent[]) =>
    timemap.map(e => {
      return {
        ...e,
        stavesOn: e.on?.map((id) => {
          const staff = document.querySelector(`.staff:has(#${id})`)?.getAttribute("data-n");
          return `#radius-${staff}-animation`;
        })
      };
    });

const buildAppOptions = (appOptions: string[], showReconstructions: { [staff: string] : string }, showOriginalClefs: boolean) => {
  const voiceReconstructionSelectors = Object.values(showReconstructions).map(label =>
    `./*[contains(@label, '${label}')]`
  )

  return [
    ...appOptions,
    ...voiceReconstructionSelectors,
    ...showOriginalClefs ? [`./rdg[contains(@label, 'app_clefs')]`] : []
  ]
}

/**
 * Custom hook that manages score action execution
 */
export default function useScoreActions({
  verovio,
  svgContainerWidth,
  svgContainerHeight,
  appOptions,
  choiceOptions,
  transposition,
  showReconstructions,
  showOriginalClefs
}: ScoreActionsConfig) {

  /**
   * Execute the load action - prepares Verovio with options and loads the MEI data
   */
  const performLoadAction = useCallback((config: LoadConfig) => {
    if (!verovio) return null;

    const { postLoadTransition, meiStr, page, scale, restorePositionForAchor } = config;
    const loadedHeight = svgContainerHeight;
    const loadedWidth = svgContainerWidth;

    console.log(`loading score: mode=normal page=${page} pageWidth=${loadedWidth}, pageHeight=${loadedHeight}, scale=${scale} transition=${postLoadTransition}`);

    const options: VerovioOptions = {
      ...verovioBaseOptions,
      adjustPageWidth: false,
      adjustPageHeight: false,
      landscape: loadedHeight > loadedWidth,
      svgAdditionalAttribute: EXTRA_SVG_ATTRIBUTES,
      appXPathQuery: buildAppOptions(appOptions, showReconstructions, showOriginalClefs),
      choiceXPathQuery: choiceOptions,
      pageHeight: loadedHeight,
      pageWidth: loadedWidth,
      scale: scale,
      transpose: transposition != null ? transposition : ""
    };

    try {
      verovio.setOptions(options);
      verovio.loadData(meiStr);
      const loadedPagesCount = verovio.getPageCount();

      let renderPage = undefined;
      if (restorePositionForAchor) {
        let pageForMeasureOnView = verovio?.getPageWithElement(restorePositionForAchor);
        if (pageForMeasureOnView != null && pageForMeasureOnView > 0) {
          renderPage = pageForMeasureOnView;
        }
      }
      if (!renderPage && page) {
        renderPage = (page <= loadedPagesCount) ? page : loadedPagesCount;
      }

      return renderAction({
        transition: postLoadTransition,
        loadedHeight,
        loadedWidth,
        renderPage,
        scale,
        loadedPagesCount
      });
    } catch (error) {
      console.error("Error performing load action:", error);
      return null;
    }
  }, [verovio, svgContainerWidth, svgContainerHeight, appOptions, choiceOptions, transposition, showReconstructions, showOriginalClefs]);

  /**
   * Execute the load auto-scroll action - prepares Verovio for auto-scroll mode
   */
  const performLoadAutoScrollAction = useCallback((config: LoadAutoScrollConfig) => {
    if (!verovio) return null;

    const { height, meiStr } = config;

    console.log(`loading score: mode=autoscroll height=${height}`);


    const options: VerovioOptions = {
      ...verovioBaseOptions,
      adjustPageWidth: true,
      adjustPageHeight: true,
      svgViewBox: true,
      svgAdditionalAttribute: EXTRA_SVG_ATTRIBUTES,
      appXPathQuery: buildAppOptions(appOptions, showReconstructions, showOriginalClefs),
      choiceXPathQuery: choiceOptions,
      pageHeight: height,
      pageWidth: AUTO_SCROLL_RENDERING_WIDTH_LIMIT,
      scale: 100,
      transpose: transposition != null ? transposition : ""
    };

    try {
      verovio.setOptions(options);
      verovio.loadData(meiStr);
      return renderAutoScrollAction({ height });
    } catch (error) {
      console.error("Error performing auto-scroll load action:", error);
      return null;
    }
  }, [verovio, appOptions, choiceOptions, transposition, showReconstructions, showOriginalClefs]);

  const mergeTimemapTies = (timemap: TimeMapEvent[], tiedNotes: {first: string, second: string} []) => {
      const newTimeMap = timemap.map(e => {return {...e}})
      console.log(newTimeMap)
      for (const { first, second } of tiedNotes) {
        const firstOnIndex = newTimeMap.findIndex(e => e.on != null && e.on.includes(first));
        const firstOffIndex = newTimeMap.findIndex(e => e.off != null && e.off.includes(first));
        const secondOnIndex = newTimeMap.findIndex(e => e.on != null && e.on.includes(second));
        const secondOffIndex = newTimeMap.findIndex(e => e.off != null && e.off.includes(second));
        if (firstOnIndex == -1 || firstOffIndex == -1 || secondOnIndex == -1 || secondOffIndex == -1) {
          // ties could be for a reconstructed voice not selected
          continue;
        }

        console.log(firstOnIndex, firstOffIndex, secondOnIndex, secondOffIndex)
        newTimeMap[firstOnIndex].on!.push(second)
        newTimeMap[firstOffIndex].off = newTimeMap[firstOffIndex].off!.filter(id => id != first)
        newTimeMap[secondOnIndex].on = newTimeMap[secondOnIndex].on!.filter(id => id != second)
        newTimeMap[secondOffIndex].off!.push(first)
    }
    return newTimeMap
  }

  const resolveTimemap = (timemap: TimeMapEvent[]) => {
    const analyzer = new ScoreAnalyzer(0, verovio.getMEI())
    const timeMapWithTiesMerged = mergeTimemapTies(timemap, analyzer.getTiedNotes())
    return resolveTimemapAnimations(timeMapWithTiesMerged)
  }

  /**
   * Render the score as a standard page
   */
  const performRenderAction = useCallback((config: RenderConfig, element: HTMLDivElement): RenderActionResult | null => {
    if (!verovio || !element) return null;

    const { transition, loadedHeight, loadedWidth, renderPage, scale, loadedPagesCount } = config;
    console.log(`Rendering score: mode=normal page=${renderPage} scale=${scale} transition=${transition}`);

    try {
      const timemap = verovio.renderToTimemap({ includeMeasures: true });
      const svgData = verovio.renderToSVG(renderPage)
        .replace(`width="${loadedWidth}px"`, 'width="100%"')
        .replace(`height="${loadedHeight}px"`, 'height="100%"');

      element.innerHTML = svgData;
      const svgElement = element.querySelector("svg") as SVGSVGElement | null;
      if (!svgElement) {
        console.log("Error rendering page: no svg element found");
        return null;
      }

      if (transition != undefined) {
        svgElement.classList.add("with-transition", initialClassForTransition(transition));
        setTimeout(() => {
          svgElement.classList.add("transition-end");
        }, 0);
      }

      const analyzer = new ScoreAnalyzer(0, verovio.getMEI({ pageNo: renderPage }));
      const firstMeasureId = analyzer.getFirstMeasureId();

      const newSvg = {
        id: svgElement.id,
        scale: scale,
        timemap: resolveTimemap(timemap),
        anchorElement: firstMeasureId,
        page: renderPage,
      };

      return { newSvg, loadedPagesCount, scale, renderPage };
    } catch (error) {
      console.log(`Error rendering page: ${error}`);
      return null;
    }
  }, [verovio]);

  /**
   * Render the score for auto-scrolling
   */
  const performRenderAutoScrollAction = useCallback((config: RenderAutoScrollConfig, element: HTMLDivElement): RenderAutoScrollResult | null => {
    if (!verovio || !element) return null;

    const { height } = config;
    console.log(`Rendering score: mode=autoscroll height=${height}`);


    try {
      const timemap = verovio.renderToTimemap({ includeMeasures: true });
      const svgData = verovio.renderToSVG(1);

      const match = svgData.match(/svg viewBox="0 0 (\d+) \d+"/);
      const renderedWidth = match ? Math.round(parseInt(match[1])) : AUTO_SCROLL_RENDERING_WIDTH_LIMIT;
      const renderedHeight = Math.round(height);

      element.innerHTML = svgData.replace("<svg", `<svg class="auto-scroll" style="will-change: transform; backface-visibility: hidden; overflow: collapse; width: ${renderedWidth}px; height: ${renderedHeight}px;" `)
        //width="${renderedWidth}" height="${renderedHeight}" \
//          .replace('<g class="page-margin" transform="translate(0, 0)">', '<g class="page-margin" transform="translate(0, 0)"><animateTransform attributeName="transform" attributeType="XML" begin="0s" dur="20s" type="translate"   from="0"    to="-16000"   />')

      element.style.height = `${renderedHeight}px`;



      const newSvg = {
        id: "svg-auto-scrolling",
        scale: 100, // Auto-scroll uses fixed scale
        timemap: resolveTimemap(timemap),
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
   * Execute an action based on its type
   */
  const executeAction = useCallback((action: Action, svgContainerElement: HTMLDivElement) => {
    if (!verovio || !svgContainerElement) {
      console.log("Cannot execute action - verovio or container not ready");
      return { success: false, nextAction: null, result: null };
    }

    try {
      if (action.type === "load") {
        const nextAction = performLoadAction(action.config as LoadConfig);
        return {
          success: nextAction !== null,
          nextAction,
          result: null
        };
      }
      else if (action.type === "loadAutoScroll") {
        const nextAction = performLoadAutoScrollAction(action.config as LoadAutoScrollConfig);
        return {
          success: nextAction !== null,
          nextAction,
          result: null
        };
      }
      else if (action.type === "render") {
        const result = performRenderAction(action.config as RenderConfig, svgContainerElement);
        return {
          success: result !== null,
          nextAction: null,
          result
        };
      }
      else if (action.type === "renderAutoScroll") {
        const result = performRenderAutoScrollAction(action.config as RenderAutoScrollConfig, svgContainerElement);
        return {
          success: result !== null,
          nextAction: null,
          result
        };
      }

      console.warn(`Unknown action type: ${action.type}`);
      return { success: false, nextAction: null, result: null };
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
      return { success: false, nextAction: null, result: null };
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
    performLoadAction,
    performLoadAutoScrollAction,
    performRenderAction,
    performRenderAutoScrollAction
  };
}