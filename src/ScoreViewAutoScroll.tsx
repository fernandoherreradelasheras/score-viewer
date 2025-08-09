import { useContext, useEffect } from 'react';
import useStore from "./store";
import { Context } from './Context';
import { useComponentSize } from "react-use-size";
import useScoreAnimation from './hooks/useScoreAnimation';
import useScoreActions from './hooks/useScoreActions';
import useScoreRenderer from './hooks/useScoreRenderer';
import { PlayingState, Score, loadAutoScrollAction } from './types';
import { ScoreViewProps } from './ScoreView';



function ScoreViewAutoScroll(scoreViewProps: ScoreViewProps) {
    const { backgroundColor } = scoreViewProps;
    const { verovio } = useContext(Context);

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

    const transposition = useStore.use.transposition();

    const showReconstructions = useStore.use.showReconstructions();

    const showOriginalClefs = useStore.use.showOriginalClefs();

    const renderedSvgData = useStore.use.renderedSvgData();
    const setRenderedSvgData = useStore.use.setRenderedSvgData();

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
        verovio,
        svgContainerWidth,
        svgContainerHeight,
        appOptions,
        choiceOptions,
        transposition,
        showReconstructions,
        showOriginalClefs,
        setScoreLayout,
        showMusicAnalysis: false,
        showMusicAnalysisByDefault: false
    });

    const addLoadAction = (score: Score) => {
        if (showEditorial) {
            setShowEditorial(false);
        }
        const action = loadAutoScrollAction({ height: svgContainerHeight, meiStr: score.singleVerseMei });
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

        const { success, nextAction, result } = executeAction(pendingAction, svgContainerRef.current);

        if (success) {
            if (nextAction) {
                setPendingAction(nextAction);
            } else {
                setPendingAction(null);

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
        }
    }, [pendingAction, verovio, showingMei]);


    return (
        <>
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

            <div className={`score-spotlight-overlay ${isSpotlightVisible ? 'visible' : ''}`} />
        </>

    );
}

export default ScoreViewAutoScroll;
