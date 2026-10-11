import useStore from "./store";
import PlayerHighlighter from "./PlayerHighlighter";
import PlaybackCursor from "./PlaybackCursor";
import PlayerButtons from "./PlayerButtons";
import useWebAudioPlayer, { PlayableAudio } from "./hooks/useWebAudioPlayer";
import usePlaybackTimemap, { useSelectedAudioSync } from "./hooks/usePlaybackTimemap";
import { useMemo } from "react";


function AudioPlayer() {
    const score = useStore.use.score();
    const renderedSvgData = useStore.use.renderedSvgData();
    const timemap = usePlaybackTimemap();
    const sync = useSelectedAudioSync();
    const selectedAudioIndex = useStore.use.selectedAudioIndex();
    const autoScroll = useStore.use.autoScroll();
    const scoreMidi = useStore.use.scoreMidi();

    const source = score?.audioFiles?.[selectedAudioIndex]?.source ?? null;
    const midi = scoreMidi && scoreMidi.scoreUrl === score?.url ? scoreMidi.midi : null;

    const audio = useMemo((): PlayableAudio | null => {
        if (source?.kind === 'midi') {
            return midi ? { kind: 'midi', midi } : null;
        }
        return source;
    }, [source, midi]);

    useWebAudioPlayer(audio, score?.originalMei, timemap, sync);

    return (
        <div style={{ width: "0px", height: "0px" }}>
            {renderedSvgData?.timemap && (
                <PlayerHighlighter timemap={timemap} />
            )}
            {renderedSvgData?.timemap && !autoScroll && (
                <PlaybackCursor timemap={timemap} />
            )}
            {source ? <PlayerButtons /> : null}
        </div>
    );
}

export default AudioPlayer;
