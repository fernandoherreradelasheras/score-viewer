import { Button } from 'antd';
import Icon, { SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PlayingState } from '../types';
import useStore from '../store';

// Lives either in the viewer header or, when the header would hold nothing else, in
// the tab bar (see ScoreViewer), so it is a component rather than inline JSX.
export default function SettingsButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation("common");
  const playingState = useStore.use.playingState();

  return (
    <Button
      icon={<Icon component={SettingOutlined} />}
      onClick={onClick}
      disabled={playingState === PlayingState.PLAYING}>
      {t('scoreControls.settings')}
    </Button>
  );
}
