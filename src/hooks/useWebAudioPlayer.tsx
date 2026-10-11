import { useRef, useEffect, useCallback, useState } from "react";
import useStore from "../store";
import { AudioSync, TimeMapEvent, PlayingState } from "../types";
import useVerovio from "../useVerovio";
import { convertPosition, syncEnd } from "../utils/audio-sync";
import { releaseMidiSyntheses, synthesizeMidi } from "../utils/midi-synth";

export type PlayableAudio =
    | { kind: 'file'; url: string }
    | { kind: 'midi'; midi: string };

const playableAudioKey = (audio: PlayableAudio | null) =>
    audio == null ? null : audio.kind === 'file' ? audio.url : audio.midi;

let sharedAudioContext: AudioContext | null = null;
const MS_OVER_LAST_TIMESTAMP = 1000;

// The context time of what is being heard: audio reaches the ears some time after the
// context renders it, a few milliseconds through a cable and some tenths of a second
// through Bluetooth. Following `currentTime` instead puts the score ahead of the sound.
const heardTime = (context: AudioContext) => {
    const stamp = context.getOutputTimestamp?.();
    if (stamp?.contextTime && stamp.performanceTime) {
        return stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000;
    }
    return context.currentTime - (context.outputLatency ?? 0) - (context.baseLatency ?? 0);
};

// How far behind the context the sound is heard, as the browser reports it.
export const outputLatencyMs = (): number | null =>
    sharedAudioContext ? Math.max(0, Math.round((sharedAudioContext.currentTime - heardTime(sharedAudioContext)) * 1000)) : null;

