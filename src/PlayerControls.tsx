import { Row, Col, Slider, Segmented, Select, Tooltip } from "antd";
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
    const score = useStore.use.score()
    const selectedAudioIndex = useStore.use.selectedAudioIndex()
    const setSelectedAudioIndex = useStore.use.setSelectedAudioIndex()

    const [positionString, setPositionString] = useState("00:00")
    const [durationString, setDurationString] = useState("00:00")
    const [playerMode, setPlayerMode] = useState("static")
    const [currentDuration, setCurrentDuration] = useState(audioDuration || 0);

    const seekValue = useRef(0)
    const isChanging = useRef(false)

    useEffect(() => {
        if (audioDuration > 0) {
            setCurrentDuration(audioDuration);
            const durationStr = formatTime(audioDuration);
            setDurationString(durationStr);
        }
    }, [audioDuration]);

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
    }, [setSeekPosition]);


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
                { value: 'scrolling', label: t('playerMode.autoscroll'), icon: <Icon component={ScrollingPlayerSvg} /> },
                { value: 'static', label: t('playerMode.normal'), icon: <Icon component={StaticPlayerSvg} /> }
            ]} />
    )

    // The audio version belongs to the loaded score, not to the viewer settings that
    // persist across scores, so it lives with the transport rather than in the options
    // panel. Only worth showing when there is actually something to choose from.
    const audioFiles = useMemo(() => score?.audioFiles ?? [], [score])
    const hasAudioVersions = audioFiles.length > 1

    const audioVersionOptions = useMemo(() =>
        audioFiles.map((audio, index) => ({
            value: index,
            label: audio.name ?? audio.url.split('/').pop() ?? audio.url
        })),
        [audioFiles])

    const audioVersionSelect = hasAudioVersions ? (
        <Tooltip title={t('audioVersion.description')}>
            <Select<number>
                size="small"
                style={{ width: "100%" }}
                options={audioVersionOptions}
                value={selectedAudioIndex}
                onChange={setSelectedAudioIndex} />
        </Tooltip>
    ) : null

    const playerControls = useMemo(() => (
        <Row align="top" style={{ justifyContent: "left", backgroundColor: "white" }} gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
            <Col span={4} style={{ textAlign: "right" }}>
                {positionString}
            </Col>
            <Col span={hasAudioVersions ? 7 : 10} style={{ width: "300px", height: "30px" }}>
                <Slider
                    style={{ width: "100%", margin: "6px" }}
                    min={0}
                    max={currentDuration}
                    step={1}
                    tooltip={ { formatter: tooltipNullFormater, open: false } }
                    value={seekValue.current}
                    onChange={handleSliderChange}
                    onChangeComplete={handleSliderChangeComplete} />
            </Col>
            <Col span={4} style={{ textAlign: "left" }}>
                {durationString}
            </Col>
            {hasAudioVersions ?
                <Col span={4}>
                    {audioVersionSelect}
                </Col> : null}
            <Col span={hasAudioVersions ? 5 : 6} style={{ textAlign: "right" }}>
                {playModeSegmented}
            </Col>
        </Row>
    ), [durationString, positionString, playerMode, currentDuration, seekValue.current, handleSliderChange, handleSliderChangeComplete, hasAudioVersions, audioVersionSelect])

    return (
        playerControls
    )
}

export default PlayerControls
