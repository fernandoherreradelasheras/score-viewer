import { useMemo } from 'react';
import { Space, Select, Typography } from 'antd';
import { DefaultOptionType } from 'antd/es/select';
import { useTranslation } from 'react-i18next';

interface SplitViewSelectorProps {
  splitView: boolean;
  activeSplitView: string | null;
  onSplitViewSelectorChanged: (key: string) => void;
  facsimileView: React.ReactNode | null;
  introView: React.ReactNode | null;
  textView: React.ReactNode | null;
}

export default function SplitViewSelector({
  splitView,
  activeSplitView,
  onSplitViewSelectorChanged,
  facsimileView,
  introView,
  textView
}: SplitViewSelectorProps) {
  const { t } = useTranslation("common");

  const selectorItems = useMemo(() => [
    facsimileView ? { label: t('tab.facsimile'), value: 'facsimile' } : null,
    introView ? { label: t('tab.introduction'), value: 'intro' } : null,
    textView ? { label: t('tab.text'), value: 'text' } : null,
  ].filter(item => item != null) as DefaultOptionType[],
  [facsimileView, introView, textView, t]);

  if (!splitView || selectorItems.length === 0) {
    return null;
  }

  return (
    <Space direction='horizontal' style={{ marginBottom: "10px", textAlign: "start", flex: "0" }}>
      <Typography.Text style={{ marginLeft: "10px" }}>{t('heading.splitViewSelector')}:</Typography.Text>
      <Select
        style={{ minWidth: "200px", marginRight: "10px" }}
        value={activeSplitView}
        options={selectorItems}
        onChange={onSplitViewSelectorChanged}
      />
    </Space>
  );
}

export { type SplitViewSelectorProps };
