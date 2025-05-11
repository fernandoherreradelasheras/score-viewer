import { useContext, useEffect } from 'react';
import useStore from "./store";
import { Context } from './Context';
import { useComponentSize } from "react-use-size";
import ScoreProcessor from './ScoreProcessor';
import { useEditorialHandler } from './hooks/useEditorialHandler';
import { expandBBsForEditorialItems } from './SvgUtils';
import useScoreActions from './hooks/useScoreActions';
import useScoreRenderer from './hooks/useScoreRenderer';
import { Transition, PlayingState, loadAction, renderAction } from './types';

export interface ScoreViewProps {
    backgroundColor?: string
}


function ScoreView(scoreViewProps: ScoreViewProps) {
    const { backgroundColor } = scoreViewProps;
    const { verovio } = useContext(Context);

    // Store state management
    const setIsLoading = useStore.use.setIsLoading();
    const pendingAction = useStore.use.pendingAction();
    const setPendingAction = useStore.use.setPendingAction();
    const score = useStore.use.score();
    const showingMei = useStore.use.showingMei();
    const setShowingMei = useStore.use.setShowingMei();
    const playingState = useStore.use.playingState();
    const scale = useStore.use.scale();
    const setScale = useStore.use.setScale();
    const reachedEffectiveMaxScale = useStore.use.reachedEffectiveMaxScale();
    const setReachedEffectiveMaxScale = useStore.use.setReachedEffectiveMaxScale();
    const currentPage = useStore.use.currentPage();
    const setCurrentPage = useStore.use.setCurrentPage();
    const pageCount = useStore.use.pageCount();
    const setPageCount = useStore.use.setPageCount();
    const showNVerses = useStore.use.showNVerses();
    const normalizeFicta = useStore.use.normalizeFicta();
    const showEditorial = useStore.use.showEditorial();
    const appOptions = useStore.use.appOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const section = useStore.use.section();
    const setSection = useStore.use.setSection();
    const transposition = useStore.use.transposition();
    const renderedSvgData = useStore.use.renderedSvgData();
    const setRenderedSvgData = useStore.use.setRenderedSvgData();
    const showReconstructions = useStore.use.showReconstructions();
    const showOriginalClefs = useStore.use.showOriginalClefs();

    // References and component state
    const { handleElementClick } = useEditorialHandler();
    const { ref: svgContainerRef, width: svgContainerWidth, height: svgContainerHeight } = useComponentSize();

    // Use our custom hooks for SVG rendering, animation, and actions
    const {
        svgContainerClasses,
        calculateEffectiveMaxScale,
        fadeOutScore,
    } = useScoreRenderer({
        autoScroll: false,
        showEditorial,
        playingState,
        svgContainerRef,
        svgContainerHeight
    });

    const { executeAction } = useScoreActions({
        verovio,
        svgContainerWidth,
        svgContainerHeight,
        appOptions,
        choiceOptions,
        transposition,
        showReconstructions,
        showOriginalClefs
    });


    const isReady = () => (score && verovio && svgContainerWidth > 0 && svgContainerHeight > 0 && !pendingAction)

    const generateShowingScore = () => {
        if (!score) return null;

        const scoreProcessor = new ScoreProcessor(score.originalMei);
        if (normalizeFicta) {
            scoreProcessor.addNormalizeFictaFilter();
        }
        if (showNVerses != null && showNVerses != score.properties?.numVerses) {
            scoreProcessor.addNVersesFilter(showNVerses);
        }
        return scoreProcessor.filterScore();
    };

    const updateScore = (restoreAnchor: boolean) => {
        fadeOutScore();

        const newShowingMei = generateShowingScore();
        if (!newShowingMei) return;

        const action = loadAction({
            postLoadTransition: Transition.FADE_IN,
            meiStr: newShowingMei,
            page: 1,
            scale,
            restorePositionForAchor: restoreAnchor && renderedSvgData?.anchorElement ? renderedSvgData.anchorElement : undefined
        });
        setPendingAction(action);
        setShowingMei(newShowingMei);
    };

    // Process pending actions
    useEffect(() => {
        if (!pendingAction || !verovio || !showingMei || !svgContainerRef.current || svgContainerHeight <= 0) {
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
                    if (pendingAction.type === "render") {
                        const renderResult = result as { newSvg: any; loadedPagesCount: number; scale: number; renderPage: number };
                        const { newSvg, loadedPagesCount, scale: newScale, renderPage } = renderResult;
                        setRenderedSvgData(newSvg);

                        if (showEditorial) {
                            expandBBsForEditorialItems();
                        }
                        setIsLoading(false);
                        setPageCount(loadedPagesCount);
                        setScale(newScale);
                        setCurrentPage(renderPage);

                        // Calculate max scale after transition completes
                        setTimeout(() => {
                            const newMaxScale = calculateEffectiveMaxScale(reachedEffectiveMaxScale);
                            if (newMaxScale !== reachedEffectiveMaxScale) {
                                setReachedEffectiveMaxScale(newMaxScale);
                            }
                        }, 400);
                    }

                }
            }
        } else {
            console.error("Action execution failed");
        }
    }, [pendingAction, svgContainerHeight]);

    // Update the score when it changes
    useEffect(() => {
        updateScore(false);
    }, [score]);

    // Update score when verses or ficta settings change
    useEffect(() => {
        updateScore(true);
    }, [showNVerses, normalizeFicta]);

    // Handle the initial load when verovio and the container are ready
    useEffect(() => {
        if (!isReady() || !showingMei) return

        const action = loadAction({
            postLoadTransition: playingState == PlayingState.STOPPED ? Transition.FADE_IN : undefined,
            meiStr: showingMei, page: 1, scale });
        setPendingAction(action);

    }, [verovio, svgContainerRef.current]);




    // Handle scale changes
    useEffect(() => {
        if (!isReady() || !showingMei) return;

        const anchorElement = renderedSvgData?.anchorElement || undefined;

        const transition = (renderedSvgData && renderedSvgData.scale < scale)
            ? Transition.GROW : Transition.NARROW;
        const action = loadAction({
            postLoadTransition: transition,
            meiStr: showingMei,
            page: currentPage,
            scale,
            restorePositionForAchor: anchorElement
        });
        setPendingAction(action);
    }, [scale]);

    useEffect(() => {
        if (!isReady() || !showingMei) return;

        const page = currentPage > 0 ? currentPage : 1;
        const anchor = renderedSvgData?.anchorElement || undefined;
        const action = loadAction({ meiStr: showingMei, page: page, scale, restorePositionForAchor: anchor });
        setPendingAction(action);
    }, [appOptions, choiceOptions, transposition, showReconstructions, showOriginalClefs]);

    useEffect(() => {
        if (!isReady() || !showingMei || !renderedSvgData) return;

        if (currentPage < 1 || currentPage == renderedSvgData.page) {
            return;
        }

        var transition = undefined
        if (playingState != PlayingState.PLAYING) {
            transition = currentPage > renderedSvgData.page ? Transition.SLIDE_LEFT : Transition.SLIDE_RIGHT;
        }
        const action = renderAction({
            transition,
            renderPage: currentPage,
            loadedWidth: renderedSvgData.width || svgContainerWidth,
            loadedHeight: renderedSvgData.height || svgContainerHeight,
            scale,
            loadedPagesCount: pageCount
        });
        setPendingAction(action);
    }, [currentPage]);

    useEffect(() => {
        if (!isReady() || !showingMei || !renderedSvgData || currentPage < 1) return;

        if (section != null) {
            const page = verovio.getPageWithElement(section);
            setSection(null);
            if (page != null && page > 0 && page != currentPage) {
                setCurrentPage(page);
            }
        }
    }, [section]);


    return (
        <div ref={svgContainerRef}
            className={"static-score " + svgContainerClasses.join(" ")}
            style={{
                width: "100%",
                height: "100%",
                background: backgroundColor || 'white',
                "--score-bg-color": backgroundColor
            } as React.CSSProperties}
            onClick={handleElementClick} />

    );
}

export default ScoreView;
