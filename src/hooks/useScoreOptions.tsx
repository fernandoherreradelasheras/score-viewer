import { useMemo } from "react";
import { SelectProps } from 'antd/es/select';
import useStore from "../store";
import i18next from '../i18n'




export default function useScoreOptions() {
  const score = useStore.use.score();
  const showNVerses = useStore.use.showNVerses();
  const setShowNVerses = useStore.use.setShowNVerses();
  const showOriginalClefs = useStore.use.showOriginalClefs();
  const setShowOriginalClefs = useStore.use.setShowOriginalClefs();
  const showReconstructions = useStore.use.showReconstructions();
  const setShowReconstructions = useStore.use.setShowReconstructions();
  const showEditorial = useStore.use.showEditorial();
  const setShowEditorial = useStore.use.setShowEditorial();
  const normalizeFicta = useStore.use.normalizeFicta();
  const setNormalizeFicta = useStore.use.setNormalizeFicta();
  const transposition = useStore.use.transposition();
  const setTransposition = useStore.use.setTransposition();
  const showMusicAnalysis = useStore.use.showMusicAnalysis();
  const setShowMusicAnalysis = useStore.use.setShowMusicAnalysis();

  const getReverseTransposition = (transposition?: string) => {
    if (transposition?.startsWith("-")) {
      return "+" + transposition.substring(1);
    } else if (transposition?.startsWith("+") || (transposition && transposition.length > 1)) {
      return "-" + transposition.substring(1);
    }
    return "";
  };

  const onVersesSelected = (value: number) => {
    setShowNVerses(value);
  };

  const onReconstructionSelected = (staff: string, reconstruction: string) => {
    console.log(`Selected reconstruction for staff ${staff}:  ${reconstruction}`);
    setShowReconstructions( { [staff]: reconstruction } , false);
  };

  const onShowEditorialChange = () => {
    setShowEditorial(!showEditorial);
  };

  const onNormalizeFictaChange = () => {
    setNormalizeFicta(!normalizeFicta);
  };

  const onShowOriginalClefsChange = () => {
    console.log(`Show original clefs: ${!showOriginalClefs}`);
    setShowOriginalClefs(!showOriginalClefs);
  }

  const onTranspositionChange = () => {
    if (transposition != null) {
      setTransposition(null);
    } else {
      const reverseTransposition = getReverseTransposition(score?.properties?.encodedTransposition);
      setTransposition(reverseTransposition);
    }
  };

  const onShowMusicAnalysisChange = () => {
    setShowMusicAnalysis(!showMusicAnalysis);
  };

  // Derived state
  const numVersesAvailable = score?.properties?.numVerses || 0;
  const numReconstructionsAvailable = score?.properties ? Object.entries(score.properties.reconstructions).length : 0
  const originalClefsAvailable = score?.properties?.hasOriginalClefs || false;

  const verseOptions: SelectProps['options'] = useMemo(() =>
    Array.from({ length: numVersesAvailable }, (_, key) => 1 + key).map(i => ({
      value: i,
      label: i18next.t("scoreOptions.verseAmmount", { "count" : i})
    })),
    [numVersesAvailable]
  );


  const voiceRecontructions: { staff: string, voiceName: string, selectOptions: SelectProps['options'] }[] = useMemo(() => {
    if (score?.properties?.reconstructions === undefined) {
      return []
    }
    const reconstructions: { staff: string, voiceName: string, selectOptions: SelectProps['options'] }[] = []
    for (const voiceRecontructed of score?.properties?.reconstructions) {
      if (voiceRecontructed.reconstructionsForVoice.length === 0) {
        continue;
      }
      const reconstructionsForVoice: SelectProps['options'] = []
      for (const reconstruction of voiceRecontructed.reconstructionsForVoice) {
        // Format is reconstruction:staff:type:name
        const name = reconstruction.label != "none" ? reconstruction.label.split(":")[3] : i18next.t("scoreOptions.reconstructionNone");
        reconstructionsForVoice.push({ value: reconstruction.label, label: name })
      }
      reconstructions.push({ staff: voiceRecontructed.staff, voiceName: voiceRecontructed.voiceName, selectOptions: reconstructionsForVoice })
    }
    return reconstructions
  }, [numReconstructionsAvailable])


  const editorialDisabled = score?.properties ? !score.properties.hasEditorial : true;
  const fictaSwictchDisabled = score?.properties ? !score.properties.hasFicta : true;
  const showTranspositionOption = score?.properties?.encodedTransposition !== undefined && score?.properties?.encodedTransposition !== "";
  const showVerseOptions = verseOptions.length > 0;
  const showReconstructionOptions = numReconstructionsAvailable > 0

  return {
    // State
    showNVerses,
    showReconstructions,
    showEditorial,
    showOriginalClefs,
    normalizeFicta,
    transposition,
    showMusicAnalysis,
    score,

    // Derived state
    numVersesAvailable,
    originalClefsAvailable,
    verseOptions,
    showReconstructionOptions,
    voiceRecontructions,
    editorialDisabled,
    fictaSwictchDisabled,
    showTranspositionOption,
    showVerseOptions,

    // Actions
    onVersesSelected,
    onReconstructionSelected,
    onShowEditorialChange,
    onShowOriginalClefsChange,
    onNormalizeFictaChange,
    onTranspositionChange,
    onShowMusicAnalysisChange,
  };
}
