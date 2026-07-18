import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import useStore from "../store";
import { TimeMapEvent, PlayingState } from "../types";
import useVerovio from "../useVerovio";

let sharedAudioContext: AudioContext | null = null;
const MS_OVER_LAST_TIMESTAMP = 1000;

export default function useWebAudioPlayer(audioUrl: string | null, originalMei: string | undefined) {
    // Get state and base functionality from base hook

    const playingState = useStore.use.playingState();
    const seekPosition = useStore.use.seekPosition();
    const setSeekPosition = useStore.use.setSeekPosition();
    const setPlayingState = useStore.use.setPlayingState();
    const setPlayingPosition = useStore.use.setPlayingPosition();
    const currentPage = useStore.use.currentPage();
    const goToPage = useStore.use.goToPage();
    const elementPages = useStore.use.elementPages();
    const autoScroll = useStore.use.autoScroll();
    const setAutoScroll = useStore.use.setAutoScroll();

    const renderedSvgData = useStore.use.renderedSvgData();

    const verovio = useVerovio();

    const audioContextRef = useRef<AudioContext | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedPositionRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

    const [canPlay, setCanPlay] = useState(false);
    const needsUserInteractionRef = useRef(true);

    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // Read through refs: checkPageForPosition runs from the requestAnimationFrame
    // loop, which holds the closure captured when playback started.
    const elementPagesRef = useRef(elementPages);
    elementPagesRef.current = elementPages;

    const timemapRef = useRef<TimeMapEvent[]>([]);
    timemapRef.current = renderedSvgData?.timemap ?? [];


    const getAudioContext = useCallback(() => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            return audioContextRef.current;
        }

        if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
            audioContextRef.current = sharedAudioContext;
            return sharedAudioContext;
        }

        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContext();
            sharedAudioContext = audioContextRef.current;
            if (audioContextRef.current.state === 'suspended') {
                needsUserInteractionRef.current = true;
            }
            return audioContextRef.current;
        } catch (error) {
            console.error("Failed to create AudioContext:", error);
            return null;
        }
    }, []);

    const resumeAudioContext = useCallback(async () => {
        const context = getAudioContext();
        if (!context) return false;

        if (context.state === 'suspended') {
            try {
                await context.resume();
                needsUserInteractionRef.current = false;
                return true;
            } catch (error) {
                console.error("Failed to resume AudioContext:", error);
                return false;
            }
        }

        if (context.state === 'running') {
            needsUserInteractionRef.current = false;
            return true;
        }

        return false; // Handle any other state appropriately
    }, [getAudioContext]);

    useEffect(() => {
        const context = getAudioContext();
        if (!context) return;

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [getAudioContext]);

    // Lets an audio-version switch be told apart from a score change: the first has to
    // resume where the listener was, the second must start over.
    const loadedMeiRef = useRef(originalMei);

    useEffect(() => {
        const restorePosition = (position: number) => {
            setPlayingPosition(position);
            if (position > 0) {
                // Reuse the seek path: it restarts the sources when playing, repositions
                // them when paused, and rebuilds the highlighter's event queue either way.
                setSeekPosition(position);
            } else if (playingState === PlayingState.PLAYING) {
                startPlayback(0);
            }
        }

        const loadAudio = async (audioUrl: string, resumeAt: number | null) => {
            console.log(`Loading audio from URL: ${audioUrl}`);
            const context = getAudioContext();
            if (!context) {
                return
            }
            audioBuffersRef.current.clear();
            try {
                const buffer = await fetchAudioBuffer(audioUrl, context);
                audioBuffersRef.current.set('main', buffer);
                setCanPlay(true);
                if (resumeAt != null) {
                    // A shorter rendering of the same score must not seek past its end.
                    restorePosition(Math.min(resumeAt, buffer.duration * 1000));
                }
            } catch (error) {
                console.error("Failed to load main audio:", error);
            }
        }

        const isSameScore = loadedMeiRef.current === originalMei;
        loadedMeiRef.current = originalMei;

        // While playing, the live position is the authoritative one; while paused,
        // startTimeRef is stale and only pausedPositionRef holds the real position.
        const resumeAt = isSameScore && playingState !== PlayingState.STOPPED
            ? (playingState === PlayingState.PLAYING ? getCurrentPosition() : pausedPositionRef.current)
            : null;

        if (playingState !== PlayingState.STOPPED) {
            stopPlayback();
            if (resumeAt == null) {
                setPlayingState(PlayingState.STOPPED);
            }
        }
        setCanPlay(false);

        if (audioUrl) {
            loadAudio(audioUrl, resumeAt)
        }
    }, [audioUrl, originalMei]);


    // We need a clean up effect to release the audio context when the component gets removed.
    useEffect(() => {
        return () => {
            stopPlayback()
            if (audioContextRef.current?.state === 'running') {
                audioContextRef.current.suspend().then(() => {
                    console.log("Audio context suspended");
                    audioContextRef.current = null;
                })
            }
        };
    }, [])

    const fetchAudioBuffer = useCallback(async (url: string, context: AudioContext): Promise<AudioBuffer> => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    }, []);

    const checkPageForPosition = async (position: number) => {
        if (autoScroll || playingState === PlayingState.STOPPED) return;

        const timemap = timemapRef.current;
        let elementId: string | undefined;
        for (let i = timemap.length - 1; i >= 0; i--) {
            const e = timemap[i];
            if (e.tstamp <= position && e.on && e.on.length > 0) { elementId = e.on[0]; break; }
        }
        if (!elementId) return;

        const playingPage: number | undefined = elementPagesRef.current[elementId]
            ?? await verovio?.getPageWithElement(elementId);
        if (playingPage && playingPage > 0 && playingPage !== currentPageRef.current) {
            goToPage(playingPage);
        }
    }


    useEffect(() => {
        if (seekPosition <= 0) {
            return
        }
        console.log(`Seeking to position: ${seekPosition} ms. Playing state: ${playingState}`);
        if (playingState === PlayingState.PLAYING) {
            stopPlayback();
            checkPageForPosition(seekPosition);
            startPlayback(seekPosition);
            setSeekPosition(-1)
        } else {
            pausedPositionRef.current = seekPosition;
            checkPageForPosition(seekPosition);
            setSeekPosition(-1)
        }
    }, [seekPosition]);


    useEffect(() => {
        switch (playingState) {
            case PlayingState.PLAYING:
                if (needsUserInteractionRef.current) {
                    resumeAudioContext().then(success => {
                        if (success) {
                            startPlayback(pausedPositionRef.current);
                        }
                    });
                } else {
                    startPlayback(pausedPositionRef.current);
                }
                break;
            case PlayingState.PAUSED:
                pausePlayback();
                break;
            case PlayingState.STOPPED:
                stopPlayback();
                pausedPositionRef.current = 0;
                break;
        }
    }, [playingState, resumeAudioContext]);

    const handlePlayPause = useCallback(() => {
        if (playingState === PlayingState.PLAYING) {
            setPlayingState(PlayingState.PAUSED);
        } else if (playingState === PlayingState.PAUSED) {
            setPlayingState(PlayingState.PLAYING);
        }
    }, [playingState, setPlayingState]);

    const handlePlay = useCallback(() => {
        setPlayingState(PlayingState.PLAYING);
    }, [setPlayingState]);

    const onAudioEnded = useCallback(() => {
        setPlayingState(PlayingState.STOPPED);
        setSeekPosition(0);
    }, [setPlayingState, setSeekPosition]);

    const getCurrentPosition = useCallback(() => {
        const context = getAudioContext();
        if (!context || startTimeRef.current === 0) return pausedPositionRef.current;

        const positionSeconds = context.currentTime - startTimeRef.current;
        return Math.max(0, positionSeconds * 1000);
    }, [getAudioContext]);


    const pausePlayback = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        const context = getAudioContext();
        if (!context) return;

        pausedPositionRef.current = getCurrentPosition();
        sourceNodesRef.current.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Ignore errors if source is already stopped
            }
        });
        sourceNodesRef.current.clear();
    }, [getAudioContext, getCurrentPosition]);

    const stopPlayback = useCallback(() => {
        pausePlayback();
        pausedPositionRef.current = 0;
        setPlayingPosition(0);
    }, [pausePlayback]);

    const startPlayback = useCallback((startPosition: number) => {
        stopPlayback();

        const context = getAudioContext();
        if (!context || audioBuffersRef.current.size === 0) return;

        resumeAudioContext().then(success => {
            if (!success) return;

            pausedPositionRef.current = startPosition;
            const startSeconds = startPosition / 1000;
            startTimeRef.current = context.currentTime - startSeconds;

            audioBuffersRef.current.forEach((buffer, trackId) => {
                const source = context.createBufferSource();
                source.buffer = buffer;
                source.connect(context.destination);

                source.start(0, startSeconds);
                sourceNodesRef.current.set(trackId, source);
            });
            updatePlaybackPosition();
        });
    }, [stopPlayback, getAudioContext, resumeAudioContext, playingState]);


    const timemap = useMemo(() => {
        if (renderedSvgData?.timemap) {
            return renderedSvgData.timemap as TimeMapEvent[];
        }
        return [];
    }, [renderedSvgData]);

    const updatePlaybackPosition = useCallback(() => {
        if (playingState !== PlayingState.PLAYING) return;

        const position = getCurrentPosition();
        setPlayingPosition(position);

        if (timemap && timemap.length > 0 && position > timemap[timemap.length - 1].tstamp + MS_OVER_LAST_TIMESTAMP) {
            stopPlayback();
            onAudioEnded();
            return;
        }

        checkPageForPosition(position);

        animationFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
    }, [getCurrentPosition, setPlayingPosition, timemap, stopPlayback, onAudioEnded, checkPageForPosition, playingState]);


    const playPauseTooltip = useCallback(() => {
        return playingState === PlayingState.PLAYING ? "Pause" : "Play";
    }, [playingState]);


    const handleStop = useCallback(() => {
        stopPlayback();
        onAudioEnded();
    }, [playingState, setPlayingState, autoScroll, setAutoScroll, stopPlayback]);


    return {
        canPlay,
        playPauseTooltip,
        handlePlay,
        handlePlayPause,
        handleStop
    };
}
