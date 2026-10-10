import { useRef, useEffect, RefObject } from 'react';
import { TimeMapEvent, PlayingState } from '../types';
import { RenderedData } from './useScoreRenderer';
import { useSelectedAudioSync, useStaffOf } from './usePlaybackTimemap';
import { playbackTimemap } from '../utils/audio-sync';

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
  const sync = useSelectedAudioSync();
  const staffOf = useStaffOf();


  const getAudioDurationMillis = (timemap: TimeMapEvent[]) => {
    return timemap[timemap.length - 1]?.tstamp || 0;
  };


  const generateKeyframes = (timemap: TimeMapEvent[]) => {
    if (!svgContainerRef.current) {
      return [];
    }

    const viewportBB = svgContainerRef.current.getBoundingClientRect();
    const audioDuration = getAudioDurationMillis(timemap);
    const initialX = Math.round(
      viewportBB.left +
      2 * svgContainerRef.current.clientWidth / 3 +
      (viewportBB.right - viewportBB.width)
    );

    const keyframes: Keyframe[] = [];
    const addKeyframe = (x: number, ts: number) => keyframes.push({
      transform: `translateX(${initialX - Math.floor(x)}px)`,
      offset: ts / audioDuration
    });

    // At a jump of a synced recording the score has scrolled to the end of the measure
    // it leaves, and moves at once to where the recording goes on.
    let previousMeasure: Element | null = null;
    timemap.forEach((event) => {
      if (event.passStart && previousMeasure) {
        addKeyframe(previousMeasure.getBoundingClientRect().right, event.tstamp);
      }
      if (event.measureOn) {
        const measureElement = svgContainerRef.current?.querySelector(`#${CSS.escape(event.measureOn)}`);
        if (measureElement) {
          addKeyframe(measureElement.getBoundingClientRect().left, event.tstamp);
          previousMeasure = measureElement;
        }
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
  const startAnimation = (renderedSvgData: RenderedData, initialPosition: number, shouldPause: boolean) => {
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

    const timemap = playbackTimemap(renderedSvgData.timemap, sync, staffOf);
    const keyframes = generateKeyframes(timemap);
    const audioDuration = getAudioDurationMillis(timemap);

    const timing: KeyframeAnimationOptions = {
      duration: audioDuration,
      fill: "forwards",
      endDelay: 3000,
    };


    animationRef.current?.cancel();
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
    if (!animationRef.current || seekPosition == -1) return;

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
