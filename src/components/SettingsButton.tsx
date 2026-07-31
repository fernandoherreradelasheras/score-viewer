import { Button, Grid, Tooltip } from 'antd';
import Icon, { SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PlayingState } from '../types';
import useStore from '../store';

// Lives either in the viewer header or, when the header would hold nothing else, in
// the tab bar (see ScoreViewer), so it is a component rather than inline JSX.
export default function SettingsButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("common");
  const playingState = useStore.use.playingState();
  const screens = Grid.useBreakpoint();

  // Icon only on narrow viewports: in the tab bar the label competes for width with
  // the tab titles, and that is where horizontal space is scarcest.
  const compact = !screens.md;
  const label = t('scoreControls.settings');

  const button = (
    <Button
      icon={<Icon component={SettingOutlined} />}
      onClick={onClick}
      aria-label={label}
      disabled={playingState === PlayingState.PLAYING}>
      {compact ? null : label}
    </Button>
  );

  return compact ? <Tooltip title={label}>{button}</Tooltip> : button;
}
