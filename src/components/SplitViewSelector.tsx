import { useCallback, useMemo } from 'react';
import { Space, Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import useStore from '../store';

interface SplitViewSelectorProps {
  facsimileView: React.ReactNode | null;
  introView: React.ReactNode | null;
  textView: React.ReactNode | null;
}

export default function SplitViewSelector({
  facsimileView,
  introView,
  textView
}: SplitViewSelectorProps) {
  const { t } = useTranslation("common");
  const activeSplitView = useStore.use.activeSplitView();
  const setActiveSplitView = useStore.use.setActiveSplitView();

  const selectorItems = useMemo(() => [
    facsimileView ? { label: t('tab.facsimile'), value: 'facsimile' } : null,
    introView ? { label: t('tab.introduction'), value: 'intro' } : null,
    textView ? { label: t('tab.text'), value: 'text' } : null,
  ].filter(item => item != null)
  ,[facsimileView, introView, textView, t]);

  const onActiveSplitViewChange = useCallback((value: string) => {
    setActiveSplitView(value);
  }, [setActiveSplitView]);

  if (selectorItems.length === 0) {
    return null;
  }

  return (
    <Space direction='horizontal' style={{ marginBottom: "10px", textAlign: "start", flex: "0" }}>
      <Typography.Text style={{ marginLeft: "10px" }}>{t('heading.splitViewSelector')}:</Typography.Text>
      <Select
        style={{ minWidth: "200px", marginRight: "10px" }}
        options={selectorItems}
        value={activeSplitView}
        onChange={onActiveSplitViewChange}
      />
    </Space>
  );
}

export { type SplitViewSelectorProps };
