import { useCallback, useEffect, useRef, useState } from 'react';
import TabLayout from './TabLayout';
import SplitViewLayout from './SplitViewLayout';
import useStore, { SecondaryViewLayoutHint } from "../store";


interface LayoutManagerProps {
  scoreView: React.ReactNode;
  textView: React.ReactNode | null;
  introView: React.ReactNode | null;
  facsimileView: React.ReactNode | null;

  showIntroductionSection: boolean;
  showTextSection: boolean;
  showFacsimileSection: boolean;
  tabBarExtra?: React.ReactNode;
}

type ContentProps = Pick<LayoutManagerProps, 'introView' | 'textView' | 'facsimileView'
  | 'showIntroductionSection' | 'showTextSection' | 'showFacsimileSection'>


export function hasSecondaryContent(props: ContentProps) {
  return (props.showIntroductionSection || props.showTextSection || props.showFacsimileSection)
    && [props.introView, props.textView, props.facsimileView].filter(Boolean).length > 0
}

// Whether this layout will end up drawing a tab bar, i.e. whether there is anything to
// switch to besides the score. Exported so callers can decide what to put in it without
// restating the condition.
export function rendersTabBar(props: ContentProps, isSplitView: boolean) {
  return !isSplitView && hasSecondaryContent(props)
}

const MIN_SECONDARY_PERCENT = 25;
const MAX_SECONDARY_PERCENT = 50;

// The share of the split, in percent, that fits the secondary view's content along the
// split axis: in a horizontal split the image takes the whole height and needs the width
// that follows, in a vertical one it takes the whole width and needs the height.
function secondaryPanelSize(
  container: { width: number, height: number },
  orientation: 'horizontal' | 'vertical',
  hint: SecondaryViewLayoutHint,
): number | null {
  if (container.width <= 0 || container.height <= 0) {
    return null;
  }
  const needed = orientation === 'horizontal'
    ? (container.height - hint.chromeHeight) * hint.aspectRatio
    : container.width / hint.aspectRatio + hint.chromeHeight;
  const total = orientation === 'horizontal' ? container.width : container.height;
  const percent = Math.ceil(100 * needed / total);
  return Math.min(MAX_SECONDARY_PERCENT, Math.max(MIN_SECONDARY_PERCENT, percent));
}

export default function LayoutManager({
  scoreView,
  textView,
  introView,
  facsimileView,

  showIntroductionSection,
  showTextSection,
  showFacsimileSection,
  tabBarExtra,
}: LayoutManagerProps) {

  const isSplitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const activeSplitView = useStore.use.activeSplitView();
  const setActiveSplitView = useStore.use.setActiveSplitView();
  const activeTab = useStore.use.activeTab()
  const setActiveTab = useStore.use.setActiveTab();
  const layoutHint = useStore.use.secondaryViewLayoutHint();
  const scoreUrl = useStore.use.score()?.url;


  const [sizes, setSizes] = useState<(number | string)[]>(['50%', '50%']);
  const [container, setContainer] = useState<{ width: number, height: number } | null>(null);

  // The split is settled once per sitting: entering the split view, turning it on its
  // side or opening another score starts one, and within it the divider moves only until
  // the secondary view has declared its content once, or the reader has dragged it. A
  // later hint (the facsimile turned to a page of another shape) leaves it alone: the
  // music beside it has not changed, so a divider that jumps would only get in the way.
  const userResized = useRef(false);
  const hintApplied = useRef(false);
  const onResizeEnd = useCallback(() => { userResized.current = true; }, []);

  useEffect(() => {
    userResized.current = false;
    hintApplied.current = false;
    // The divider is recentred once the new layout is committed: the panes have to be
    // laid out before their split means anything.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSizes(['50%', '50%']);
  }, [isSplitView, splitViewOrientation]);

  // Another score keeps the divider where it is until its own facsimile has spoken: the
  // hint still in the store describes the previous one.
  useEffect(() => {
    userResized.current = false;
    hintApplied.current = false;
  }, [scoreUrl]);

  // The secondary view gets what its content fills, never more than half. A hint that
  // goes away means the content is being replaced, and the next one is the one to wait for.
  useEffect(() => {
    if (!layoutHint) {
      hintApplied.current = false;
      return;
    }
    if (userResized.current || hintApplied.current || !container) {
      return;
    }
    const secondary = secondaryPanelSize(container, splitViewOrientation, layoutHint);
    if (secondary == null) {
      return;
    }
    hintApplied.current = true;
    // The share comes from the measured container and the content's own hint, neither of
    // which can be read while rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSizes([`${100 - secondary}%`, `${secondary}%`]);
  }, [isSplitView, splitViewOrientation, container, layoutHint]);


  const checkContentAvailable = useCallback((key: string | null) => {
    if (key === null) {
      return false;
    } else if (key === "facsimile" && facsimileView === null) {
      return false;
    } else if (key === "text" && textView === null) {
      return false;
    } else if (key === "intro" && introView === null) {
      return false;
    }
    return true;
  }, [facsimileView, textView, introView]);

  const tabContentNotAvailable = useCallback(() => {
    return !checkContentAvailable(activeTab);
  }, [checkContentAvailable, activeTab]);

  const splitViewContentNotAvailable = useCallback(() => {
    return !checkContentAvailable(activeSplitView);
  }, [checkContentAvailable, activeSplitView]);

  const getAvailableViews = useCallback(() => {
    const options = [];
    if (facsimileView) options.push('facsimile');
    if (introView) options.push('intro');
    if (textView) options.push('text');
    return options;
  }, [facsimileView, introView, textView]);

  // Handle content availability changes
  useEffect(() => {
    if (isSplitView && splitViewContentNotAvailable()) {
      const availableViews = getAvailableViews();
      if (availableViews.length > 0) {
        setActiveSplitView(availableViews[0]);
      }
    } else if (!isSplitView && tabContentNotAvailable()) {
      setActiveTab("music");
    }
  }, [isSplitView, facsimileView, introView, textView, splitViewContentNotAvailable, tabContentNotAvailable, getAvailableViews, setActiveSplitView, setActiveTab]);

  const content = {
    introView, textView, facsimileView,
    showIntroductionSection, showTextSection, showFacsimileSection
  };

  // A split view needs two things to put side by side. With nothing to place next to
  // the music there is nothing to split, and splitting anyway leaves half the screen
  // blank. In this case the layout manager falls back to the tab layout, which is a single pane
  if (isSplitView && hasSecondaryContent(content)) {
    return (
      <SplitViewLayout
        scoreView={scoreView}
        textView={textView}
        introView={introView}
        facsimileView={facsimileView}
        sizes={sizes}
        setSizes={setSizes}
        onResizeEnd={onResizeEnd}
        onContainerResize={setContainer}
      />
    );
  }

  // Always through TabLayout, even when the score is the only content: it renders the
  // single pane with the tab bar hidden, so the tree keeps the same shape whichever
  // tabs the current score turns out to have and the score view is never remounted by
  // a score switch.
  return (
    <TabLayout
      scoreView={scoreView}
      textView={textView}
      introView={introView}
      facsimileView={facsimileView}
      showIntroductionSection={showIntroductionSection}
      showTextSection={showTextSection}
      showFacsimileSection={showFacsimileSection}
      tabBarExtra={tabBarExtra}
    />
  );
}

export { type LayoutManagerProps };
