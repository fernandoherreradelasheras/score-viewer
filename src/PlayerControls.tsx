import { Row, Col, Slider, Segmented } from "antd";
import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import useStore from "./store";
import Icon from "@ant-design/icons";
import StaticPlayerSvg from "../assets/static-player.svg?react";
import ScrollingPlayerSvg from "../assets/scrolling-player.svg?react";

const str2padded = (n: number) => (Math.floor(n)).toString().padStart(2, '0')

const formatTime = (millis: number) => {
    const mins = str2padded(millis / 1000 / 60)
    const secs = str2padded((millis / 1000) % 60)
    return `${mins}:${secs}`
}

const tooltipNullFormater  = (_?: number) => null


interface PlayerControlProps {
    audioDuration: number
}


function PlayerControls({ audioDuration }: PlayerControlProps) {

    const playingPosition = useStore.use.playingPosition()
    const setSeekPosition = useStore.use.setSeekPosition()
    const setAutoScroll = useStore.use.setAutoScroll()

    const [positionString, setPositionString] = useState("00:00")
    const [durationString, setDurationString] = useState("00:00")
    const [playerMode, setPlayerMode] = useState("static")

    const seekValue = useRef(0)
    const isChanging = useRef(false)


    useEffect(() => {
        const durationStr = formatTime(audioDuration)
        setDurationString(durationStr)
    }, [audioDuration])


    const updateTime = (position: number) => {
        seekValue.current = position
        const currentTimeStr = formatTime(position)
        if (currentTimeStr != positionString) {
            setPositionString(currentTimeStr)
        }
    }

    const handleSliderChange = useCallback((v: number) => {
        isChanging.current = true
        seekValue.current = Math.round(v)
    }, []);

    const handleSliderChangeComplete = useCallback((_: number) => {
        isChanging.current = false
        setSeekPosition(seekValue.current)
        updateTime(Math.round(seekValue.current))
    }, []);


    useEffect(() => {
        if (isChanging.current) {
            return
        }

        const roundedPostion = Math.round(playingPosition)
        if (roundedPostion == seekValue.current) {
            return
        }
        updateTime(roundedPostion)
    }, [playingPosition])

    const onPlayerModeChange = (value: string) => {
        setPlayerMode(value)
        if (value == "scrolling") {
            setAutoScroll(true)
        } else if (value == "static") {
            setAutoScroll(false);
        }
    }

    const playModeSegmented = (
        <Segmented
            size="small"
            shape="default"
            onChange={onPlayerModeChange}
            value={playerMode}
            options={[
                { value: 'scrolling', label: "auto scroll", icon: <Icon component={ScrollingPlayerSvg} /> },
                { value: 'static', label: "normal", icon: <Icon component={StaticPlayerSvg} /> }
            ]} />
    )


    const playerControls = useMemo(() => (
        <Row align="top" style={{ justifyContent: "left", backgroundColor: "white" }} gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
            <Col span={4} style={{ textAlign: "right" }}>
                {positionString}
            </Col>
            <Col span={10} style={{ width: "300px", height: "30px" }}>
                <Slider
                    style={{ width: "100%", margin: "6px" }}
                    min={0}
                    max={audioDuration}
                    step={1}
                    tooltip={ { formatter: tooltipNullFormater, open: false } }
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
    ), [durationString, positionString, playerMode])


    return (
        playerControls
    )
}

export default PlayerControls