import { useCallback } from 'react';
import useStore from '../store';
import { EditorialItem } from '../types';

const targets = ["note", "rest", "clef", "accid", "app", "choice", "corr", "sic", "unclear", "supplied", "reg", "measure"];


export function useEditorialHandler() {
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
      case "corr": return "Corrección aplicada";
      case "unclear": return "Elemento poco claro en la fuente";
      case "choice": return "Opciones disponibles";
      case "app": return "Lecturas alternativas";
      case "lem": return "lectura preferida";
      case "rdg": return "otra lectura";
      case "sic": return "error evidente";
      case "supplied": return "parte añadida";
      case "reg": return "Regularización";
      case "clef[data-corresp]": return "Cambio de clave";
      default: return `tipo: ${type}`;
    }
  }, []);

  return {
    showEditorial,
    editorials,
    handleElementClick,
    formatType,
    getEditorialAttached
  };
}