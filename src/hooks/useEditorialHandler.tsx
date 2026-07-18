import { useCallback } from 'react';
import useStore from '../store';
import { EDITORIAL_TRANSPARENT_TAGS, EDITORIAL_SELECTION_TAGS, EditorialItem, SUBST_ALLOWED_CHILD_TAGS, CHOICE_ALLOWED_CHILD_TAGS, PlayingState } from '../types';


const PARENTS_OF_ELEMENTS = [...EDITORIAL_SELECTION_TAGS, ...SUBST_ALLOWED_CHILD_TAGS, ...CHOICE_ALLOWED_CHILD_TAGS]



export function useEditorialHandler() {

  const showEditorial = useStore.use.showEditorial();
  const setShowingEditorial = useStore.use.setShowingEditorial();
  const editorials = useStore.use.score()?.editorialItems;
  const playingState = useStore.use.playingState();


  const getEditorialAttached = useCallback((elem: HTMLElement): EditorialItem | undefined => {
    const elemCorrespTarget = elem.getAttribute('data-corresp');
    const elemCorespId = elemCorrespTarget?.replace('#', '');

    return editorials?.find((item) =>
      elem.id === item.id ||
      (elemCorespId != null && item.correspIds?.includes(elemCorespId))
    );
  }, [editorials]);

  const findTarget = useCallback((target: HTMLElement): EditorialItem | null => {
    // A click anywhere inside an editorial group — including its enlarged
    // content-bounding-box hit area — resolves to that group. `.mei-editorial` is set
    // only on the editorial <g> itself (never on the content-bounding-box <g>, which
    // also carries the tag class), so closest() lands on the element whose id matches
    // the item instead of on the bounding-box wrapper.
    const editorialGroup = target.closest('.mei-editorial') as HTMLElement | null;
    const attached = editorialGroup ? getEditorialAttached(editorialGroup) : null;
    if (attached) {
      return attached;
    }

    // Fallback: resolve by editorial tag class / data-corresp (e.g. clef changes).
    for (let e of [...EDITORIAL_TRANSPARENT_TAGS, ...PARENTS_OF_ELEMENTS]) {
      const closest = target.closest(`.${e}`) as HTMLElement | null;
      const editorialForTarget = closest ? getEditorialAttached(closest) : null;
      if (editorialForTarget) {
        return editorialForTarget;
      }
    }
    return null
  }, [getEditorialAttached])

  const handleElementClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!showEditorial || playingState !== PlayingState.STOPPED) return;


    const element = event.target as HTMLElement;
    if (element.tagName === "svg" || element.tagName === "path") {
      return;
    }
    const target = findTarget(element)
    if (target) {
      setShowingEditorial(target.id);
    }
  }, [showEditorial, playingState, getEditorialAttached, setShowingEditorial]);


  return {
    showEditorial,
    editorials,
    handleElementClick,
    getEditorialAttached
  };
}
