import { Button, Space, Tooltip } from "antd";
import useStore from "./store";
import PlayerHighlighter from "./PlayerHighlighter";
import { PlayCircleTwoTone, CloseCircleTwoTone, PauseCircleTwoTone } from '@ant-design/icons';
import { PlayingState } from "./types";
import useWebAudioPlayer from "./hooks/useWebAudioPlayer";
import { useMemo } from "react";

export enum PlayerEventType {
    ERROR,
    SEEK
}

export type PlayerEvent = {
    type: PlayerEventType,
    value?: any
}

function AudioPlayer() {
    const audioSrc = useStore.use.audioUrl();
    const playingState = useStore.use.playingState();
    const renderedSvgData = useStore.use.renderedSvgData();

    const {
        canPlay,
        playPauseTooltip,
        handlePlay,
        handlePlayPause,
        handleStop,
    } = useWebAudioPlayer()


    const playButton = useMemo(() =>
        <Tooltip title="Play"><Button icon={ <PlayCircleTwoTone style={{ fontSize: '36px' }} /> } onClick={handlePlay} disabled={!canPlay}/></Tooltip>
    , [canPlay, handlePlay]);

    const stopButton = useMemo(() =>
        <Tooltip title="Stop"><Button icon={ <CloseCircleTwoTone style={{ fontSize: '36px' }} /> } onClick={handleStop}/></Tooltip>
    , [handleStop]);

    const pauseButton = useMemo(() =>
        <Tooltip title={playPauseTooltip()}><Button icon={ <PauseCircleTwoTone style={{ fontSize: '36px' }} /> } onClick={handlePlayPause} /></Tooltip>
    , [playPauseTooltip, handlePlayPause]);

    // Always show playControls if audioSrc is available, regardless of canPlay status
    const playControls = useMemo(() =>
        audioSrc ?
        <div style={{ position: "absolute", bottom: 0, right: 0, padding: "8px" }}>
            <Space direction="horizontal" size="small">
                {playingState !== PlayingState.STOPPED ? stopButton : null}
                {playingState === PlayingState.PLAYING ? pauseButton : playButton}
            </Space>
        </div> : null,
    [audioSrc, playingState, playButton, stopButton, pauseButton]);


    return (
        <div style={{ width: "0px", height: "0px" }}>
            {renderedSvgData?.timemap && (
                <PlayerHighlighter timemap={renderedSvgData.timemap} />
            )}
            {playControls}
        </div>
    );
}

export default AudioPlayer;
