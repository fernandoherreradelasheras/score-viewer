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
}

export default function TabLayout({
  scoreView,
  textView,
  introView,
  facsimileView,
  showIntroductionSection,
  showTextSection,
  showFacsimileSection
}: TabLayoutProps) {
  const { t } = useTranslation("common");
  const activeTab = useStore.use.activeTab()
  const setActiveTab = useStore.use.setActiveTab();

  const tabsItems: TabsProps['items'] = useMemo(() =>
    showIntroductionSection || showTextSection || showFacsimileSection ? [
      introView ? {
        key: 'intro',
        label: <Space direction='horizontal'>{t('tab.introduction')}</Space>,
        children: introView
      } : null,
      {
        key: 'music',
        label: <Space direction='horizontal'><Icon component={MusicSvg} />{t('tab.music')}</Space>,
        children: scoreView
      },
      textView ? {
        key: 'text',
        label: <Space direction='horizontal'><FileTextOutlined />{t('tab.text')}</Space>,
        children: textView
      } : null,
      facsimileView ? {
        key: 'facsimile',
        label: <Space direction='horizontal'> <FileImageOutlined />{t('tab.facsimile')}</Space>,
        children: facsimileView
      } : null
    ].filter(tab => tab != null) : [],
    [scoreView, textView, introView, facsimileView, showIntroductionSection, showTextSection, showFacsimileSection, t]
  );

  const onTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, [setActiveTab]);

  const shouldShowTabs = tabsItems.length > 1;

  if (!shouldShowTabs) {
    return <>{scoreView}</>;
  }

  return (
    <Tabs
      items={tabsItems}
      defaultActiveKey="music"
      onChange={onTabChange}
      style={{
        width: "100%",
        flex: "1",
        ...(activeTab === "text" || activeTab === "intro" ? { height: "100%" } : {})
      }}
    />
  );
}

export { type TabLayoutProps };
