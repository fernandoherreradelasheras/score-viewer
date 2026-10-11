import type { BasicSoundBank } from 'spessasynth_core';
import { base64ToArrayBuffer, loadSoundBank, renderMidi } from '../utils/midi-render';
import { MidiSynthRequest, MidiSynthResponse } from '../types/midi-synth-worker';

const soundBanks = new Map<string, Promise<BasicSoundBank>>();

const soundBankAt = (url: string) => {
    let soundBank = soundBanks.get(url);
    if (!soundBank) {
        soundBank = fetch(url).then(async (response) => {
            if (!response.ok) {
                throw new Error(`Cannot load the sound bank ${url}: HTTP ${response.status}`);
            }
            return loadSoundBank(await response.arrayBuffer());
        });
        soundBanks.set(url, soundBank);
        soundBank.catch(() => soundBanks.delete(url));
    }
    return soundBank;
};

self.onmessage = async (event: MessageEvent<MidiSynthRequest>) => {
    const { id, soundfont, midi, sampleRate } = event.data;
    try {
        const channels = await renderMidi(await soundBankAt(soundfont), base64ToArrayBuffer(midi), sampleRate);
        const response: MidiSynthResponse = { id, channels };
        self.postMessage(response, { transfer: channels.map(channel => channel.buffer) });
    } catch (error) {
        const response: MidiSynthResponse = { id, error: error instanceof Error ? error.message : String(error) };
        self.postMessage(response);
    }
};
