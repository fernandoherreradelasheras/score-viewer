// Intervals as the configuration writes them (encodingProperties.encodedTransposition,
// e.g. "-P4": the MEI is encoded a fourth below the source) and as Verovio's
// `transpose` option takes them. Shared by the server tests and the browser.

const LETTERS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];        // of each letter above C
const PERFECT = new Set([1, 4, 5]);               // simple intervals that are perfect

// "-P4" → { dir: -1, steps: 3, semitones: 5 } (steps and semitones unsigned).
export function parseInterval(s) {
  const m = /^\s*([+-]?)([PMmAd])(\d+)\s*$/.exec(String(s || ''));
  if (!m) return null;
  const [, sign, quality, numStr] = m;
  const num = Number(numStr);
  if (num < 1) return null;
  const steps = num - 1;
  const simple = (steps % 7) + 1;
  const octaves = Math.floor(steps / 7);
  let semitones = SEMITONES[steps % 7] + 12 * octaves;   // major or perfect
  if (PERFECT.has(simple)) {
    if (quality === 'A') semitones += 1;
    else if (quality === 'd') semitones -= 1;
    else if (quality !== 'P') return null;
  } else {
    if (quality === 'm') semitones -= 1;
    else if (quality === 'A') semitones += 1;
    else if (quality === 'd') semitones -= 2;
    else if (quality !== 'M') return null;
  }
  return { dir: sign === '-' ? -1 : 1, steps, semitones };
}

// The interval that undoes another one: "-P4" → "P4", "P4" or "+P4" → "-P4".
// Returns '' for an empty or unreadable interval.
export function invertInterval(s) {
  const m = /^\s*([+-]?)([PMmAd]\d+)\s*$/.exec(String(s || ''));
  if (!m) return '';
  return m[1] === '-' ? m[2] : `-${m[2]}`;
}

// Transpose a pitch: letter (c…b), alteration in semitones (-2…2), octave.
export function transposePitch(pname, alter, oct, interval) {
  const iv = typeof interval === 'string' ? parseInterval(interval) : interval;
  const i = LETTERS.indexOf(String(pname).toLowerCase());
  if (!iv || i < 0) return { pname, alter, oct };
  const from = 7 * oct + i;
  const to = from + iv.dir * iv.steps;
  const newOct = Math.floor(to / 7);
  const newI = ((to % 7) + 7) % 7;
  const midi = 12 * oct + SEMITONES[i] + alter + iv.dir * iv.semitones;
  const newAlter = midi - (12 * newOct + SEMITONES[newI]);
  return { pname: LETTERS[newI], alter: newAlter, oct: newOct };
}

// MEI accidental values → semitones.
export const ACCID_ALTER = { s: 1, f: -1, n: 0, ss: 2, x: 2, ff: -2, ts: 3, tf: -3 };

export function alterSign(alter) {
  return { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' }[alter] ?? (alter > 0 ? '♯'.repeat(alter) : '♭'.repeat(-alter));
}
