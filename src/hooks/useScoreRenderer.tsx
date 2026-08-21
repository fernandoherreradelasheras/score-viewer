import { useCallback, useMemo, RefObject } from 'react';
import { TimeMapEvent, PlayingState } from '../types';

interface SvgRendererConfig {
  autoScroll: boolean;
  showEditorial: boolean | null;
  playingState: PlayingState;
  svgContainerRef: RefObject<HTMLDivElement>;
}

export interface RenderedData {
  id: string;
  scoreUrl: string;
  scale: number;
  page: number;
  timemap: TimeMapEvent[];
  anchorElement: string | null;
  width?: number;
  height?: number;
  svgHTML?: string;  // Cached SVG HTML for instant display
}

/**
 * Custom hook to manage score SVG rendering and related utilities
 */
export default function useScoreRenderer({
  autoScroll,
  showEditorial,
  playingState,
  svgContainerRef,
}: SvgRendererConfig) {

  // Rounding of the requested page size leaves the two ratios a hair apart at the
  // boundary; below this they count as equal.
  const MAX_SCALE_ASPECT_TOLERANCE = 0.01;


  const calculateEffectiveMaxScale = useCallback(() => {
    const container = svgContainerRef.current;
    const viewBox = container?.querySelector("svg .definition-scale")
      ?.getAttribute("viewBox")?.split(/\s+/).map(Number);
    if (!container || viewBox?.length !== 4) {
      return false;
    }
    const [, , pageWidth, pageHeight] = viewBox;
    const pane = container.getBoundingClientRect();
    if (!pageWidth || !pane.width || !pane.height) {
      return false;
    }
    return pageHeight / pageWidth > (pane.height / pane.width) * (1 + MAX_SCALE_ASPECT_TOLERANCE);
  }, [svgContainerRef]);

  /**
   * Get CSS classes for the SVG container
   */
  const svgContainerClasses = useMemo(() => [
    'svg-container',
    ...(showEditorial ? ["editorial-active"] : [])
  ], [showEditorial]);


  /**
   * Get an element by ID from the current SVG
   */
  const getSvgElement = useCallback((elementId: string): Element | null => {
    if (!svgContainerRef.current) return null;
    const escapedId = CSS.escape(elementId);
    return svgContainerRef.current.querySelector(`#${escapedId}`);
  }, [svgContainerRef]);

  /**
   * Calculate if a spotlight overlay should be visible
   * (used in auto-scroll mode)
   */
  const isSpotlightVisible = useMemo(() =>
    autoScroll && playingState === PlayingState.PLAYING,
    [autoScroll, playingState]
  );

  return {
    calculateEffectiveMaxScale,
    svgContainerClasses,
    getSvgElement,
    isSpotlightVisible,
  };
}
