import { useContext, useEffect, useState } from 'react';
import useStore from "./store";
import { Context } from './Context';
import { useComponentSize } from "react-use-size";
import useScoreAnimation from './hooks/useScoreAnimation';
import useScoreActions from './hooks/useScoreActions';
import useScoreRenderer from './hooks/useScoreRenderer';
import { PlayingState, Score, loadAutoScrollAction } from './types';
import { ScoreViewProps } from './ScoreView';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from './components/LoadingSpinner';
import { getReverseTransposition } from './utils/score-utils';



function ScoreViewAutoScroll(scoreViewProps: ScoreViewProps) {
    const { backgroundColor } = scoreViewProps;
    const { verovio } = useContext(Context);
    const { t } = useTranslation("common");

    const setScoreLayout = useStore.use.setScoreLayout();

    const setIsLoading = useStore.use.setIsLoading();
    const pendingAction = useStore.use.pendingAction();
    const setPendingAction = useStore.use.setPendingAction();
    const score = useStore.use.score();
    const showingMei = useStore.use.showingMei();
    const seekPosition = useStore.use.seekPosition();
    const playingPosition = useStore.use.playingPosition();
    const playingState = useStore.use.playingState();
    const setPlayingState = useStore.use.setPlayingState();
    const showEditorial = useStore.use.showEditorial();
    const setShowEditorial = useStore.use.setShowEditorial();
    const appOptions = useStore.use.appOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const withoutTransposition = useStore.use.withoutTransposition();

    const showOriginalClefs = useStore.use.showOriginalClefs();
    const measureNumberInterval = useStore.use.measureNumberInterval();

    const renderedSvgData = useStore.use.renderedSvgData();
    const setRenderedSvgData = useStore.use.setRenderedSvgData();

    const [showSpinner, setShowSpinner] = useState(false);

    const { ref: svgContainerRef, width: svgContainerWidth, height: svgContainerHeight } = useComponentSize();


    const {
        svgContainerClasses,
        isSpotlightVisible
    } = useScoreRenderer({
        autoScroll: true,
        showEditorial,
        playingState,
        svgContainerRef,
        svgContainerHeight
    });

    const {
        startAnimation,
        setupAutoScrollLayout
    } = useScoreAnimation({
        playingState,
        seekPosition,
        svgContainerRef,
    });

    const { executeAction } = useScoreActions({
        t,
        verovio,
        svgContainerWidth,
        svgContainerHeight,
        appOptions,
        choiceOptions,
        showOriginalClefs,
        setScoreLayout,
        showMusicAnalysis: false,
        measureNumberInterval,
        showMusicAnalysisByDefault: false,
    });

    const addLoadAction = (score: Score) => {
        if (showEditorial) {
            setShowEditorial(false);
        }
        const transposition = withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null;
        const action = loadAutoScrollAction({ height: svgContainerHeight, meiStr: score.singleVerseMei, transposition });
        setPendingAction(action);
    }

    useEffect(() => {
        if (!score || !verovio || svgContainerHeight <= 0) {
            return;
        }
        addLoadAction(score)
    }, [svgContainerRef.current])

    useEffect(() => {
        if (!score || !verovio || svgContainerHeight <= 0) {
            return;
        }
        if (!renderedSvgData || renderedSvgData.id != "svg-auto-scrolling") {
            addLoadAction(score);
        }
    }, [svgContainerHeight])


    // Process pending actions
    useEffect(() => {
        if (!pendingAction || !verovio || !showingMei || !svgContainerRef.current) {
            return;
        }

        (async () => {
            const { success, nextAction, result, showSpinner: shouldShowSpinner } = await executeAction(pendingAction, svgContainerRef.current!);

            // Show spinner for heavy operations
            if (shouldShowSpinner) {
                setShowSpinner(true);
            }

            if (success) {
                if (nextAction) {
                    setPendingAction(nextAction);
                } else {
                    setPendingAction(null);
                    // Hide spinner when all actions complete
                    setShowSpinner(false);

                    // Handle the results of render actions
                    if (result) {
                        if (pendingAction.type === "renderAutoScroll") {
                            const autoScrollResult = result as { newSvg: any };
                            const { newSvg } = autoScrollResult;
                            setRenderedSvgData(newSvg);
                            setIsLoading(false);
                            setupAutoScrollLayout();
                            if (playingState == PlayingState.PLAYING) {
                                startAnimation(newSvg, playingPosition, false);
                            } else if (playingState == PlayingState.PAUSED) {
                                startAnimation(newSvg, playingPosition, true);
                            } else {
                                startAnimation(newSvg, 0, false);
                                setPlayingState(PlayingState.PLAYING);
                            }
                        }
                    }
                }
            } else {
                console.error("Action execution failed");
                setShowSpinner(false);
            }
        })();
    }, [pendingAction, verovio, showingMei]);


    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div ref={svgContainerRef}
                className={"scrolling-score " + svgContainerClasses.join(" ")}
                style={{
                    width: "100%",
                    height: "100%",
                    background: backgroundColor || 'white',
                    transform: "translate3d(0,0,0)",
                    backfaceVisibility: "hidden",
                    perspective: "1000px",
                    "--score-bg-color": backgroundColor
                } as React.CSSProperties} />

            <LoadingSpinner visible={showSpinner} />
            <div className={`score-spotlight-overlay ${isSpotlightVisible ? 'visible' : ''}`} />
        </div>

    );
}

export default ScoreViewAutoScroll;
