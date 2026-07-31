import { useMemo } from 'react';
import { Select, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/es/select';
import { useTranslation } from 'react-i18next';
import SplitViewSelector from './SplitViewSelector';
import SettingsButton from './SettingsButton';
import useStore from '../store';

interface ScoreViewerHeaderProps {
  showScoreSelector: boolean;
  showOptions: boolean;
  selectorLabel: string | "work" | "section";
  scoreItems: DefaultOptionType[];
  onScoreSelectedChanged: (value: number) => void;

  facsimileView: React.ReactNode | null;
  introView: React.ReactNode | null;
  textView: React.ReactNode | null;

  onShowDrawer: () => void;
}

export default function ScoreViewerHeader({
  showScoreSelector,
  showOptions,
  selectorLabel,
  scoreItems,
  onScoreSelectedChanged: onScoreChanged,
  facsimileView,
  introView,
  textView,
  onShowDrawer
}: ScoreViewerHeaderProps) {
  const { t } = useTranslation("common");
  const isSplitView = useStore.use.isSplitView();
  const label = selectorLabel === "work" ? t('heading.work') : t('heading.section');


  const scoreSelector = useMemo(() =>
    showScoreSelector ?
      <Space direction='horizontal' style={{ marginBottom: "10px", textAlign: "start", flex: "0" }}>
        <Typography.Text style={{ marginLeft: "10px" }}>{label}:</Typography.Text>
        <Select
          style={{ minWidth: "200px", marginRight: "10px" }}
          defaultValue={0}
          options={scoreItems}
          onChange={onScoreChanged} />
      </Space>
      : null
    , [showScoreSelector, scoreItems, onScoreChanged, t]);

  const splitViewSelector = useMemo(() => isSplitView ?
    <SplitViewSelector
      facsimileView={facsimileView}
      introView={introView}
      textView={textView}
    /> : null
    , [isSplitView, facsimileView, introView, textView]);

  return (
    <Space direction='horizontal' style={{
      width: "100%",
      justifyContent: scoreSelector || splitViewSelector ? "space-between" : "flex-end",
      alignItems: "center"
    }}>
      {scoreSelector}
      {splitViewSelector}
      {showOptions ? <SettingsButton onClick={onShowDrawer} /> : null}
    </Space>
  );
}

export { type ScoreViewerHeaderProps };
