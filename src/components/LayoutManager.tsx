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
}

export default function LayoutManager({
  scoreView,
  textView,
  introView,
  facsimileView,

  showIntroductionSection,
  showTextSection,
  showFacsimileSection,
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

  // Determine what to render
  const shouldShowTabs = !isSplitView && (showIntroductionSection || showTextSection || showFacsimileSection);
  const hasMultipleTabs = [introView, textView, facsimileView].filter(Boolean).length > 0;

  if (isSplitView) {
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
  } else if (shouldShowTabs && hasMultipleTabs) {
    return (
      <TabLayout
        scoreView={scoreView}
        textView={textView}
        introView={introView}
        facsimileView={facsimileView}
        showIntroductionSection={showIntroductionSection}
        showTextSection={showTextSection}
        showFacsimileSection={showFacsimileSection}
      />
    );
  } else {
    return (
      scoreView
    );
  }
}

export { type LayoutManagerProps };
