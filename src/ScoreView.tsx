import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import useStore from "./store";
import { Context } from './Context';
import { useComponentSize } from "react-use-size";
import ScoreProcessor from './ScoreProcessor';
import { useEditorialHandler } from './hooks/useEditorialHandler';
import useScoreActions, { RenderActionResult } from './hooks/useScoreActions';
import useScoreRenderer from './hooks/useScoreRenderer';
import { Action, Transition, loadAction, renderAction } from './types';
import LoadingSpinner from './components/LoadingSpinner';
import useIdleCallback from './hooks/useIdleCallback';
import { getReverseTransposition } from './utils/score-utils';

export interface ScoreViewProps {
    backgroundColor?: string | undefined;
}


function ScoreView(scoreViewProps: ScoreViewProps) {

    const { backgroundColor } = scoreViewProps;
    const { verovio } = useContext(Context);

    const splitViewOrientation = useStore.use.splitViewOrientation();
    const isSplitView = useStore.use.isSplitView();

    // Store state management
    const targetHeight = useStore.use.targetHeight();
    const targetWidth = useStore.use.targetWidth();
    const setTargetWidth = useStore.use.setTargetWidth();
    const setTargetHeight = useStore.use.setTargetHeight();
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
    const pageCount = useStore.use.pageCount();
    const showNVerses = useStore.use.showNVerses();

    const normalizeFicta = useStore.use.normalizeFicta();
    const showEditorial = useStore.use.showEditorial();
    const appOptions = useStore.use.appOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const substOptions = useStore.use.substOptions();
    const withoutTransposition = useStore.use.withoutTransposition();
    const renderedSvgData = useStore.use.renderedSvgData();
    const setRenderedSvgData = useStore.use.setRenderedSvgData();
    const showOriginalClefs = useStore.use.showOriginalClefs();
    const showColoredNotes = useStore.use.showColoredNotes();
    const getCachedPage = useStore.use.getCachedPage();
    const setCachedPage = useStore.use.setCachedPage();
    const clearPageCache = useStore.use.clearPageCache();

    const showMusicAnalysis = useStore.use.showMusicAnalysis();
    const measureNumberInterval = useStore.use.measureNumberInterval();

    const { handleElementClick } = useEditorialHandler();
    const { ref: svgContainerRef, width: svgContainerWidth, height: svgContainerHeight } = useComponentSize();

    const [showSpinner, setShowSpinner] = useState(false);
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
    });

    const isReady = () => (score && verovio && svgContainerWidth > 0 && svgContainerHeight > 0 && !pendingAction)

    const processPendingAction = useCallback(async (action: Action) => {

        const { success, nextAction, result, showSpinner: shouldShowSpinner } = await executeAction(action, svgContainerRef.current!);

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
            }

            if (action.type === "render" && result) {
                // Handle the results of render actions

                const renderResult = result as RenderActionResult
                const { newSvg, scale: newScale } = renderResult;

                // Capture the SVG HTML for caching
                const svgHTML = svgContainerRef.current?.innerHTML || '';
                const svgDataWithHTML = { ...newSvg, svgHTML };

                setRenderedSvgData(svgDataWithHTML);

                // Cache the current page for instant back navigation
                setCachedPage(svgDataWithHTML.page, svgDataWithHTML);

                // Apply fade-in animation for non-cached pages
                const svgElement = svgContainerRef.current?.querySelector("svg") as SVGSVGElement | null;
                if (svgElement) {
                    svgElement.style.opacity = '0';
                    svgElement.style.transition = 'opacity 300ms ease-in';
                    setTimeout(() => {
                        svgElement.style.opacity = '1';
                    }, 10);
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
            // Always clear the pending action, otherwise isReady() stays false and every
            // later render/page-turn is silently dropped (e.g. audio-driven page changes).
            setPendingAction(null);
            setIsLoading(false);
            setShowSpinner(false);
        }
    }, [executeAction, svgContainerRef, setPendingAction, setRenderedSvgData, setCachedPage, setIsLoading, setScale, calculateEffectiveMaxScale, reachedEffectiveMaxScale, setReachedEffectiveMaxScale]);


    // Process pending actions
    useEffect(() => {
        if (!pendingAction || !verovio || !svgContainerRef.current) {
            return;
        }

        if (targetHeight <= 0) {
            setPendingAction(null);
            return;
        }

        (async () => {
            await processPendingAction(pendingAction);
        }
        )();
    }, [pendingAction]);

    useEffect(() => {
        if (!verovio || !showingMei || !renderedSvgData || !score || pendingAction) {
            return
        }
        console.log(`[ScoreView] Reloading score for new target size ${targetWidth}x${targetHeight}`);

        const anchor = (renderedSvgData.scoreUrl == score.url && renderedSvgData.anchorElement) ? renderedSvgData.anchorElement : undefined
        const action = loadAction({
            scoreUrl: score.url,
            postLoadTransition: Transition.FADE_IN,
            meiStr: showingMei,
            page: 1,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
            restorePositionForAchor: anchor
        });
        setPendingAction(action);

    }, [targetHeight, targetWidth]);


    const generateShowingScore = useCallback(() => {
        if (!score) return null;

        const scoreProcessor = new ScoreProcessor(score.originalMei);
        if (normalizeFicta) {
            scoreProcessor.addNormalizeFictaFilter();
        }
        if (showNVerses != null && showNVerses != score.properties?.numVerses) {
            scoreProcessor.addNVersesFilter(showNVerses);
        }
        if (!showColoredNotes) {
            scoreProcessor.addRemoveBracketSpanFilter();
        }
        return scoreProcessor.filterScore();
    }, [score, normalizeFicta, showNVerses, showColoredNotes]);

    const updateLoadedScore = useCallback((restoreAnchor: boolean, fadeIn: boolean) => {
        const startTime = performance.now();

        setShowSpinner(true);  // Show spinner immediately

        const newShowingMei = generateShowingScore();
        const preprocessTime = performance.now() - startTime;
        console.log(`[ScoreView] generateShowingScore took ${preprocessTime.toFixed(2)}ms`);

        if (!newShowingMei) {
            console.log(`Error generating showing MEI`);
            setShowSpinner(false);
            return;
        }

        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: fadeIn ? Transition.FADE_IN : undefined,
            meiStr: newShowingMei,
            page: 1,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
            restorePositionForAchor: restoreAnchor && renderedSvgData?.anchorElement ? renderedSvgData.anchorElement : undefined
        });
        setPendingAction(action);
        setShowingMei(newShowingMei);
    }, [score, renderedSvgData?.anchorElement, scale, setPendingAction, setShowingMei, generateShowingScore]);

    const fadeOutTransition = useCallback(() => {
        const currentSvg = svgContainerRef.current?.querySelector("svg") as SVGSVGElement | null;
        if (currentSvg) {
            currentSvg.style.transition = 'opacity 300ms ease-out';
            currentSvg.style.opacity = '0';

            // Show spinner if page takes longer than fade out
            setTimeout(() => {
                if (!getCachedPage(currentPage)) {
                    setShowSpinner(true);
                }
            }, 300);
        } else if (!getCachedPage(currentPage)) {
            // There is nothing to fade out, and we are still not fading-in, so show spinner immediately
            setShowSpinner(true);
        }
    }, [setShowSpinner, currentPage, getCachedPage]);



    useEffect(() => {
        if (!score) return;

        updateLoadedScore(false, lastRenderedUrl.current != score.url);
        return () => {
            lastRenderedUrl.current = score?.url
        }
    }, [score]);


    // This group of changes require rebuilding the score and reloading it
    useEffect(() => {
        if (!score) return;
        // TODO: skip the update if the current loaded score has only 1 verse
        // TODO: skip the update if the current loaded score doesn't have any ficta
        updateLoadedScore(true, false);
    }, [showNVerses, normalizeFicta, showColoredNotes]);



    // Clear page cache when options change that affect rendering
    useEffect(() => {
        if (score) {  // Only clear if we have a score loaded
            console.log('[ScoreView] Clearing page cache due to option/score change');
            clearPageCache();
        }
    }, [scale, showNVerses, normalizeFicta, withoutTransposition, showColoredNotes,
        showOriginalClefs, showMusicAnalysis, measureNumberInterval, clearPageCache, score]);


    // Handle the initial load when verovio has been initialized and when the container is ready
    // and queued render actions because the container was not visible (when shoing only text tab, for example).
    // As the component might have been removed from the tree (svgContainerHeight = 0),
    // we check if we have loaded and rendered the same score. Page is also checked because
    // whe might support keep the player going when the component is not visible (switching to text tab,
    // for example).
    useEffect(() => {
        if (!isReady() || !showingMei) {
            return;
        }

        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: Transition.FADE_IN,
            meiStr: showingMei,
            page: 1,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
        });
        setPendingAction(action);


    }, [verovio, svgContainerRef.current]);


    useEffect(() => {
        if (svgContainerHeight <= 0 || svgContainerWidth <= 0) {
            return;
        }
        if (renderedSvgData && renderedSvgData?.scoreUrl == score?.url) {
            if (pendingAction) {
                return;
            }
            if (renderedSvgData?.height && renderedSvgData?.width &&
                Math.abs(renderedSvgData.height - svgContainerHeight) < 100 &&
                Math.abs(renderedSvgData.width - svgContainerWidth) < 100 &&
                renderedSvgData?.page == currentPage &&
                renderedSvgData?.scale == scale) {
                return
            }
            clearPageCache();
            // As we have rendered data, fade out
            fadeOutTransition();
        }
        setTargetHeight(svgContainerHeight);
        setTargetWidth(svgContainerWidth);
    }, [svgContainerHeight, svgContainerWidth]);

    useEffect(() => {
        // prevent reloading score until layout change reflow sets the final container size
        setTargetHeight(0);
        setTargetWidth(0);
    }, [splitViewOrientation, isSplitView]);


    // Handle scale changes
    useEffect(() => {
        if (!isReady() || !showingMei) return;

        // Start fade out for crossfade effect
        fadeOutTransition();

        const anchorElement = renderedSvgData?.anchorElement || undefined;

        const action = loadAction({
            scoreUrl: score?.url || "",
            postLoadTransition: undefined, // Use standard fade-in
            meiStr: showingMei,
            page: currentPage,
            scale,
            transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
            restorePositionForAchor: anchorElement
        });
        setPendingAction(action);
    }, [scale]);

    const reloadScore = () => {
        if (!isReady() || !showingMei) return;

        const page = currentPage > 0 ? currentPage : 1;
        const anchor = renderedSvgData?.anchorElement || undefined;
        const action = loadAction(
            {
                scoreUrl: score?.url || "",
                meiStr: showingMei,
                page: page,
                scale,
                transposition: withoutTransposition ? getReverseTransposition(score?.properties?.encodedTransposition) : null,
                restorePositionForAchor: anchor
            });
        setPendingAction(action);
    }

    // These changes requires reloading the currently built score
    useEffect(() => {
        reloadScore();
    }, [appOptions, choiceOptions, substOptions, withoutTransposition, showMusicAnalysis, measureNumberInterval]);

    useEffect(() => {
        reloadScore()
    }, [showOriginalClefs]);


    useEffect(() => {
        if (!isReady() || !showingMei || !renderedSvgData) return;

        if (currentPage < 1 || currentPage == renderedSvgData.page) {
            return;
        }

        // Try to get from cache first
        const cachedPage = getCachedPage(currentPage);
        if (cachedPage && cachedPage.svgHTML) {
            console.log(`[ScoreView] Using cached page ${currentPage}`);

            // Get current SVG for fade out
            fadeOutTransition();

            // Create new SVG element for fade in
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cachedPage.svgHTML;
            const newSvg = tempDiv.querySelector("svg") as SVGSVGElement | null;

            if (newSvg && svgContainerRef.current) {
                // Reset opacity to 1 first (cached SVG has opacity: 0 from rendering)
                newSvg.style.opacity = '1';

                // Position new SVG absolutely on top
                newSvg.style.position = 'absolute';
                newSvg.style.top = '0';
                newSvg.style.left = '0';

                // Add new SVG to container
                svgContainerRef.current.appendChild(newSvg);

                // Now set to 0 and animate to 1 for fade in
                newSvg.style.opacity = '0';
                newSvg.style.transition = 'opacity 200ms ease-in';

                // Trigger fade in
                setTimeout(() => {
                    newSvg.style.opacity = '1';
                }, 10);

                // Clean up after animation
                setTimeout(() => {
                    if (svgContainerRef.current) {
                        svgContainerRef.current.innerHTML = cachedPage.svgHTML;
                        // Reset opacity on the final SVG
                        const finalSvg = svgContainerRef.current.querySelector("svg") as SVGSVGElement | null;
                        if (finalSvg) {
                            finalSvg.style.opacity = '1';
                            finalSvg.style.transition = '';
                        }
                    }
                    setRenderedSvgData(cachedPage);
                    setIsLoading(false);
                }, 220); // Slightly longer than animation
            } else {
                // Fallback if something goes wrong
                if (svgContainerRef.current) {
                    svgContainerRef.current.innerHTML = cachedPage.svgHTML;
                    const finalSvg = svgContainerRef.current.querySelector("svg") as SVGSVGElement | null;
                    if (finalSvg) {
                        finalSvg.style.opacity = '1';
                    }
                }
                setRenderedSvgData(cachedPage);
                setIsLoading(false);
            }

            return;
        }

        // Not in cache, start fade out and render
        const currentSvg = svgContainerRef.current?.querySelector("svg") as SVGSVGElement | null;

        if (currentSvg) {
            // Start fade out immediately for responsive feel
            fadeOutTransition();
        }

        const action = renderAction({
            scoreUrl: renderedSvgData.scoreUrl,
            transition: undefined,  // No slide transition, we're using fade
            renderPage: currentPage,
            loadedWidth: renderedSvgData.width || svgContainerWidth,
            loadedHeight: renderedSvgData.height || svgContainerHeight,
            scale,
            loadedPagesCount: pageCount,
            timemap: renderedSvgData.timemap
        });
        setPendingAction(action);
    }, [currentPage, getCachedPage, setRenderedSvgData, setIsLoading]);

    // Pre-render adjacent pages when idle
    useIdleCallback(() => {
        if (!verovio || !svgContainerRef.current || !renderedSvgData || !isReady()) return;

        const currentRenderedPage = renderedSvgData.page;
        const nextPage = currentRenderedPage + 1;
        const prevPage = currentRenderedPage - 1;

        // Pre-render next page if not cached
        if (nextPage <= pageCount && !getCachedPage(nextPage)) {
            console.log(`[ScoreView] Pre-rendering page ${nextPage}`);
            preRenderPage(nextPage);
        }

        // Pre-render previous page if not cached
        if (prevPage >= 1 && !getCachedPage(prevPage)) {
            console.log(`[ScoreView] Pre-rendering page ${prevPage}`);
            preRenderPage(prevPage);
        }
    }, [renderedSvgData, pageCount, verovio, getCachedPage]);

    const preRenderPage = async (page: number) => {
        if (!verovio || !renderedSvgData) return;

        try {
            const startTime = performance.now();

            // Create a temporary container for pre-rendering
            const tempContainer = document.createElement('div');
            tempContainer.style.display = 'none';
            tempContainer.style.position = 'absolute';
            tempContainer.style.top = '-9999px';
            document.body.appendChild(tempContainer);

            const action = renderAction({
                scoreUrl: renderedSvgData.scoreUrl,
                transition: undefined,  // No transition for pre-render
                renderPage: page,
                loadedWidth: renderedSvgData.width || targetWidth,
                loadedHeight: renderedSvgData.height || targetHeight,
                scale: renderedSvgData.scale,
                loadedPagesCount: pageCount,
                timemap: renderedSvgData.timemap
            });

            const result = await executeAction(action, tempContainer);

            if (result.success && result.result) {
                const renderResult = result.result as RenderActionResult;

                // Capture the SVG HTML from temp container
                const svgHTML = tempContainer.innerHTML;
                const svgDataWithHTML = { ...renderResult.newSvg, svgHTML };

                setCachedPage(page, svgDataWithHTML);
                console.log(`[ScoreView] Pre-rendered page ${page} in ${(performance.now() - startTime).toFixed(0)}ms`);
            }

            // Clean up temp container
            document.body.removeChild(tempContainer);
        } catch (error) {
            console.error(`Error pre-rendering page ${page}:`, error);
        }
    };



    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div ref={svgContainerRef}
                className={"static-score " + svgContainerClasses.join(" ")}
                style={{
                    width: "100%",
                    height: "100%",
                    background: backgroundColor || 'white',
                    "--score-bg-color": backgroundColor
                } as React.CSSProperties}
                onClick={handleElementClick} />
            <LoadingSpinner visible={showSpinner} />
        </div>

    );
}

export default ScoreView;
