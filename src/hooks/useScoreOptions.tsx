import { useMemo } from "react";
import { SelectProps } from 'antd/es/select';
import useStore from "../store";

/**
 * Custom hook to handle score viewing options logic
 * @returns Functions and derived state for score options panel
 */
export default function useScoreOptions() {
  // Get state and actions from store
  const score = useStore.use.score();
  const showNVerses = useStore.use.showNVerses();
  const setShowNVerses = useStore.use.setShowNVerses();
  const showEditorial = useStore.use.showEditorial();
  const setShowEditorial = useStore.use.setShowEditorial();
  const normalizeFicta = useStore.use.normalizeFicta();
  const setNormalizeFicta = useStore.use.setNormalizeFicta();
  const transposition = useStore.use.transposition();
  const setTransposition = useStore.use.setTransposition();

  // Helper function to get the reverse transposition
  const getReverseTransposition = (transposition?: string) => {
    if (transposition === "-P4") {
      return "P4";
    }
    return "";
  };

  // Handler functions
  const onVersesSelected = (value: number) => {
    setShowNVerses(value);
  };

  const onShowEditorialChange = () => {
    setShowEditorial(!showEditorial);
  };

  const onNormalizeFictaChange = () => {
    setNormalizeFicta(!normalizeFicta);
  };

  const onTranspositionChange = () => {
    if (transposition != null) {
      setTransposition(null);
    } else {
      const reverseTransposition = getReverseTransposition(score?.properties?.encodedTransposition);
      setTransposition(reverseTransposition);
    }
  };

  // Derived state
  const numVersesAvailable = score?.properties?.numVerses || 0;

  const verseOptions: SelectProps['options'] = useMemo(() =>
    Array.from({ length: numVersesAvailable }, (_, key) => 1 + key).map(i => ({
      value: i,
      label: `${i} verso${i > 1 ? "s" : ""}`
    })),
    [numVersesAvailable]
  );

  const editorialDisabled = score?.properties ? !score.properties.hasEditorial : true;
  const fictaSwictchDisabled = score?.properties ? !score.properties.hasFicta : true;
  const showTranspositionOption = Boolean(score?.properties?.encodedTransposition);
  const showVerseOptions = verseOptions.length > 0;

  return {
    // State
    showNVerses,
    showEditorial,
    normalizeFicta,
    transposition,
    score,

    // Derived state
    numVersesAvailable,
    verseOptions,
    editorialDisabled,
    fictaSwictchDisabled,
    showTranspositionOption,
    showVerseOptions,

    // Actions
    onVersesSelected,
    onShowEditorialChange,
    onNormalizeFictaChange,
    onTranspositionChange
  };
}