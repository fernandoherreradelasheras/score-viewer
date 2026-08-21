import { useCallback, useMemo } from 'react';
import { Tabs, TabsProps, Space } from 'antd';
import { FileTextOutlined, FileImageOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import MusicSvg from "../../assets/music.svg?react";
import useStore from '../store';

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
}

export default function TabLayout({
  scoreView,
  textView,
  introView,
  facsimileView,
  showIntroductionSection,
  showTextSection,
  showFacsimileSection,
  tabBarExtra
}: TabLayoutProps) {
  const { t } = useTranslation("common");
  const activeTab = useStore.use.activeTab()
  const setActiveTab = useStore.use.setActiveTab();

  // The music pane is always present, even alone with the tab bar hidden: the tabs
  // must not appear and disappear as a score switch settles which sections the new
  // score has, because each change of tree shape would remount the score view (and
  // with it the whole verovio pipeline). Panes are keyed, so the score keeps its
  // mounted instance while sibling tabs come and go.
  const showAnySection = showIntroductionSection || showTextSection || showFacsimileSection;
  const tabsItems: TabsProps['items'] = useMemo(() =>
    [
      showAnySection && introView ? {
        key: 'intro',
        label: <Space direction='horizontal'>{t('tab.introduction')}</Space>,
        children: introView
      } : null,
      showAnySection && textView ? {
        key: 'text',
        label: <Space direction='horizontal'><FileTextOutlined />{t('tab.text')}</Space>,
        children: textView
      } : null,
      {
        key: 'music',
        label: <Space direction='horizontal'><Icon component={MusicSvg} />{t('tab.music')}</Space>,
        children: scoreView
      },
      showAnySection && facsimileView ? {
        key: 'facsimile',
        label: <Space direction='horizontal'> <FileImageOutlined />{t('tab.facsimile')}</Space>,
        children: facsimileView
      } : null
    ].filter(tab => tab != null),
    [scoreView, textView, introView, facsimileView, showAnySection, t]
  );

  const onTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, [setActiveTab]);

  const shouldShowTabBar = tabsItems.length > 1;

  // The store may briefly point at a tab the current items no longer carry (switching
  // away from a score that had it); LayoutManager resets it to music an effect later,
  // but the pane on screen must never be a missing one.
  const effectiveTab = tabsItems.some(tab => tab.key === activeTab) ? activeTab : 'music';

  return (
    <Tabs
      items={tabsItems}
      activeKey={effectiveTab}
      renderTabBar={shouldShowTabBar ? undefined : () => <></>}
      onChange={onTabChange}
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
