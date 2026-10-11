import {
    BasicMIDI, BasicSoundBank, MIDIMessageType, MIDITrack, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer,
} from 'spessasynth_core';

// Room for the release and the reverb of the last notes.
const TAIL_SECONDS = 2;
// The interval between modulator and LFO updates.
const BLOCK_SIZE = 128;

export const loadSoundBank = (data: ArrayBuffer): BasicSoundBank => SoundBankLoader.fromArrayBuffer(data);

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

const PERCUSSION_CHANNEL = 9;
const MELODIC_CHANNELS = 15;

const isChannelEvent = (statusByte: number) => statusByte >= 0x80 && statusByte < 0xf0;

// verovio writes every staff on channel 0, where the program of the last staff would
// sound for all of them and a voice in unison with another would cut its notes off.
// Each staff gets a channel of its own, out of the percussion one. There are fifteen:
// the staves after them are left silent.
export const spreadTracksOverChannels = (midi: BasicMIDI) => {
    const isStaff = (track: MIDITrack) => track.events.some(e => isChannelEvent(e.statusByte));
    const staves = midi.tracks.filter(isStaff);
    if (staves.length > MELODIC_CHANNELS) {
        console.warn(`[score-viewer] Only the first ${MELODIC_CHANNELS} of the ${staves.length} staves sound in the MIDI audio.`);
        midi.tracks = midi.tracks.filter(track => !isStaff(track) || staves.indexOf(track) < MELODIC_CHANNELS);
    }
    staves.slice(0, MELODIC_CHANNELS).forEach((track, staff) => {
        const channel = staff < PERCUSSION_CHANNEL ? staff : staff + 1;
        for (const event of track.events) {
            if (isChannelEvent(event.statusByte)) {
                event.statusByte = ((event.statusByte & 0xf0) | channel) as MIDIMessageType;
            }
        }
    });
    midi.flush(false);
};

export async function renderMidi(soundBank: BasicSoundBank, midiData: ArrayBuffer, sampleRate: number): Promise<[Float32Array, Float32Array]> {
    const midi = BasicMIDI.fromArrayBuffer(midiData);
    spreadTracksOverChannels(midi);
    const synth = new SpessaSynthProcessor(sampleRate, { eventsEnabled: false });
    synth.soundBankManager.addSoundBank(soundBank, 'main');
    await synth.processorInitialized;
    synth.setSystemParameter('autoAllocateVoices', true);

    const sequencer = new SpessaSynthSequencer(synth);
    // The audio has to start where the timemap does, rests at the start included.
    sequencer.skipToFirstNoteOn = false;
    sequencer.loadNewSongList([midi]);
    sequencer.play();

    const length = Math.ceil(sampleRate * (midi.duration + TAIL_SECONDS));
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    for (let offset = 0; offset < length; offset += BLOCK_SIZE) {
        sequencer.processTick();
        synth.process(left, right, offset, Math.min(BLOCK_SIZE, length - offset));
    }
    return [left, right];
}
