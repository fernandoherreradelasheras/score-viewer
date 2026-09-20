import { useSwipeable } from 'react-swipeable';
import AudioPlayer from './AudioPlayer';
import Editorials from './Editorials';
import ScoreControls from './ScoreControls';
import ScoreView from './ScoreView';
import ScoreViewAutoScroll from './ScoreViewAutoScroll';
import useStore from "./store";
import { TimeMapEvent, PlayingState } from './types';
import { forwardRef, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useIsVisible } from './hooks/useIsVisible';
import MouseTracker from './MouseTracker';
import { useTranslation } from 'react-i18next';


const getAudioDurationMillis = (timemap: TimeMapEvent[]) => {
    return timemap[timemap.length - 1]?.tstamp || 0;
};


export interface ScoreViewContainerProps {
    backgroundColor?: string | undefined;
    showDownloadButton?: boolean | undefined;
    height: string;
}

export interface ScoreViewContainerRef {
    scrollIntoView: () => void
}

function ScoreViewContainer(scoreViewContainerProps: ScoreViewContainerProps, ref: Ref<ScoreViewContainerRef>) {
    const { t } = useTranslation("common")

    const { backgroundColor, height } = scoreViewContainerProps;

    const score = useStore.use.score();
    const autoScroll = useStore.use.autoScroll();
    const setAutoScroll = useStore.use.setAutoScroll();
    const playingState = useStore.use.playingState();
    const setPlayingState = useStore.use.setPlayingState();
    const currentPage = useStore.use.currentPage();
    const goToNextPage = useStore.use.goToNextPage();
    const goToPreviousPage = useStore.use.goToPreviousPage();
    const pageCount = useStore.use.pageCount();
    const resetPlayerPosition = useStore.use.resetPlayerPosition();
    const showEditorial = useStore.use.showEditorial();
    const showingEditorial = useStore.use.showingEditorial();
    const renderedSvgData = useStore.use.renderedSvgData();

    const [mouseOver, setMouseOver] = useState(false);


    const scoreViewerRef = useRef<HTMLDivElement>(null);
    // The controls and the mouse tracker need the container element itself, so it is
    // held as state as well: reading the ref while rendering would leave them waiting
    // for whatever renders the component next.
    const [scoreViewerElement, setScoreViewerElement] = useState<HTMLDivElement | null>(null);

    const attachScoreViewer = useCallback((node: HTMLDivElement | null) => {
        scoreViewerRef.current = node;
        setScoreViewerElement(node);
    }, []);

    const isScoreVisible = useIsVisible(scoreViewerRef);

    useImperativeHandle(ref, () => ({
        scrollIntoView: () => {
            scoreViewerRef.current?.scrollIntoView(true);
        }
    }));


    // Set up swipe handlers for page navigation
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => {
            if (playingState != PlayingState.PLAYING && currentPage < pageCount) {
                resetPlayerPosition();
                goToNextPage();
            }
        },
        onSwipedRight: () => {
            if (playingState != PlayingState.PLAYING && currentPage > 1) {
                resetPlayerPosition();
                goToPreviousPage()
            }
        },
        delta: 10,
        swipeDuration: 300,
        preventScrollOnSwipe: true,
    });


    const audioDuration = useMemo(() => {
        return renderedSvgData?.timemap && renderedSvgData.timemap.length > 0 ?
            getAudioDurationMillis(renderedSvgData.timemap) : 0;
    }, [renderedSvgData]);

    // Pause when not visible
    useEffect(() => {
        if (!isScoreVisible && playingState == PlayingState.PLAYING) {
            setPlayingState(PlayingState.PAUSED);
        }
        // Only the moment the score leaves the view pauses it; reacting to the playing
        // state as well would pause a playback started while the score is hidden.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isScoreVisible]);

    useEffect(() => {
        if (playingState != PlayingState.STOPPED) {
            setPlayingState(PlayingState.STOPPED);
        }
        // Only a change of score stops the player: reacting to the playing state as well
        // would stop every playback as soon as it starts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [score])

    useEffect(() => {
        if (playingState == PlayingState.STOPPED) {
            if (autoScroll) {
                setAutoScroll(false);
            }
        }
        // Only the playback stopping turns auto-scroll off: reacting to the flag as well
        // would undo it the moment the reader turns it on with the player stopped.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playingState]);



    return (
        <div ref={attachScoreViewer}
            className={"score-viewer" + (playingState !== PlayingState.STOPPED ? " player-active" : "")}
            onMouseEnter={() => setMouseOver(true)} onMouseLeave={() => setMouseOver(false)}
            style={{
                position: "relative",
                width: "100%",
                height: height
            }}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                {scoreViewerElement ? <ScoreControls
                    style={{ flex: "0" }}
                    fullScreenElement={scoreViewerElement}
                    showDownloadButton={scoreViewContainerProps.showDownloadButton ?? false}
                    backgroundColor={backgroundColor}
                    audioDuration={audioDuration} /> : null}

                <div className="score-container swipeable-container"
                    {...swipeHandlers}
                    style={{
                        flex: "1",
                        backgroundColor: backgroundColor,
                        width: "100%",
                        overflow: "hidden",
                    }}>

                    {autoScroll ? <ScoreViewAutoScroll backgroundColor={backgroundColor} />
                        : <ScoreView backgroundColor={backgroundColor} />}

                </div>
            </div>

            <AudioPlayer />

            {/* Without showing editorial content we still want to show the Editorials element
             for the editorial popup launched from score info dialog  */}
            {(showEditorial || showingEditorial) && renderedSvgData?.id ? <Editorials /> : null}

            {scoreViewerElement && mouseOver && <MouseTracker
                track={scoreViewerElement}
                getContent={(e) => {
                    const staffBB = (e.target as Element)?.closest('g.staff.content-bounding-box');
                    const measure = (e.target as Element)?.closest('g.measure');
                    const n = measure?.getAttribute('data-n');
                    return staffBB && n ? t('score.measureNumber', { 'number': n }) : undefined;
                }}
            />}
        </div>
    );
}

export default forwardRef<ScoreViewContainerRef, ScoreViewContainerProps>(ScoreViewContainer)

