import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import useStore from "../store";
import { TimeMapEvent, PlayingState, AudioTrack } from "../types";
import useVerovio from "../useVerovio";

let sharedAudioContext: AudioContext | null = null;
const MS_OVER_LAST_TIMESTAMP = 1000;


export default function useWebAudioPlayer() {
    // Get state and base functionality from base hook

    const playingState = useStore.use.playingState();
    const seekPosition = useStore.use.seekPosition();
    const setSeekPosition = useStore.use.setSeekPosition();
    const setPlayingState = useStore.use.setPlayingState();
    const setPlayingPosition = useStore.use.setPlayingPosition();
    const currentPage = useStore.use.currentPage();
    const setCurrentPage = useStore.use.setCurrentPage();
    const autoScroll = useStore.use.autoScroll();
    const setAutoScroll = useStore.use.setAutoScroll();

    const renderedSvgData = useStore.use.renderedSvgData();

    const verovio = useVerovio();

    const audioUrl = useStore.use.audioUrl();
    const audioOverlayTracks = useStore.use.audioOverlayTracks();

    const audioContextRef = useRef<AudioContext | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedPositionRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

    const [canPlay, setCanPlay] = useState(false);
    const [loadedTracks, setLoadedTracks] = useState<string[]>([]);
    const [audioContextResumed, setAudioContextResumed] = useState(false);
    const needsUserInteractionRef = useRef(true);

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
                setAudioContextResumed(true);
                needsUserInteractionRef.current = false;
                return true;
            } catch (error) {
                console.error("Failed to resume AudioContext:", error);
                return false;
            }
        }

        if (context.state === 'running') {
            setAudioContextResumed(true);
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

    useEffect(() => {
        const loadAudio = async (audioUrl: string) => {
            const context = getAudioContext();
            if (!context) {
                return
            }
            audioBuffersRef.current.clear();
            setLoadedTracks([]);
            try {
                const buffer = await fetchAudioBuffer(audioUrl, context);
                audioBuffersRef.current.set('main', buffer);
                setLoadedTracks(['main']);
                setCanPlay(true);
            } catch (error) {
                console.error("Failed to load main audio:", error);
            }
        }

        if (playingState !== PlayingState.STOPPED) {
            stopPlayback();
            setPlayingState(PlayingState.STOPPED);
        }
        setCanPlay(false);

        if (audioUrl) {
            loadAudio(audioUrl)
        }
    }, [audioUrl]);


    useEffect(() => {
        const loadOverlayAudio = async (audioOverlayTracks: AudioTrack[]) => {
            const context = getAudioContext();
            if (!context) {
                return;
            }
            await Promise.all(audioOverlayTracks.map(async (track: AudioTrack) => {
                if (!track.url) return;
                try {
                    const buffer = await fetchAudioBuffer(track.url, context);
                    audioBuffersRef.current.set(track.id, buffer);
                    setLoadedTracks(prev => [...prev, track.id]);
                } catch (error) {
                    console.error(`Failed to load track ${track.id}:`, error);
                }
            }));
        }

        if (audioOverlayTracks.length > 0) {
            loadOverlayAudio(audioOverlayTracks)
        }
    }, [audioOverlayTracks]);


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

    const checkPageForPosition = (position: number) => {
        if (!autoScroll && playingState !== PlayingState.STOPPED) {
            const playingAtPosition = verovio?.getElementsAtTime(position);
            const playingPage = playingAtPosition?.page;
            if (playingPage && playingPage !== currentPage) {
                setCurrentPage(playingPage);
            }
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
    }, [getAudioContext, audioOverlayTracks, resumeAudioContext, playingState]);

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
    }, [getAudioContext]);

    const stopPlayback = useCallback(() => {
        pausePlayback();
        pausedPositionRef.current = 0;
    }, [pausePlayback]);

    const getCurrentPosition = useCallback(() => {
        const context = getAudioContext();
        if (!context || startTimeRef.current === 0) return pausedPositionRef.current;

        const positionSeconds = context.currentTime - startTimeRef.current;
        return Math.max(0, positionSeconds * 1000);
    }, [getAudioContext]);

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

    const getAudioDuration = useCallback(() => {
        const buffers = Array.from(audioBuffersRef.current.values());
        if (buffers.length > 0) {
            return buffers[0].duration * 1000; // Convert to milliseconds
        }
        return 0;
    }, []);

    return {
        canPlay,
        playPauseTooltip,
        handlePlay,
        handlePlayPause,
        handleStop,
        loadedTracks,
        audioContextResumed,
        getAudioContext,
        resumeAudioContext,
        getAudioDuration,
        onAudioEnded,
    };
}