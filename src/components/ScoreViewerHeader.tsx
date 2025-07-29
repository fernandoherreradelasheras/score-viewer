import { useMemo } from 'react';
import { Button, Select, Space, Typography } from 'antd';
import Icon, { SettingOutlined } from '@ant-design/icons';
import { DefaultOptionType } from 'antd/es/select';
import { useTranslation } from 'react-i18next';
import { PlayingState } from '../types';
import SplitViewSelector from './SplitViewSelector';

interface ScoreViewerHeaderProps {
  // Score selector props
  showScoreSelector: boolean;
  scoreItems: DefaultOptionType[];
  onScoreChanged: (value: number) => void;

  // Split view selector props
  splitView: boolean;
  activeSplitView: string | null;
  onSplitViewSelectorChanged: (key: string) => void;
  facsimileView: React.ReactNode | null;
  introView: React.ReactNode | null;
  textView: React.ReactNode | null;

  // Settings button props
  playingState: PlayingState;
  onShowDrawer: () => void;
}

export default function ScoreViewerHeader({
  showScoreSelector,
  scoreItems,
  onScoreChanged,
  splitView,
  activeSplitView,
  onSplitViewSelectorChanged,
  facsimileView,
  introView,
  textView,
  playingState,
  onShowDrawer
}: ScoreViewerHeaderProps) {
  const { t } = useTranslation("common");

  const scoreSelector = useMemo(() =>
    showScoreSelector ?
      <Space direction='horizontal' style={{ marginBottom: "10px", textAlign: "start", flex: "0" }}>
        <Typography.Text style={{ marginLeft: "10px" }}>{t('heading.work')}:</Typography.Text>
        <Select
          style={{ minWidth: "200px", marginRight: "10px" }}
          defaultValue={0}
          options={scoreItems}
          onChange={onScoreChanged} />
      </Space>
      : null
    , [showScoreSelector, scoreItems, onScoreChanged, t]);

  const splitViewSelector = useMemo(() => splitView ?
    <SplitViewSelector
      splitView={true}
      activeSplitView={activeSplitView}
      onSplitViewSelectorChanged={onSplitViewSelectorChanged}
      facsimileView={facsimileView}
      introView={introView}
      textView={textView}
    /> : null, [splitView, activeSplitView, onSplitViewSelectorChanged, facsimileView, introView, textView]);

  return (
    <Space direction='horizontal' style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
      {scoreSelector}
      {splitViewSelector}
      <Button
        icon={<Icon component={SettingOutlined} />}
        onClick={onShowDrawer}
        disabled={playingState === PlayingState.PLAYING}>
        {t('scoreControls.settings')}
      </Button>
    </Space>
  );
}

export { type ScoreViewerHeaderProps };
