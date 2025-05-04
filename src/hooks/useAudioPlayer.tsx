import { useRef, useEffect, useState } from "react";
import useStore from "../store";
import useVerovio from "../useVerovio";
import { TimeMapEvent, PlayingState } from "../types";

/**
 * Custom hook to manage audio playback functionality
 * @param timemap The timing map that correlates time positions with score elements
 * @returns Audio player controls and state
 */
export default function useAudioPlayer(timemap: TimeMapEvent[]|null) {
  // Get state and actions from store
  const audioSrc = useStore.use.audioUrl();
  const playingState = useStore.use.playingState();
  const seekPosition = useStore.use.seekPosition();
  const setSeekPosition = useStore.use.setSeekPosition();
  const setPlayingState = useStore.use.setPlayingState();
  const setPlayingPosition = useStore.use.setPlayingPosition();
  const currentPage = useStore.use.currentPage();
  const setCurrentPage = useStore.use.setCurrentPage();
  const autoScroll = useStore.use.autoScroll();
  const setAutoScroll = useStore.use.setAutoScroll();
  const setIsLoading = useStore.use.setIsLoading();

  // Local state
  const [canPlay, setCanPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const verovio = useVerovio();

  // Check if we need to navigate to a new page based on playback position
  const checkPageForPosition = (position: number) => {
    if (!autoScroll && playingState !== PlayingState.STOPPED) {
      const playingAtPosition = verovio?.getElementsAtTime(position);
      const playingPage = playingAtPosition?.page;
      if (playingPage && playingPage !== currentPage) {
        setCurrentPage(playingPage);
      }
    }
  };

  // Handle time updates during playback
  const onTimeUpdate = (e: any) => {
    if (timemap == null || timemap.length === 0) {
      return;
    }

    const playSecs = e.target.currentTime;
    const playMilis = playSecs * 1000;

    // Check if we reached the end of the timemap
    if (playMilis > timemap[timemap.length - 1]['tstamp']) {
      console.log(`Got a time update: ${e.target.currentTime} above the last entry in the timemap. Do audio end`);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      onAudioEnded();
      return;
    }

    if (!autoScroll) {
      checkPageForPosition(playMilis);
    }
    setPlayingPosition(playMilis);
  };

  // Handle audio playback ending
  const onAudioEnded = () => {
    setPlayingState(PlayingState.STOPPED);
    setSeekPosition(0);
    if (autoScroll) {
      setAutoScroll(false);
    }
  };


  // Handle seek position changes
  useEffect(() => {
    if (audioRef.current != null && seekPosition >= 0) {
      audioRef.current.currentTime = seekPosition / 1000;
    }
    if (!autoScroll) {
        checkPageForPosition(seekPosition);
    }
  }, [seekPosition]);

  // Sync audio element with playback state
  useEffect(() => {
    if (playingState === PlayingState.PLAYING && audioRef.current?.paused) {
      audioRef.current?.play();
    } else if (playingState === PlayingState.PAUSED && !audioRef.current?.paused) {
      audioRef.current?.pause();
    }
  }, [playingState]);

  useEffect(() => {
    // Reset canPlay when audio source changes
    setCanPlay(false);
  }, [audioSrc]);

  // Playback control functions
  const handlePlay = () => {
    setPlayingState(PlayingState.PLAYING);
    audioRef.current?.play();
  };


  const playPauseTooltip = () => {
    if (playingState === PlayingState.PLAYING) {
      return "Pause";
    } else {
      return "Play";
    }
  }

  const handlePlayPause = () => {
    if (playingState === PlayingState.PLAYING) {
      setPlayingState(PlayingState.PAUSED);
    } else if (playingState === PlayingState.PAUSED) {
      setPlayingState(PlayingState.PLAYING);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsLoading(true);

    // react will not allow the audio src to sync to the pause state until the state is processed
    setTimeout(() => {
      setPlayingState(PlayingState.STOPPED);
      setSeekPosition(0);
      if (autoScroll) {
        setAutoScroll(false);
      }
    }, 50);
  };

  // Audio element event handlers
  const onCanPlayThrough = () => setCanPlay(true);
  const onError = (e: any) => console.log(e);

  return {
    audioRef,
    canPlay,
    playPauseTooltip,
    handlePlay,
    handlePlayPause,
    handleStop,
    onTimeUpdate,
    onAudioEnded,
    onCanPlayThrough,
    onError,
  };
}