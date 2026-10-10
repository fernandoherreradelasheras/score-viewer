import useStore from "./store";
import PlayerHighlighter from "./PlayerHighlighter";
import PlaybackCursor from "./PlaybackCursor";
import PlayerButtons from "./PlayerButtons";
import useWebAudioPlayer from "./hooks/useWebAudioPlayer";
import usePlaybackTimemap, { useSelectedAudioSync } from "./hooks/usePlaybackTimemap";
import { useMemo } from "react";


function AudioPlayer() {
    const score = useStore.use.score();
    const renderedSvgData = useStore.use.renderedSvgData();
    const timemap = usePlaybackTimemap();
    const sync = useSelectedAudioSync();
    const selectedAudioIndex = useStore.use.selectedAudioIndex();
    const autoScroll = useStore.use.autoScroll();

    const audioUrl = useMemo(
        () => score?.audioFiles?.[selectedAudioIndex]?.url ?? null,
        [score, selectedAudioIndex]
    );

    useWebAudioPlayer(audioUrl, score?.originalMei, timemap, sync);

    return (
        <div style={{ width: "0px", height: "0px" }}>
            {renderedSvgData?.timemap && (
                <PlayerHighlighter timemap={timemap} />
            )}
            {renderedSvgData?.timemap && !autoScroll && (
                <PlaybackCursor timemap={timemap} />
            )}
            {audioUrl ? <PlayerButtons /> : null}
        </div>
    );
}

export default AudioPlayer;
