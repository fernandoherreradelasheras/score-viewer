import { useCallback, useEffect, useState } from 'react';
import TabLayout from './TabLayout';
import SplitViewLayout from './SplitViewLayout';
import useStore from "../store";


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


  const [sizes, setSizes] = useState<(number | string)[]>(['50%', '50%']);

  useEffect(() => {
    setSizes(['50%', '50%']);
  }, [isSplitView, splitViewOrientation]);


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
