import { useState, useCallback, useEffect } from 'react';
import useStore from '../store';

interface LayoutState {
  activeTab: string;
  activeSplitView: string | null;
  sizes: (number | string)[];
  openDrawer: boolean;
}

interface LayoutStateActions {
  setActiveTab: (tab: string) => void;
  setActiveSplitView: (view: string | null) => void;
  setSizes: (sizes: (number | string)[]) => void;
  setOpenDrawer: (open: boolean) => void;
  onTabChange: (key: string) => void;
  onSplitViewSelectorChanged: (key: string) => void;
  showDrawer: () => void;
  onDrawerClose: () => void;
}

export interface UseLayoutStateReturn extends LayoutState, LayoutStateActions {}

export function useLayoutState(): UseLayoutStateReturn {
  const [activeTab, setActiveTab] = useState<string>("music");
  const [activeSplitView, setActiveSplitView] = useState<string | null>(null);
  const [sizes, setSizes] = useState<(number | string)[]>(['50%', '50%']);
  const [openDrawer, setOpenDrawer] = useState(false);

  const splitView = useStore.use.splitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();

  // Reset panel sizes when orientation changes to prevent layout issues
  useEffect(() => {
    setSizes(['50%', '50%']);
  }, [splitView, splitViewOrientation]);

  const onTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  const onSplitViewSelectorChanged = useCallback((key: string) => {
    console.log("Split view changed to: ", key);
    setActiveSplitView(key);
  }, []);

  const showDrawer = useCallback(() => {
    setOpenDrawer(true);
  }, []);

  const onDrawerClose = useCallback(() => {
    setOpenDrawer(false);
  }, []);

  return {
    // State
    activeTab,
    activeSplitView,
    sizes,
    openDrawer,

    // Actions
    setActiveTab,
    setActiveSplitView,
    setSizes,
    setOpenDrawer,
    onTabChange,
    onSplitViewSelectorChanged,
    showDrawer,
    onDrawerClose,
  };
}
