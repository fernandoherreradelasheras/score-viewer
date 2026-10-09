import { Button, Space, Tooltip } from "antd";
import { PlayCircleTwoTone, CloseCircleTwoTone, PauseCircleTwoTone } from '@ant-design/icons';
import useStore from "./store";
import { PlayingState } from "./types";

// The transport of the player, wherever it is shown: the player itself follows the
// playing state of the store.
function PlayerButtons() {
    const playingState = useStore.use.playingState();
    const setPlayingState = useStore.use.setPlayingState();
    const setSeekPosition = useStore.use.setSeekPosition();
    const canPlay = useStore.use.canPlay();

    const stop = () => {
        setPlayingState(PlayingState.STOPPED);
        setSeekPosition(0);
    };

    return (
        <div style={{ position: "absolute", bottom: 0, right: 0, padding: "8px" }}>
            <Space orientation="horizontal" size="small">
                {playingState !== PlayingState.STOPPED ?
                    <Tooltip title="Stop">
                        <Button data-testid="player-stop" icon={<CloseCircleTwoTone style={{ fontSize: '36px' }} />} onClick={stop} />
                    </Tooltip> : null}
                {playingState === PlayingState.PLAYING ?
                    <Tooltip title="Pause">
                        <Button data-testid="player-pause" icon={<PauseCircleTwoTone style={{ fontSize: '36px' }} />}
                            onClick={() => setPlayingState(PlayingState.PAUSED)} />
                    </Tooltip> :
                    <Tooltip title="Play">
                        <Button data-testid="player-play" icon={<PlayCircleTwoTone style={{ fontSize: '36px' }} />}
                            onClick={() => setPlayingState(PlayingState.PLAYING)} disabled={!canPlay} />
                    </Tooltip>}
            </Space>
        </div>
    );
}

export default PlayerButtons;
