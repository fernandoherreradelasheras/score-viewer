// Builds the sound bank the MIDI audio is synthesized with: FluidR3_GM for every
// instrument, and the "Vocal Oooh" of KBH Real and Swelling Choirs for the voices.
//
//   npx tsx tools/soundbank/build.mts <FluidR3_GM.sf2> <KBH_Real_and_Swell_Choir.sf2> assets/soundbank/score-viewer.sf3
//
// Needs ffmpeg with libvorbis to compress the samples.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import {
    BasicPreset, BasicSoundBank, GeneratorTypes, SoundBankLoader, SpessaSynthProcessor,
} from 'spessasynth_core';

const CHOIR_AAHS = 52;
const VOICE_OOHS = 53;
const KBH_VOCAL_OOOH = 0;
const VORBIS_QUALITY = '5';
const RATE = 44100;

const [fluidPath, kbhPath, outPath] = process.argv.slice(2);
if (!outPath) {
    console.error('Usage: npx tsx tools/soundbank/build.mts <FluidR3_GM.sf2> <KBH_Real_and_Swell_Choir.sf2> <out.sf3>');
    process.exit(1);
}

const load = async (path: string) => {
    const data = await fs.readFile(path);
    return SoundBankLoader.fromArrayBuffer(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
};

const melodicPreset = (bank: BasicSoundBank, program: number) =>
    bank.presets.find(p => p.program === program && p.bankMSB === 0 && !p.isGMGSDrum)!;

const lowestKey = (preset: BasicPreset) => Math.min(...preset.zones.flatMap(presetZone =>
    presetZone.instrument.zones.map(zone => Math.max(0, presetZone.keyRange.min, zone.keyRange.min))));

const loudness = async (bank: BasicSoundBank, program: number) => {
    const synth = new SpessaSynthProcessor(RATE, { eventsEnabled: false });
    synth.soundBankManager.addSoundBank(bank, 'bank');
    await synth.processorInitialized;
    synth.programChange(0, program);
    for (const key of [55, 60, 64, 67, 72]) synth.noteOn(0, key, 90);
    const left = new Float32Array(RATE * 2);
    const right = new Float32Array(RATE * 2);
    for (let offset = 0; offset < left.length; offset += 128) synth.process(left, right, offset, 128);
    let sum = 0;
    for (let i = 0; i < left.length; i++) sum += left[i] * left[i] + right[i] * right[i];
    return Math.sqrt(sum / (2 * left.length));
};

const encodeVorbis = async (audio: Float32Array, sampleRate: number) => {
    const result = spawnSync('ffmpeg', [
        '-loglevel', 'error', '-f', 'f32le', '-ar', String(sampleRate), '-ac', '1', '-i', 'pipe:0',
        '-c:a', 'libvorbis', '-q:a', VORBIS_QUALITY, '-f', 'ogg', 'pipe:1',
    ], { input: Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength), maxBuffer: 1 << 30 });
    if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr}`);
    return new Uint8Array(result.stdout);
};

const bank = await load(fluidPath);
const kbh = await load(kbhPath);

// The percussion channel is never used, nor are the variation banks.
for (const preset of [...bank.presets]) {
    if (preset.isGMGSDrum || preset.bankMSB !== 0) bank.deletePreset(preset);
}

const fluidVoice = melodicPreset(bank, VOICE_OOHS);
const kbhVoice = melodicPreset(kbh, KBH_VOCAL_OOOH);
const levelCb = 200 * Math.log10(await loudness(kbh, KBH_VOCAL_OOOH) / await loudness(bank, VOICE_OOHS));
const kbhLowest = lowestKey(kbhVoice);

bank.addCompletePresets([kbhVoice]);
const voice = new BasicPreset(bank);
voice.name = 'Voice Oohs (KBH)';
voice.program = VOICE_OOHS;
for (const zone of kbhVoice.zones) {
    const copy = voice.createZone(zone.instrument);
    copy.copyFrom(zone);
    copy.addToGenerator(GeneratorTypes.initialAttenuation, Math.max(0, levelCb), false);
}
// KBH starts at C3: lower voices fall back to FluidR3.
for (const zone of fluidVoice.zones) {
    if (Math.max(0, zone.keyRange.min) >= kbhLowest) continue;
    const copy = voice.createZone(zone.instrument);
    copy.copyFrom(zone);
    copy.keyRange = { min: Math.max(0, zone.keyRange.min), max: Math.min(zone.keyRange.max < 0 ? 127 : zone.keyRange.max, kbhLowest - 1) };
    copy.addToGenerator(GeneratorTypes.initialAttenuation, Math.max(0, -levelCb), false);
}
bank.deletePreset(kbhVoice);
bank.deletePreset(fluidVoice);
bank.addPresets(voice);

const choir = melodicPreset(bank, CHOIR_AAHS);
const choirVoice = new BasicPreset(bank);
choirVoice.name = 'Choir Aahs (KBH)';
choirVoice.program = CHOIR_AAHS;
for (const zone of voice.zones) choirVoice.createZone(zone.instrument).copyFrom(zone);
bank.deletePreset(choir);
bank.addPresets(choirVoice);

bank.removeUnusedElements();
bank.flush();
bank.soundBankInfo.name = 'score-viewer';
bank.soundBankInfo.copyright = 'FluidR3_GM: Frank Wen, MIT license. KBH Real and Swelling Choirs: lfz, CC BY.';
bank.soundBankInfo.comment = 'FluidR3_GM without percussion, with the Vocal Oooh of KBH Real and Swelling Choirs as Choir Aahs and Voice Oohs.';

console.log(`KBH level ${levelCb.toFixed(0)} cB against FluidR3, lowest KBH key ${kbhLowest}`);
console.log(`${bank.presets.length} presets, ${bank.samples.length} samples. Compressing…`);
await bank.setSampleFormat({ format: 'compressed', compressionFunction: encodeVorbis });
const out = bank.writeSF2({ software: 'score-viewer tools/soundbank' });
await fs.writeFile(outPath, new Uint8Array(out));
console.log(`${outPath}: ${(out.byteLength / 1048576).toFixed(1)} MB`);