export default function useWebAudioPlayer(audio: PlayableAudio | null, originalMei: string | undefined,
    timemap: TimeMapEvent[], sync: AudioSync | null) {
    // Get state and base functionality from base hook

    const playingState = useStore.use.playingState();
    const seekPosition = useStore.use.seekPosition();
    const setSeekPosition = useStore.use.setSeekPosition();
    const setPlayingState = useStore.use.setPlayingState();
    const resetPlayerPosition = useStore.use.resetPlayerPosition();
    const setPlayingPosition = useStore.use.setPlayingPosition();
    const currentPage = useStore.use.currentPage();
    const goToPage = useStore.use.goToPage();
    const elementPages = useStore.use.elementPages();
    const autoScroll = useStore.use.autoScroll();

    const verovio = useVerovio();

    const audioContextRef = useRef<AudioContext | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedPositionRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
    const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

    const setCanPlay = useStore.use.setCanPlay();
    const audioLoadFailed = useStore.use.audioLoadFailed();
    const setAudioLoadFailed = useStore.use.setAudioLoadFailed();
    const needsUserInteractionRef = useRef(true);

    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // The transport state when an audio finishes loading, which may not be the one it
    // started loading in: the listener can pause or stop meanwhile.
    const playingStateRef = useRef(playingState);
    playingStateRef.current = playingState;

    // Read through refs: checkPageForPosition runs from the requestAnimationFrame
    // loop, which holds the closure captured when playback started. Playback restarted
    // in auto-scroll (a seek, a pause) would otherwise never turn a page again.
    const elementPagesRef = useRef(elementPages);
    elementPagesRef.current = elementPages;
    const autoScrollRef = useRef(autoScroll);
    autoScrollRef.current = autoScroll;

    const timemapRef = useRef<TimeMapEvent[]>([]);
    timemapRef.current = timemap;

    // The timemap of the previous render: on an audio switch, the one whose time axis the
    // position still is on.
    const previousTimemapRef = useRef<TimeMapEvent[]>(timemap);


    const getAudioContext = useCallback(() => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            return audioContextRef.current;
        }

        if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
            audioContextRef.current = sharedAudioContext;
            return sharedAudioContext;
        }

        try {
            const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
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

    // Who asks for the syntheses of this player: another viewer on the page asks for its own.
    const [synthesisConsumer] = useState(() => ({}));

    const loadAudioBuffer = useCallback(async (audio: PlayableAudio, context: AudioContext): Promise<AudioBuffer> => {
        if (audio.kind === 'midi') {
            return synthesizeMidi(audio.midi, context.sampleRate, synthesisConsumer);
        }
        releaseMidiSyntheses(synthesisConsumer);
        const response = await fetch(audio.url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    }, [synthesisConsumer]);

    const checkPageForPosition = useCallback(async (position: number) => {
        if (autoScrollRef.current || playingState === PlayingState.STOPPED) return;

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
    }, [playingState, verovio, goToPage])

    // Back from auto-scroll the paged score is laid out on the page it was left on, which
    // the music may be long past: once it is, the page of the position is shown, also
    // while paused, when no playback tick would turn it.
    const renderedSvgData = useStore.use.renderedSvgData();
    const wasAutoScrollRef = useRef(autoScroll);
    const leftAutoScrollRef = useRef(false);
    useEffect(() => {
        leftAutoScrollRef.current = wasAutoScrollRef.current && !autoScroll;
        wasAutoScrollRef.current = autoScroll;
    }, [autoScroll]);
    useEffect(() => {
        if (!leftAutoScrollRef.current || !renderedSvgData || renderedSvgData.id === "svg-auto-scrolling") {
            return;
        }
        leftAutoScrollRef.current = false;
        checkPageForPosition(playingState === PlayingState.PLAYING ? getCurrentPosition() : pausedPositionRef.current);
        // A paged render after leaving auto-scroll is the whole trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renderedSvgData]);


    const onAudioEnded = useCallback(() => {
        setPlayingState(PlayingState.STOPPED);
        setSeekPosition(0);
    }, [setPlayingState, setSeekPosition]);

    const getCurrentPosition = useCallback(() => {
        const context = getAudioContext();
        if (!context || startTimeRef.current === 0) return pausedPositionRef.current;

        const positionSeconds = heardTime(context) - startTimeRef.current;
        return Math.max(0, positionSeconds * 1000);
    }, [getAudioContext]);

    // The clock only tells the position while the audio sounds. Before that, as while
    // the next audio loads, it is the position kept, which a pause must not overwrite.
    const livePosition = useCallback(() =>
        sourceNodesRef.current.size > 0 ? getCurrentPosition() : pausedPositionRef.current
        , [getCurrentPosition]);


    const pausePlayback = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        const context = getAudioContext();
        if (!context) return;

        pausedPositionRef.current = livePosition();
        sourceNodesRef.current.forEach(source => {
            try {
                source.stop();
            } catch {
                // Ignore errors if source is already stopped
            }
        });
        sourceNodesRef.current.clear();
    }, [getAudioContext, livePosition]);

    const stopPlayback = useCallback(() => {
        pausePlayback();
        pausedPositionRef.current = 0;
        setPlayingPosition(0);
    }, [pausePlayback, setPlayingPosition]);

    const playbackEnd = useCallback(() =>
        sync ? syncEnd(sync) : timemap[timemap.length - 1].tstamp + MS_OVER_LAST_TIMESTAMP
        , [sync, timemap]);

    const updatePlaybackPosition = useCallback(function tick() {
        if (playingState !== PlayingState.PLAYING) return;

        const position = getCurrentPosition();
        setPlayingPosition(position);

        if (timemap.length > 0 && position > playbackEnd()) {
            stopPlayback();
            onAudioEnded();
            return;
        }

        checkPageForPosition(position);

        animationFrameRef.current = requestAnimationFrame(tick);
    }, [getCurrentPosition, setPlayingPosition, timemap, playbackEnd, stopPlayback, onAudioEnded, checkPageForPosition, playingState]);

    const startPlayback = useCallback((startPosition: number) => {
        // Not stopPlayback: its transient position 0 would make the highlighter play
        // the notes at the start of the score before the sources resume.
        pausePlayback();
        pausedPositionRef.current = startPosition;
        setPlayingPosition(startPosition);

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
    }, [pausePlayback, setPlayingPosition, getAudioContext, resumeAudioContext, updatePlaybackPosition]);



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
    // resume where the listener was, the second must start over. It starts empty: the
    // stores outlive a viewer, and a new one mounted while another played would find
    // that one's score there and take its own first load for a version switch.
    const loadedMeiRef = useRef<string | undefined | null>(null);
    // A synthesis takes seconds: an audio asked for in the meantime must not be
    // replaced by it when it finishes.
    const loadRequestRef = useRef(0);
    const audioKey = playableAudioKey(audio);
    // Playing an audio that could not be loaded loads it again.
    const [reloadRequest, setReloadRequest] = useState(0);

    useEffect(() => {
        const restorePosition = (position: number) => {
            setPlayingPosition(position);
            if (position > 0) {
                // Reuse the seek path: it restarts the sources when playing, repositions
                // them when paused, and rebuilds the highlighter's event queue either way.
                setSeekPosition(position);
            } else if (playingStateRef.current === PlayingState.PLAYING) {
                startPlayback(0);
            }
        }

        const loadAudio = async (audio: PlayableAudio, resumeAt: number | null) => {
            console.log(audio.kind === 'file' ? `Loading audio from URL: ${audio.url}` : "Synthesizing the score's MIDI");
            const context = getAudioContext();
            if (!context) {
                return
            }
            audioBuffersRef.current.clear();
            setAudioLoadFailed(false);
            const request = ++loadRequestRef.current;
            try {
                const buffer = await loadAudioBuffer(audio, context);
                if (request !== loadRequestRef.current) return;
                audioBuffersRef.current.set('main', buffer);
                setCanPlay(true);
                if (resumeAt != null && playingStateRef.current !== PlayingState.STOPPED) {
                    // A shorter rendering of the same score must not seek past its end.
                    restorePosition(Math.min(resumeAt, buffer.duration * 1000));
                }
            } catch (error) {
                if (request === loadRequestRef.current) {
                    console.error("Failed to load main audio:", error);
                    setAudioLoadFailed(true);
                    // Where it would have resumed stays kept for the next attempt.
                    if (playingStateRef.current === PlayingState.PLAYING) {
                        setPlayingState(PlayingState.PAUSED);
                    }
                }
            }
        }

        const isSameScore = loadedMeiRef.current === originalMei;
        loadedMeiRef.current = originalMei;

        // Versions of the same score need not share a time axis, so the position goes
        // over through the score.
        const resumeAt = isSameScore && playingState !== PlayingState.STOPPED
            ? convertPosition(previousTimemapRef.current, timemap, livePosition())
            : null;

        // Even with the transport stopped: no source of the previous audio may outlive it.
        if (resumeAt == null) {
            stopPlayback();
            if (playingState !== PlayingState.STOPPED) {
                setPlayingState(PlayingState.STOPPED);
            }
        } else {
            // A synthesis can take seconds: meanwhile the listener sees where it will
            // resume, not the start of the score.
            pausePlayback();
            pausedPositionRef.current = resumeAt;
            setPlayingPosition(resumeAt);
        }
        setCanPlay(false);

        if (audio) {
            loadAudio(audio, resumeAt)
        } else {
            loadRequestRef.current++;
            releaseMidiSyntheses(synthesisConsumer);
        }
        // Only a change of audio file or score reloads: the transport state is read to
        // decide where to resume, and reacting to it would reload on every play or pause.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioKey, originalMei, reloadRequest]);


    // We need a clean up effect to release the audio context when the component gets removed.
    useEffect(() => {
        return () => {
            stopPlayback()
            setCanPlay(false)
            setAudioLoadFailed(false)
            releaseMidiSyntheses(synthesisConsumer)
            // The stores are shared: the next viewer must not start out playing.
            setPlayingState(PlayingState.STOPPED)
            resetPlayerPosition()
            if (audioContextRef.current?.state === 'running') {
                audioContextRef.current.suspend().then(() => {
                    console.log("Audio context suspended");
                    audioContextRef.current = null;
                })
            }
        };
        // Unmount cleanup: taking the playback callbacks as dependencies would stop the
        // audio every time one of them is rebuilt.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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
        // A seek request and nothing else: the transport state decides how to serve it,
        // but reacting to it would seek again on every play or pause.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seekPosition]);


    useEffect(() => {
        switch (playingState) {
            case PlayingState.PLAYING:
                if (audioLoadFailed) {
                    setReloadRequest(request => request + 1);
                } else if (needsUserInteractionRef.current) {
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
        // The transport state is the whole trigger: the playback callbacks are rebuilt
        // as the position moves, and reacting to them would restart the audio.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playingState, resumeAudioContext]);

    useEffect(() => {
        previousTimemapRef.current = timemap;
    }, [timemap]);

}
