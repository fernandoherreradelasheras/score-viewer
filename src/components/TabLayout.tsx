import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsProps, Space } from 'antd';
import { FileTextOutlined, FileImageOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import MusicSvg from "../../assets/music.svg?react";
import useStore from '../store';
import { PlayingState } from '../types';

interface TabLayoutProps {
  scoreView: React.ReactNode;
  textView: React.ReactNode | null;
  introView: React.ReactNode | null;
  facsimileView: React.ReactNode | null;
  showIntroductionSection: boolean;
  showTextSection: boolean;
  showFacsimileSection: boolean;
  // Rendered at the right end of the tab bar, sharing its row
  tabBarExtra?: React.ReactNode;
  activeTab: string;
}

export default function TabLayout({
  scoreView,
  textView,
  introView,
  facsimileView,
  showIntroductionSection,
  showTextSection,
  showFacsimileSection,
  tabBarExtra,
  activeTab
}: TabLayoutProps) {
  const { t } = useTranslation("common");
  const setActiveTab = useStore.use.setActiveTab();

  // The music pane is always present, even alone with the tab bar hidden: the tabs
  // must not appear and disappear as a score switch settles which sections the new
  // score has, because each change of tree shape would remount the score view (and
  // with it the whole verovio pipeline). Panes are keyed, so the score keeps its
  // mounted instance while sibling tabs come and go.
  const showAnySection = showIntroductionSection || showTextSection || showFacsimileSection;

  // The size the music had on show, which it keeps while hidden: taking that of the tab on
  // show instead would render it again for nothing, and again on coming back.
  const [musicSize, setMusicSize] = useState<{ width: number, height: number } | null>(null);
  const musicObserver = useRef<ResizeObserver | null>(null);
  const observeMusic = useCallback((node: HTMLDivElement | null) => {
    musicObserver.current?.disconnect();
    if (!node) {
      return;
    }
    musicObserver.current = new ResizeObserver(([entry]) => {
      if (!node.closest('.ant-tabs-content-hidden')) {
        setMusicSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    musicObserver.current.observe(node);
  }, []);

  const tabsItems: TabsProps['items'] = useMemo(() =>
    [
      showAnySection && introView ? {
        key: 'intro',
        label: <Space orientation='horizontal'>{t('tab.introduction')}</Space>,
        children: introView
      } : null,
      showAnySection && textView ? {
        key: 'text',
        label: <Space orientation='horizontal'><FileTextOutlined />{t('tab.text')}</Space>,
        children: textView
      } : null,
      // Rendered from the start and kept laid out while hidden (see .score-kept-pane):
      // the player lives in it, and the facsimile follows it from its own tab.
      {
        key: 'music',
        label: <Space orientation='horizontal'><Icon component={MusicSvg} />{t('tab.music')}</Space>,
        children: <div ref={observeMusic} style={{ height: "100%" }}>{scoreView}</div>,
        forceRender: true,
        className: 'score-kept-pane score-music-pane',
      },
      // Kept laid out as well, for the image to stay where the reader left it.
      showAnySection && facsimileView ? {
        key: 'facsimile',
        label: <Space orientation='horizontal'> <FileImageOutlined />{t('tab.facsimile')}</Space>,
        children: facsimileView,
        className: 'score-kept-pane',
      } : null
    ].filter(tab => tab != null),
    [scoreView, textView, introView, facsimileView, showAnySection, observeMusic, t]
  );

  const onTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, [setActiveTab]);

  const shouldShowTabBar = tabsItems.length > 1;

  // The active tab is a preference kept across scores, so it may name a tab the current
  // score does not have (or whose sections are still unknown); the music stands in for it.
  const effectiveTab = tabsItems.some(tab => tab.key === activeTab) ? activeTab : 'music';

  // The music can be followed on its facsimile, but not while reading a text.
  const playingState = useStore.use.playingState();
  const setPlayingState = useStore.use.setPlayingState();
  useEffect(() => {
    if (effectiveTab !== 'music' && effectiveTab !== 'facsimile' && playingState === PlayingState.PLAYING) {
      setPlayingState(PlayingState.PAUSED);
    }
    // Only a change of tab pauses: reacting to the playing state as well would pause a
    // playback started from another tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTab]);

  const items = effectiveTab === 'music' || musicSize == null ? tabsItems
    : tabsItems.map(item => item.key === 'music' ? { ...item, style: musicSize } : item);

  return (
    <Tabs
      items={items}
      activeKey={effectiveTab}
      renderTabBar={shouldShowTabBar ? undefined : () => <></>}
      onChange={onTabChange}
      classNames={effectiveTab === "music" ? { body: "score-tabs-body", content: "score-tabs-pane" } : {}}
      tabBarExtraContent={tabBarExtra ? { right: tabBarExtra } : undefined}
      style={{
        width: "100%",
        flex: "1",
        ...(effectiveTab === "text" || effectiveTab === "intro" ? { height: "100%" } : {})
      }}
    />
  );
}

export { type TabLayoutProps };
