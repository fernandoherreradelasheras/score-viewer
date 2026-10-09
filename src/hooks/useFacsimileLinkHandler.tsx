import { useCallback, useContext } from 'react';
import useStore from '../store';
import { PlayingState } from '../types';
import { Context } from '../Context';
import { isLinkClick, useLinkModifier } from './useLinkModifier';


export function useFacsimileLinkHandler() {

  const { verovio } = useContext(Context);
  const showNoteInFacsimile = useStore.use.showNoteInFacsimile();
  const isFacsimileLinked = useStore.use.isFacsimileLinked();
  const zones = useStore.use.score()?.properties.facsimileLinks?.zones;
  const playingState = useStore.use.playingState();
  const focusFacsimileElements = useStore.use.focusFacsimileElements();
  const elementPages = useStore.use.elementPages();
  const goToLinkedElement = useStore.use.goToLinkedElement();
  const linkModifierHeld = useLinkModifier();

  const facsimileLinkable = showNoteInFacsimile && isFacsimileLinked && zones != null
    && playingState !== PlayingState.PLAYING;
  const facsimileClickable = facsimileLinkable && linkModifierHeld;

  // Whether the click followed a link, which takes it over from other handlers.
  const handleFacsimileLinkClick = useCallback((event: React.MouseEvent<HTMLElement>): boolean => {
    if (!facsimileLinkable || !isLinkClick(event) || !(event.target instanceof Element)) return false;

    // The bounding boxes verovio draws inside an element carry its class as well.
    const element = event.target.closest(':is(.note, .rest, .mRest, .chord):not(.bounding-box):not(.content-bounding-box)');
    if (element && zones?.[element.id]) {
      focusFacsimileElements([element.id]);
      return true;
    }
    return false;
  }, [facsimileLinkable, zones, focusFacsimileElements]);

  const showInScore = useCallback(async (elementId: string) => {
    const page = elementPages[elementId] ?? await verovio?.getPageWithElement(elementId);
    if (page && page > 0) {
      goToLinkedElement(elementId, page);
    }
  }, [elementPages, verovio, goToLinkedElement]);

  return {
    facsimileLinkable,
    facsimileClickable,
    handleFacsimileLinkClick,
    showInScore,
  };
}
