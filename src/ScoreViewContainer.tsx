import { useSwipeable } from 'react-swipeable';
import AudioPlayer from './AudioPlayer';
import Editorials from './Editorials';
import ScoreControls from './ScoreControls';
import ScoreView from './ScoreView';
import ScoreViewAutoScroll from './ScoreViewAutoScroll';
import useStore from "./store";
import { TimeMapEvent, PlayingState } from './types';
import { forwardRef, Ref, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useIsVisible } from './hooks/useIsVisible';


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
    const { backgroundColor, height } = scoreViewContainerProps;

    const score = useStore.use.score();
    const autoScroll = useStore.use.autoScroll();
    const setAutoScroll = useStore.use.setAutoScroll();
    const audioUrl = useStore.use.audioUrl();
    const playingState = useStore.use.playingState();
    const setPlayingState = useStore.use.setPlayingState();
    const currentPage = useStore.use.currentPage();
    const goToNextPage = useStore.use.goToNextPage();
    const goToPreviousPage = useStore.use.goToPreviousPage();
    const pageCount = useStore.use.pageCount();
    const resetPlayerPosition = useStore.use.resetPlayerPosition();
    const showEditorial = useStore.use.showEditorial();
    const renderedSvgData = useStore.use.renderedSvgData();

    const scoreViewerRef = useRef<HTMLDivElement>(null);

    const isScoreVisible = useIsVisible(scoreViewerRef);

    useImperativeHandle(ref, () => ({
        scrollIntoView: () => {
            scoreViewerRef.current?.scrollIntoView(true);
        }
      }));


    // Set up swipe handlers for page navigation
    const swipeHandlers = useSwipeable({
        onSwipedLeft: (_) => {
            if (playingState != PlayingState.PLAYING && currentPage < pageCount) {
                resetPlayerPosition();
                goToNextPage();
            }
        },
        onSwipedRight: (_) => {
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
    }, [isScoreVisible]);

    useEffect(() => {
        if (playingState != PlayingState.STOPPED) {
            setPlayingState(PlayingState.STOPPED);
        }
    }, [score])

    useEffect(() => {
        if (playingState == PlayingState.STOPPED) {
            if (autoScroll) {
                setAutoScroll(false);
            }
        }
    }, [playingState]);



    return (
        <div ref={scoreViewerRef}
            className="score-viewer"
            style={{
                position: "relative",
                width: "100%",
                height: height
            }}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                { scoreViewerRef.current ? <ScoreControls
                    style={{ flex: "0" }}
                    fullScreenElement={scoreViewerRef.current}
                    showDownloadButton={scoreViewContainerProps.showDownloadButton ?? false}
                    audioDuration={audioDuration}/> : null }

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

            {audioUrl ? <AudioPlayer /> : null}

            {showEditorial && renderedSvgData?.id ? <Editorials /> : null}
        </div>
    );
}

export default forwardRef<ScoreViewContainerRef, ScoreViewContainerProps>(ScoreViewContainer)

