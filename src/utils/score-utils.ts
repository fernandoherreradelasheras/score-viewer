const getReverseTransposition = (transposition?: string) => {
    if (!transposition) {
        return "";
    }
    if (transposition.startsWith("-")) {
        return "+" + transposition.substring(1);
    }
    return "-" + (transposition.startsWith("+") ? transposition.substring(1) : transposition);
};


interface NotePitch {
    pname: string
    accid: string
    oct: string
}

const PITCH_NAMES = ["c", "d", "e", "f", "g", "a", "b"];
const NATURAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const ACCIDENTAL_OFFSETS: Record<string, number> = { ff: -2, f: -1, "": 0, n: 0, s: 1, ss: 2, x: 2 };
const ACCIDENTALS_BY_OFFSET: Record<number, string> = { [-2]: "ff", [-1]: "f", 0: "", 1: "s", 2: "ss" };

// Verovio's interval syntax ("-P4", "+M3", "P8"): a sign, a quality and a number.
const parseInterval = (interval: string) => {
    const match = /^([+-]?)([PMmAd])(\d+)$/.exec(interval);
    if (!match) {
        return null;
    }
    const direction = match[1] == "-" ? -1 : 1;
    const quality = match[2];
    const steps = parseInt(match[3]) - 1;
    const simple = steps % 7;
    const perfect = [0, 3, 4].includes(simple);
    const qualityOffset =
        quality == "P" || quality == "M" ? 0
            : quality == "m" ? -1
                : quality == "A" ? 1
                    : perfect ? -1 : -2;
    const semitones = 12 * Math.floor(steps / 7) + NATURAL_SEMITONES[simple] + qualityOffset;
    return { steps: direction * steps, semitones: direction * semitones };
};

/**
 * The pitch a note takes after `interval`, spelled the way verovio would spell it when
 * rendering with that `--transpose` value. Left untouched when the pitch or the interval
 * can't be read, or the result would need more than a double accidental.
 */
const transposeNote = <T extends NotePitch>(note: T, interval: string): T => {
    const parsed = parseInterval(interval);
    const index = PITCH_NAMES.indexOf(note.pname.toLowerCase());
    const octave = parseInt(note.oct);
    const alteration = ACCIDENTAL_OFFSETS[note.accid];
    if (!parsed || index < 0 || isNaN(octave) || alteration === undefined) {
        return note;
    }
    const target = index + 7 * octave + parsed.steps;
    const newIndex = ((target % 7) + 7) % 7;
    const newOctave = Math.floor(target / 7);
    const newAlteration = 12 * octave + NATURAL_SEMITONES[index] + alteration + parsed.semitones
        - (12 * newOctave + NATURAL_SEMITONES[newIndex]);
    const newAccid = newAlteration == 0 && note.accid == "n" ? "n" : ACCIDENTALS_BY_OFFSET[newAlteration];
    if (newAccid === undefined) {
        return note;
    }
    return { ...note, pname: PITCH_NAMES[newIndex], accid: newAccid, oct: String(newOctave) };
};

export { getReverseTransposition, transposeNote };
