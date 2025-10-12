import { useMemo } from 'react';
import { Button, Select, Space, Typography } from 'antd';
import Icon, { SettingOutlined } from '@ant-design/icons';
import { DefaultOptionType } from 'antd/es/select';
import { useTranslation } from 'react-i18next';
import { PlayingState } from '../types';
import SplitViewSelector from './SplitViewSelector';
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
  const playingState = useStore.use.playingState();
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
      {showOptions ? <Button
        icon={<Icon component={SettingOutlined} />}
        onClick={onShowDrawer}
        disabled={playingState === PlayingState.PLAYING}>
        {t('scoreControls.settings')}
      </Button> : null}
    </Space>
  );
}

export { type ScoreViewerHeaderProps };
