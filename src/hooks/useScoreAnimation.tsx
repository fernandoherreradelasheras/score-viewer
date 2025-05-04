import { useRef, useEffect, RefObject } from 'react';
import { TimeMapEvent, PlayingState } from '../types';
import { RenderedData } from './useScoreRenderer';

interface ScoreAnimationConfig {
  playingState: PlayingState;
  seekPosition: number;
  svgContainerRef: RefObject<HTMLDivElement>;
}


export default function useScoreAnimation({
  playingState,
  seekPosition,
  svgContainerRef,
}: ScoreAnimationConfig) {
  // Reference to the Web Animation API instance
  const animationRef = useRef<Animation | null>(null);


  const getAudioDurationMillis = (timemap: TimeMapEvent[]) => {
    return timemap[timemap.length - 1]?.tstamp || 0;
  };


  const generateKeyframes = (renderedSvgData: RenderedData) => {
    if (!svgContainerRef.current){
      return [];
    }

    const viewportBB = svgContainerRef.current.getBoundingClientRect();
    const audioDuration = getAudioDurationMillis(renderedSvgData.timemap);
    const initialX = Math.round(
      viewportBB.left +
      2 * svgContainerRef.current.clientWidth / 3 +
      (viewportBB.right - viewportBB.width)
    );

    const measuresOn = renderedSvgData.timemap
      .filter((e) => e.measureOn !== undefined)
      .map((e) => { return { id: e.measureOn, ts: e.tstamp }; });

    const keyframes: Keyframe[] = [];

    measuresOn.forEach((measure) => {
      const measureElement = svgContainerRef.current?.querySelector(`#${measure.id}`);
      if (measureElement) {
        const bb = measureElement.getBoundingClientRect();
        const xPosition = initialX - Math.floor(bb.left);
        const offset = measure.ts / audioDuration;

        keyframes.push({
          transform: `translateX(${xPosition}px)`,
          offset: offset
        });
      }
    });

    if (keyframes.length > 0) {
      keyframes[keyframes.length - 1]!.offset = 1;
    }

    return keyframes;
  };

  /**
   * Create and start the animation for auto-scrolling
   */
  const startAnimation = ( renderedSvgData: RenderedData, initialPosition: number, shouldPause: boolean) => {
    if (
      !svgContainerRef.current ||
      !renderedSvgData ||
      renderedSvgData.timemap.length === 0
    ) {
      return;
    }

    const svgElement = svgContainerRef.current.querySelector("svg") as SVGSVGElement | null;
    if (!svgElement) {
      return;
    }

    const keyframes = generateKeyframes(renderedSvgData);
    const audioDuration = getAudioDurationMillis(renderedSvgData.timemap);

    const timing: KeyframeAnimationOptions = {
      duration: audioDuration,
      fill: "forwards",
      endDelay: 3000,
    };


    // Create the animation
    animationRef.current = svgElement.animate(keyframes, timing);
    if (initialPosition > 0) {
      animationRef.current.currentTime = initialPosition;
    }
    if (shouldPause) {
      animationRef.current.pause();
    }


  };

  /**
   * Set up spotlight overlay styling for auto-scroll mode
   */
  const setupAutoScrollLayout = () => {
    if (!svgContainerRef.current) return;

    const scoreContainer = document.querySelector('.score-container') as HTMLDivElement | null;
    if (scoreContainer) {
      const containerBoundingBox = svgContainerRef.current?.getBoundingClientRect();
      const expandLeft = containerBoundingBox ? `${containerBoundingBox.left}px` : "0px";
      const hostWidth = containerBoundingBox ? `${containerBoundingBox.left + containerBoundingBox.right}px` : "100%";
      scoreContainer.style.setProperty('--expand-left', expandLeft);
      scoreContainer.style.setProperty('--host-width', hostWidth);
    }
  };



  // Control the animation based on playback state
  useEffect(() => {
    if (!animationRef.current) {
      return;
    }

    const animation = animationRef.current;

    if (playingState === PlayingState.PAUSED && animation.playState === "running") {
      animation.pause();
    } else if (playingState === PlayingState.PLAYING && animation.playState !== "running") {
      animation.play();
    } else if (playingState === PlayingState.STOPPED) {
      animation.cancel();
      animation.currentTime = 0;
    }
  }, [playingState]);

  // Update animation position based on seek position
  useEffect(() => {
    if (!animationRef.current) return;

    animationRef.current.currentTime = seekPosition;
  }, [seekPosition]);

  // Cancel animation when hook unmounts
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.cancel();
      }
    };
  }, []);

  return {
    animationRef,
    startAnimation,
    setupAutoScrollLayout,
    getAudioDurationMillis
  };
}