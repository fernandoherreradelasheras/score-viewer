import { Button, Space, Tooltip } from "antd";
import useStore from "./store";
import PlayerHighlighter from "./PlayerHighlighter";
import {  PlayCircleTwoTone, CloseCircleTwoTone, PauseCircleTwoTone } from '@ant-design/icons';
import { PlayingState } from "./types";
import useAudioPlayer from "./hooks/useAudioPlayer";



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
        audioRef,
        canPlay,
        playPauseTooltip,
        handlePlay,
        handlePlayPause,
        handleStop,
        onTimeUpdate,
        onAudioEnded,
        onCanPlayThrough,
        onError
    } = useAudioPlayer(renderedSvgData?.timemap || null);


    const playButton =  <Tooltip title="Play"><Button icon={ <PlayCircleTwoTone style={{ fontSize: '36px' }} /> } onClick={handlePlay} /></Tooltip>
    const stopButton =  <Tooltip title="Stop"><Button icon={ <CloseCircleTwoTone style={{ fontSize: '36px' }} /> } onClick={handleStop}/></Tooltip>
    const pauseButton = <Tooltip title={playPauseTooltip()}><Button icon={ <PauseCircleTwoTone style={{ fontSize: '36px' }} /> } onClick={handlePlayPause} /></Tooltip>

    const playControls = (audioRef.current && audioSrc && canPlay) ?
        <div style={{ position: "absolute", bottom: 0, right: 0, padding: "8px" }}>
            <Space  direction="horizontal" size="small">
                {playingState != PlayingState.STOPPED ? stopButton: null  }
                {playingState == PlayingState.PLAYING ? pauseButton : playButton }
            </Space>
        </div> : null


    return (
        <div style={{ width: "0px", height: "0px" }} >
            {audioSrc && (
                <audio
                    ref={audioRef}
                    preload="auto"
                    key={audioSrc}
                    src={audioSrc}
                    onError={onError}
                    onEnded={onAudioEnded}
                    onTimeUpdate={onTimeUpdate}
                    onCanPlayThrough={onCanPlayThrough}
                />
            )}
            {renderedSvgData?.timemap && (
                <PlayerHighlighter timemap={renderedSvgData.timemap} />
            )}
            {playControls}
        </div>
    );
}

export default AudioPlayer;