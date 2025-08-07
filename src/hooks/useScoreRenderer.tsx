import { useCallback, useMemo, RefObject } from 'react';
import { TimeMapEvent, PlayingState } from '../types';

interface SvgRendererConfig {
  autoScroll: boolean;
  showEditorial: boolean | null;
  playingState: PlayingState;
  svgContainerRef: RefObject<HTMLDivElement>;
  svgContainerHeight: number;
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
}

/**
 * Custom hook to manage score SVG rendering and related utilities
 */
export default function useScoreRenderer({
  autoScroll,
  showEditorial,
  playingState,
  svgContainerRef,
  svgContainerHeight
}: SvgRendererConfig) {

  // Maximum remaining height for which we consider a score at max scale
  const MAX_SCALE_AT_REMAINING_HEIGHT = 20;

  /**
   * Calculate the height of the rendered SVG page
   */
  const svgPageHeight = useCallback(() => {
    if (!svgContainerRef.current) return 0;

    const pageElement = svgContainerRef.current.querySelector("svg .page-margin");
    if (!pageElement) return 0;
    const boundingBox = pageElement.getBoundingClientRect();

    return Math.floor(boundingBox.bottom - boundingBox.top);
  }, [svgContainerRef]);

  /**
   * Determine if the rendered SVG has a single system
   */
  const svgSingleSystem = useCallback(() => {
    if (!svgContainerRef.current) return false;
    return svgContainerRef.current.querySelectorAll("svg .system.bounding-box")?.length === 1;
  }, [svgContainerRef]);

  /**
   * Determine if the scale has reached its effective maximum
   * (used for UI feedback when zooming)
   */
  const calculateEffectiveMaxScale = useCallback((currentEffectiveMaxScale: boolean) => {
    const scoreEffectiveHeight = svgPageHeight();
    const singleSystem = svgSingleSystem();
    const newReachedEffectiveMaxScale = singleSystem &&
      (scoreEffectiveHeight > (svgContainerHeight - MAX_SCALE_AT_REMAINING_HEIGHT));

    return newReachedEffectiveMaxScale !== currentEffectiveMaxScale
      ? newReachedEffectiveMaxScale
      : currentEffectiveMaxScale;
  }, [svgPageHeight, svgSingleSystem, svgContainerHeight]);

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
    return svgContainerRef.current.querySelector(`#${elementId}`);
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
    svgPageHeight,
    svgSingleSystem,
    calculateEffectiveMaxScale,
    svgContainerClasses,
    getSvgElement,
    isSpotlightVisible,
  };
}
