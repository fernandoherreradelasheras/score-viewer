import { useCallback, useContext, useEffect, useRef } from 'react';
import useStore from "./store";
import { Context } from './Context';
import { useComponentSize } from "react-use-size";
import ScoreProcessor from './ScoreProcessor';
import { useEditorialHandler } from './hooks/useEditorialHandler';
import { expandBBsForEditorialItems, expandBBsForRdgs } from './SvgUtils';
import useScoreActions, { RenderActionResult } from './hooks/useScoreActions';
import useScoreRenderer from './hooks/useScoreRenderer';
import { Transition, PlayingState, loadAction, renderAction } from './types';

export interface ScoreViewProps {
    backgroundColor?: string | undefined;
}


function ScoreView(scoreViewProps: ScoreViewProps) {

    const { backgroundColor } = scoreViewProps;
    const { verovio } = useContext(Context);

    // Store state management
    const setIsLoading = useStore.use.setIsLoading();
    const pendingAction = useStore.use.pendingAction();
    const setPendingAction = useStore.use.setPendingAction();

    const score = useStore.use.score();

    const setScoreLayout = useStore.use.setScoreLayout();

    const showingMei = useStore.use.showingMei();
    const setShowingMei = useStore.use.setShowingMei();
    const playingState = useStore.use.playingState();
    const scale = useStore.use.scale();
    const setScale = useStore.use.setScale();
    const reachedEffectiveMaxScale = useStore.use.reachedEffectiveMaxScale();
    const setReachedEffectiveMaxScale = useStore.use.setReachedEffectiveMaxScale();
    const currentPage = useStore.use.currentPage();
    const pageCount = useStore.use.pageCount();
    const showNVerses = useStore.use.showNVerses();

    const normalizeFicta = useStore.use.normalizeFicta();
    const showEditorial = useStore.use.showEditorial();
    const appOptions = useStore.use.appOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const transposition = useStore.use.transposition();
    const renderedSvgData = useStore.use.renderedSvgData();
    const setRenderedSvgData = useStore.use.setRenderedSvgData();
    const showReconstructions = useStore.use.showReconstructions();
    const showOriginalClefs = useStore.use.showOriginalClefs();
    const showMusicAnalysis = useStore.use.showMusicAnalysis();

    const { handleElementClick } = useEditorialHandler();
    const { ref: svgContainerRef, width: svgContainerWidth, height: svgContainerHeight } = useComponentSize();

    const lastRenderedUrl = useRef<string | undefined | null>(null);

    const {
        svgContainerClasses,
        calculateEffectiveMaxScale,
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
        showOriginalClefs,
        showMusicAnalysis,
        setScoreLayout,
    });

    const isReady = () => (score && verovio && svgContainerWidth > 0 && svgContainerHeight > 0 && !pendingAction)


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
            }

            if (pendingAction.type === "render" && result) {
                // Handle the results of render actions

                const renderResult = result as RenderActionResult
                const { newSvg, scale: newScale } = renderResult;
                setRenderedSvgData(newSvg);

                // will only be visible when showingEditorial is true via css
                expandBBsForEditorialItems();

                const showingReconstructiononsLabels = Object.values(showReconstructions).filter(label => label != "none")
                if (showingReconstructiononsLabels.length > 0) {
                    expandBBsForRdgs(showingReconstructiononsLabels);
                }

                setIsLoading(false);

                setScale(newScale);

                // Calculate max scale after transition completes
                setTimeout(() => {
                    const newMaxScale = calculateEffectiveMaxScale(reachedEffectiveMaxScale);
                    if (newMaxScale !== reachedEffectiveMaxScale) {
                        setReachedEffectiveMaxScale(newMaxScale);
                    }
                }, 400);
            }
        } else {
            console.error("Action execution failed");
        }
    }, [pendingAction, svgContainerHeight]);


    const generateShowingScore = useCallback(() => {
        if (!score) return null;

        const scoreProcessor = new ScoreProcessor(score.originalMei);
        if (normalizeFicta) {
            scoreProcessor.addNormalizeFictaFilter();
        }
        if (showNVerses != null && showNVerses != score.properties?.numVerses) {
            scoreProcessor.addNVersesFilter(showNVerses);
        }
        return scoreProcessor.filterScore();
    }, [score, normalizeFicta, showNVerses]);

    const updateLoadedScore = useCallback((restoreAnchor: boolean, fadeIn: boolean) => {
        const newShowingMei = generateShowingScore();
        if (!newShowingMei) return;
        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: fadeIn ? Transition.FADE_IN : undefined,
            meiStr: newShowingMei,
            page: 1,
            scale,
            restorePositionForAchor: restoreAnchor && renderedSvgData?.anchorElement ? renderedSvgData.anchorElement : undefined
        });
        setPendingAction(action);
        setShowingMei(newShowingMei);
    }, [score, renderedSvgData?.anchorElement, scale, generateShowingScore, setPendingAction, setShowingMei]);

    // This group of changes require rebuilding the score and reloading it
    useEffect(() => {
        if (score) {
            setTimeout(() => {
                updateLoadedScore(false, lastRenderedUrl.current != score.url);
            });
        }
        return () => {
            lastRenderedUrl.current = score?.url
        }
    }, [score?.url]);

    useEffect(() => {
        if (showNVerses != null) {
            updateLoadedScore(true, false);
        }
    }, [showNVerses]);

    useEffect(() => {
        if (normalizeFicta != null) {
            updateLoadedScore(true, false);
        }
    }, [normalizeFicta]);



    // Handle the initial load when verovio has been initialized and when the container is ready.
    // As the component might have been removed from the tree (svgContainerHeight = 0),
    // we check if we have loaded and rendered the same score. Page is also checked because
    // whe might support keep the player going when the component is not visible (switching to text tab,
    // for example).
    useEffect(() => {
        if (!isReady() || !showingMei) {
            return;
        }

        let restoreAnchor;
        if (renderedSvgData && renderedSvgData?.scoreUrl == score?.url) {
            if (renderedSvgData?.height && renderedSvgData?.width &&
                Math.abs(renderedSvgData.height - svgContainerHeight) < 100 &&
                Math.abs(renderedSvgData.width - svgContainerWidth) < 100 &&
                renderedSvgData?.page == currentPage &&
                renderedSvgData?.scale == scale) {
                return
            }
            if (renderedSvgData.anchorElement) {
                restoreAnchor = renderedSvgData.anchorElement
            }
        }

        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: playingState == PlayingState.STOPPED  && !restoreAnchor ? Transition.FADE_IN : undefined,
            meiStr: showingMei,
            page: 1,
            scale,
            restorePositionForAchor: restoreAnchor
         });
        setPendingAction(action);
    }, [verovio, svgContainerRef.current, svgContainerHeight, svgContainerWidth]);


    // Handle scale changes
    useEffect(() => {
        if (!isReady() || !showingMei) return;

        const anchorElement = renderedSvgData?.anchorElement || undefined;

        const transition = (renderedSvgData && renderedSvgData.scale < scale)
            ? Transition.GROW : Transition.NARROW;
        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: transition,
            meiStr: showingMei,
            page: currentPage,
            scale,
            restorePositionForAchor: anchorElement
        });
        setPendingAction(action);
    }, [scale]);

    const reloadScore = () => {
        if (!isReady() || !showingMei) return;

        const page = currentPage > 0 ? currentPage : 1;
        const anchor = renderedSvgData?.anchorElement || undefined;
        const action = loadAction({ scoreUrl: score?.url || "", meiStr: showingMei, page: page, scale, restorePositionForAchor: anchor });
        setPendingAction(action);
    }

    // These changes requires reloading the currently built score
    useEffect(() => {
        reloadScore();
    }, [appOptions, choiceOptions, transposition, showMusicAnalysis]);

    useEffect(() => {
        if (showOriginalClefs == null) {
            return
        }
        reloadScore()
    }, [showOriginalClefs]);

    useEffect(() => {
        if (Object.keys(showReconstructions).length <= 0) {
            return
        }
        reloadScore()
    }, [showReconstructions]);

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
            scoreUrl: renderedSvgData.scoreUrl,
            transition,
            renderPage: currentPage,
            loadedWidth: renderedSvgData.width || svgContainerWidth,
            loadedHeight: renderedSvgData.height || svgContainerHeight,
            scale,
            loadedPagesCount: pageCount,
        });
        setPendingAction(action);
    }, [currentPage]);



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
