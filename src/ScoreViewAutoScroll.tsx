import { useCallback, useContext, useEffect, useState } from 'react';
import useStore from "./store";
import { Context } from './Context';
import { useComponentSize } from "react-use-size";
import useScoreAnimation from './hooks/useScoreAnimation';
import useScoreActions from './hooks/useScoreActions';
import useScoreRenderer, { RenderedData } from './hooks/useScoreRenderer';
import { PlayingState, Score, loadAutoScrollAction } from './types';
import { ScoreViewProps } from './ScoreView';
import LoadingSpinner from './components/LoadingSpinner';
import { getReverseTransposition } from './utils/score-utils';



function ScoreViewAutoScroll(scoreViewProps: ScoreViewProps) {
    const { backgroundColor } = scoreViewProps;
    const { verovio } = useContext(Context);

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
    const withoutTransposition = useStore.use.withoutTransposition();

    const renderedSvgData = useStore.use.renderedSvgData();
    const setRenderedSvgData = useStore.use.setRenderedSvgData();

    const [showSpinner, setShowSpinner] = useState(false);

    const { ref: svgContainerRef, width: _, height: svgContainerHeight } = useComponentSize();


    const {
        svgContainerClasses,
        isSpotlightVisible
    } = useScoreRenderer({
        autoScroll: true,
        showEditorial,
        playingState,
        svgContainerRef,
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
        verovio
    });

    const addLoadAction = useCallback((score: Score) => {
        if (showEditorial) {
            setShowEditorial(false);
        }
        const transposition = withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null;
        const action = loadAutoScrollAction({ height: svgContainerHeight, meiStr: score.singleVerseMei, transposition });
        setPendingAction(action);
    }, [showEditorial, setShowEditorial, withoutTransposition, svgContainerHeight, setPendingAction])

    useEffect(() => {
        if (!score || !verovio || svgContainerHeight <= 0) {
            return;
        }
        addLoadAction(score)
        // The initial load, once the container is mounted: the size-driven effect below
        // is what picks up every later change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!score || !verovio || svgContainerHeight <= 0) {
            return;
        }
        if (!renderedSvgData || renderedSvgData.id != "svg-auto-scrolling") {
            addLoadAction(score);
        }
        // Only a change of the container height reloads the auto-scroll score: the score
        // and the toolkit are read when it runs, not reacted to.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                            const autoScrollResult = result as { newSvg: RenderedData };
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
        // Driven by the pending action alone: the playback state and position are read
        // when the action completes, and reacting to them would run the action again.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
