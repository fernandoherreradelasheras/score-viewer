import { useCallback } from 'react';
import useStore from '../store';
import { PlayingState } from '../types';


export function useFacsimileLinkHandler() {

  const showNoteInFacsimile = useStore.use.showNoteInFacsimile();
  const isFacsimileLinked = useStore.use.isFacsimileLinked();
  const zones = useStore.use.score()?.properties.facsimileLinks?.zones;
  const playingState = useStore.use.playingState();
  const focusFacsimileElements = useStore.use.focusFacsimileElements();

  const facsimileClickable = showNoteInFacsimile && isFacsimileLinked && zones != null
    && playingState !== PlayingState.PLAYING;

  const handleFacsimileLinkClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!facsimileClickable || !(event.target instanceof Element)) return;

    // The bounding boxes verovio draws inside an element carry its class as well.
    const element = event.target.closest(':is(.note, .rest, .mRest, .chord):not(.bounding-box):not(.content-bounding-box)');
    if (element && zones?.[element.id]) {
      focusFacsimileElements([element.id]);
    }
  }, [facsimileClickable, zones, focusFacsimileElements]);

  return {
    facsimileClickable,
    handleFacsimileLinkClick,
  };
}
