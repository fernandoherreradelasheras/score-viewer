import useStore from '../store';
import { AudioSync, TimeMapEvent } from '../types';
import { StaffOf, playbackTimemap } from '../utils/audio-sync';

export const useSelectedAudioSync = (): AudioSync | null => {
  const score = useStore.use.score();
  const selectedAudioIndex = useStore.use.selectedAudioIndex();
  return score?.audioFiles?.[selectedAudioIndex]?.sync ?? null;
};

export const useStaffOf = (): StaffOf => {
  const noteStaffMap = useStore.use.score()?.properties?.noteStaffMap;
  return (id: string) => noteStaffMap?.[id] ? parseInt(noteStaffMap[id]) : undefined;
};

export default function usePlaybackTimemap(): TimeMapEvent[] {
  const timemap = useStore.use.renderedSvgData()?.timemap;
  const sync = useSelectedAudioSync();
  const staffOf = useStaffOf();
  return timemap ? playbackTimemap(timemap, sync, staffOf) : [];
}
