import { useCallback } from 'react';
import useStore from '../store';
import { EditorialItem } from '../types';
import { useTranslation } from 'react-i18next';


const targets = ["note", "rest", "clef", "accid", "app", "choice", "corr", "sic", "unclear", "supplied", "reg", "measure"];


export function useEditorialHandler() {

  const { t } = useTranslation("common")

  const showEditorial = useStore.use.showEditorial();
  const setShowingEditorial = useStore.use.setShowingEditorial();
  const editorials = useStore.use.score()?.editorialItems;


  const getEditorialAttached = useCallback((elem: HTMLElement): EditorialItem | undefined => {
    const elemCorrespTarget = elem.getAttribute('data-corresp');
    const elemCorespId = elemCorrespTarget?.replace('#', '');

    return editorials?.find((item) =>
      elem.id === item.id ||
      (elemCorespId != null && item.correspIds?.includes(elemCorespId))
    );
  }, [editorials]);

  const findTarget = useCallback((target: HTMLElement): EditorialItem | null => {
    for (let e of targets) {
      const closest = target.closest(`.${e}`) as HTMLElement | null;
      const editorialForTarget = closest ? getEditorialAttached(closest) : null;

      if (editorialForTarget) {
        return editorialForTarget;
      }
    }
    return null
}, [getEditorialAttached,setShowingEditorial])

  const handleElementClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!showEditorial) return;


    const element = event.target as HTMLElement;
    const target = findTarget(element)
    if (target) {
      setShowingEditorial(target.id);
    } else {
      const bb = element.closest(".bounding-box") as HTMLElement | null;
      const parentTarget = bb?.parentElement
      if (parentTarget && [...parentTarget.classList.values()].some(c => targets.includes(c))) {
        const editorialForTarget = getEditorialAttached(parentTarget)
        if (editorialForTarget) {
          setShowingEditorial(editorialForTarget.id);
        }
      }
    }
  }, [showEditorial, getEditorialAttached, setShowingEditorial]);


  const formatType = useCallback((type: string): string => {
    switch (type) {
      case "corr": return t('editorial.formatType.corr');
      case "unclear": return t('editorial.formatType.unclear');
      case "choice": return t('editorial.formatType.choice');
      case "app": return t('editorial.formatType.app');
      case "lem": return t('editorial.formatType.lem');
      case "rdg": return t('editorial.formatType.rdg');
      case "sic": return t('editorial.formatType.sic');
      case "supplied": return t('editorial.formatType.supplied');
      case "reg": return t('editorial.formatType.reg');
      case "clef[data-corresp]": return t('editorial.formatType.clefChange');
      default: return t('editorial.formatType.default', { type });
    }
  }, [t]);

  return {
    showEditorial,
    editorials,
    handleElementClick,
    formatType,
    getEditorialAttached
  };
}
