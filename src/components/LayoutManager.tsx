import { useCallback, useEffect } from 'react';
import TabLayout from './TabLayout';
import SplitViewLayout from './SplitViewLayout';

interface LayoutManagerProps {
  splitView: boolean;
  splitViewOrientation: 'horizontal' | 'vertical';
  scoreView: React.ReactNode;
  textView: React.ReactNode | null;
  introView: React.ReactNode | null;
  facsimileView: React.ReactNode | null;

  // Tab layout props
  activeTab: string;
  onTabChange: (key: string) => void;
  setActiveTab: (tab: string) => void;
  showIntroductionSection: boolean;
  showTextSection: boolean;
  showFacsimileSection: boolean;

  // Split view props
  activeSplitView: string | null;
  onSplitViewSelectorChanged: (key: string) => void;
  setActiveSplitView: (view: string | null) => void;
  sizes: (number | string)[];
  setSizes: (sizes: (number | string)[]) => void;
}

export default function LayoutManager({
  splitView,
  splitViewOrientation,
  scoreView,
  textView,
  introView,
  facsimileView,
  activeTab,
  onTabChange,
  setActiveTab,
  showIntroductionSection,
  showTextSection,
  showFacsimileSection,
  activeSplitView,
  onSplitViewSelectorChanged,
  setActiveSplitView,
  sizes,
  setSizes
}: LayoutManagerProps) {

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

  const getAvailableOptions = useCallback(() => {
    const options = [];
    if (facsimileView) options.push('facsimile');
    if (introView) options.push('intro');
    if (textView) options.push('text');
    return options;
  }, [facsimileView, introView, textView]);

  // Handle content availability changes
  useEffect(() => {
    if (splitView && splitViewContentNotAvailable()) {
      const availableOptions = getAvailableOptions();
      if (availableOptions.length > 0) {
        console.log(`Setting activeSplitView to ${availableOptions[0]}`);
        setActiveSplitView(availableOptions[0]);
      }
    } else if (!splitView && tabContentNotAvailable()) {
      setActiveTab("music");
    }
  }, [splitView, splitViewContentNotAvailable, tabContentNotAvailable, getAvailableOptions, setActiveSplitView, setActiveTab]);

  // Determine what to render
  const shouldShowTabs = !splitView && (showIntroductionSection || showTextSection || showFacsimileSection);
  const hasMultipleTabs = [introView, textView, facsimileView].filter(Boolean).length > 0;

  if (splitView) {
    return (
      <SplitViewLayout
        scoreView={scoreView}
        textView={textView}
        introView={introView}
        facsimileView={facsimileView}
        activeSplitView={activeSplitView}
        onSplitViewSelectorChanged={onSplitViewSelectorChanged}
        sizes={sizes}
        setSizes={setSizes}
        orientation={splitViewOrientation}
      />
    );
  }

  if (shouldShowTabs && hasMultipleTabs) {
    return (
      <TabLayout
        scoreView={scoreView}
        textView={textView}
        introView={introView}
        facsimileView={facsimileView}
        activeTab={activeTab}
        onTabChange={onTabChange}
        showIntroductionSection={showIntroductionSection}
        showTextSection={showTextSection}
        showFacsimileSection={showFacsimileSection}
      />
    );
  }

  // Single view (just score)
  return <>{scoreView}</>;
}

export { type LayoutManagerProps };
