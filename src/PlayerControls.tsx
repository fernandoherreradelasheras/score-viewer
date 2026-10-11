import { Row, Col, Slider, Segmented } from "antd";
import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import useStore from "./store";
import Icon from "@ant-design/icons";
import StaticPlayerSvg from "../assets/static-player.svg?react";
import ScrollingPlayerSvg from "../assets/scrolling-player.svg?react";
import { useTranslation } from "react-i18next";

const str2padded = (n: number) => (Math.floor(n)).toString().padStart(2, '0')

const formatTime = (millis: number) => {
    const mins = str2padded(millis / 1000 / 60)
    const secs = str2padded((millis / 1000) % 60)
    return `${mins}:${secs}`
}

const tooltipNullFormater  = (_?: number) => null


export interface PlayerControlProps {
    audioDuration?: number;
}


function PlayerControls({ audioDuration = 0 }: PlayerControlProps) {
    const { t } = useTranslation("common")

    const playingPosition = useStore.use.playingPosition()
    const setSeekPosition = useStore.use.setSeekPosition()
    const setAutoScroll = useStore.use.setAutoScroll()

    const [positionString, setPositionString] = useState("00:00")
    const [durationString, setDurationString] = useState(() => formatTime(audioDuration))
    const [playerMode, setPlayerMode] = useState("static")
    const [currentDuration, setCurrentDuration] = useState(audioDuration || 0);

    const seekValue = useRef(0)
    const isChanging = useRef(false)

    // The duration on show is the last one that was known: while a score is being
    // switched the player reports none, and blanking the transport for that moment would
    // only flicker. Adjusted while rendering so the new duration and the new score are
    // painted together.
    const [renderedAudioDuration, setRenderedAudioDuration] = useState(audioDuration);
    if (audioDuration !== renderedAudioDuration) {
        setRenderedAudioDuration(audioDuration);
        if (audioDuration > 0) {
            setCurrentDuration(audioDuration);
            setDurationString(formatTime(audioDuration));
        }
    }

    const updateTime = useCallback((position: number) => {
        seekValue.current = position
        const currentTimeStr = formatTime(position)
        if (currentTimeStr != positionString) {
            setPositionString(currentTimeStr)
        }
    }, [positionString])

    const handleSliderChange = useCallback((v: number) => {
        isChanging.current = true
        seekValue.current = Math.round(v)
    }, []);

    const handleSliderChangeComplete = useCallback((_: number) => {
        isChanging.current = false
        setSeekPosition(seekValue.current)
        updateTime(Math.round(seekValue.current))
    }, [setSeekPosition, updateTime]);


    useEffect(() => {
        if (isChanging.current) {
            return
        }

        const roundedPostion = Math.round(playingPosition)
        if (roundedPostion == seekValue.current) {
            return
        }
        updateTime(roundedPostion)
    }, [playingPosition, updateTime])

    const onPlayerModeChange = useCallback((value: string) => {
        setPlayerMode(value)
        if (value == "scrolling") {
            setAutoScroll(true)
        } else if (value == "static") {
            setAutoScroll(false);
        }
    }, [setAutoScroll])


    const playModeSegmented = useMemo(() => (
        <Segmented
            size="small"
            shape="default"
            onChange={onPlayerModeChange}
            value={playerMode}
            options={[
                { value: 'scrolling', label: t('playerMode.autoscroll'), icon: <Icon component={ScrollingPlayerSvg} /> },
                { value: 'static', label: t('playerMode.normal'), icon: <Icon component={StaticPlayerSvg} /> }
            ]} />
    ), [onPlayerModeChange, playerMode, t])

    const playerControls = useMemo(() => (
        <Row align="top" style={{ justifyContent: "left", backgroundColor: "white" }} gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
            <Col span={4} style={{ textAlign: "right" }}>
                {positionString}
            </Col>
            <Col span={10} style={{ width: "300px", height: "30px" }}>
                <Slider
                    style={{ width: "100%", margin: "6px" }}
                    min={0}
                    max={currentDuration}
                    step={1}
                    tooltip={ { formatter: tooltipNullFormater, open: false } }
                    // The position moves with every audio frame while the transport is
                    // repainted once a second, when the displayed time changes: holding
                    // it as state would re-render the player at the frame rate.
                    // eslint-disable-next-line react-hooks/refs
                    value={seekValue.current}
                    onChange={handleSliderChange}
                    onChangeComplete={handleSliderChangeComplete} />
            </Col>
            <Col span={4} style={{ textAlign: "left" }}>
                {durationString}
            </Col>
            <Col span={6} style={{ textAlign: "right" }}>
                {playModeSegmented}
            </Col>
        </Row>
    ), [durationString, positionString, currentDuration, handleSliderChange, handleSliderChangeComplete, playModeSegmented])

    return (
        playerControls
    )
}

export default PlayerControls
