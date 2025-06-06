import { useState } from 'react';
import useStore from "../store";
import { PlayingState, MIN_SCALE, MAX_SCALE } from '../types';

/**
 * Custom hook to handle score navigation, zoom, and fullscreen functionality
 * @param scoresToSelect Array of score titles to select from
 * @param fullScreenElement Reference to the element that can be fullscreened
 * @returns Functions and state for score controls
 */
export default function useScoreControls(
  fullScreenElement: HTMLElement | null,
) {
  // Get state and actions from store
  const score = useStore.use.score()
  const playingState = useStore.use.playingState();
  const resetPlayerPosition = useStore.use.resetPlayerPosition();
  const scale = useStore.use.scale();
  const increaseScale = useStore.use.increaseScale();
  const decreaseScale = useStore.use.decreaseScale();
  const reachedEffectiveMaxScale = useStore.use.reachedEffectiveMaxScale();
  const setReachedEffectiveMaxScale = useStore.use.setReachedEffectiveMaxScale();
  const pageCount = useStore.use.pageCount();
  const currentPageNumber = useStore.use.currentPage();
  const goToPage = useStore.use.goToPage()

  // Component state
  const [openDrawer, setOpenDrawer] = useState(false);

  // Fullscreen functions
  const isFullScreen = () =>
    fullScreenElement != null &&
    (fullScreenElement.ownerDocument.fullscreenElement == fullScreenElement);

  const exitFullScreen = () => {
    if (isFullScreen()) {
      document.exitFullscreen();
    }
  };

  const handleFullScreenToggle = () => {
    if (fullScreenElement && !isFullScreen()) {
      fullScreenElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Drawer control functions
  const showDrawer = () => {
    exitFullScreen();
    setOpenDrawer(true);
  };

  const onDrawserClose = () => {
    setOpenDrawer(false);
  };

  // Zoom functions
  const zoomIn = () => {
    increaseScale()
  };

  const zoomOut = () => {
    decreaseScale();
    setReachedEffectiveMaxScale(false);
  };

  // Page navigation
  const handlePageClick = (page: number) => {
    resetPlayerPosition();
    goToPage(page);
  };



  // Derived data


  // Calculated states for UI
  const isPlaying = playingState === PlayingState.PLAYING;
  const canZoomOut = !isPlaying && scale > MIN_SCALE;
  const canZoomIn = !isPlaying && scale < MAX_SCALE && !reachedEffectiveMaxScale;
  const shouldShowPagination = pageCount > 1;
  const scoreUrl = score?.url


  return {
    // State
    scoreUrl,
    currentPageNumber,
    pageCount,
    scale,
    playingState,
    openDrawer,

    // Derived state
    isPlaying,
    canZoomIn,
    canZoomOut,
    shouldShowPagination,
    isFullScreen: isFullScreen(),

    // Functions
    handlePageClick,
    zoomIn,
    zoomOut,
    handleFullScreenToggle,
    showDrawer,
    onDrawserClose
  };
}