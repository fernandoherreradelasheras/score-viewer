// General MIDI programs, 0-based, for the staves of a score whose MEI does not give
// one in <instrDef @midi.instrnum>. The sound bank plays programs 52 and 53 with sung
// voices, and every other program with FluidR3_GM.

export const VOICE_PROGRAM = 53;
export const DEFAULT_PROGRAM = 0;

// Tried in order: "bajo continuo" is an instrument before "bajo" is a voice, and
// "flauta de pico" a recorder before "flauta" a flute.
const INSTRUMENTS: [string[], number][] = [
    [['continuo', 'guion', 'acompanamiento', 'accompaniment', 'piano', 'pianoforte', 'fortepiano', 'teclado', 'keyboard'], 0],
    [['clave', 'clavicembalo', 'cembalo', 'clavecin', 'harpsichord'], 6],
    [['organo', 'organ', 'orgue', 'orgel'], 19],
    [['guitarra', 'guitar', 'chitarra', 'vihuela', 'laud', 'lute', 'liuto', 'archilaud', 'archlute', 'tiorba', 'tiorbo', 'theorbo'], 24],
    [['contrabajo', 'contrabass', 'double bass', 'violone', 'violon'], 43],
    [['viola da gamba', 'viola de gamba', 'gamba', 'viol', 'violonchelo', 'violoncello', 'violoncelo', 'cello'], 42],
    [['viola'], 41],
    [['violin', 'violino'], 40],
    [['arpa', 'harp', 'harpe', 'harfe'], 46],
    [['corneta', 'cornetto', 'cornett', 'trompeta', 'clarin', 'trumpet', 'tromba'], 56],
    [['sacabuche', 'trombon', 'trombone', 'sackbut'], 57],
    [['trompa', 'corno', 'horn'], 60],
    [['chirimia', 'shawm', 'oboe'], 68],
    [['bajon', 'dulcian', 'fagot', 'fagotto', 'bassoon'], 70],
    [['clarinete', 'clarinetto', 'clarinet'], 71],
    [['flauta de pico', 'flauta dulce', 'flauto dolce', 'recorder', 'blockflote'], 74],
    [['flauta', 'flauto', 'traverso', 'flute'], 73],
];

const VOICES = [
    'voz', 'voces', 'voice', 'voices', 'vox', 'coro', 'choir', 'chorus', 'canto', 'cantus', 'cantor',
    'tiple', 'soprano', 'sopran', 'superius', 'discantus', 'mezzo', 'alto', 'altus', 'contralto',
    'contratenor', 'countertenor', 'tenor', 'tenore', 'baritono', 'baritone', 'bajo', 'baxo', 'basso',
    'bassus', 'bass', 'quintus', 'sextus',
];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const mentions = (label: string, names: string[]) =>
    names.some(name => new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(label));

export function midiProgramFor(label: string, hasLyrics: boolean): number {
    const text = normalize(label);
    const instrument = INSTRUMENTS.find(([names]) => mentions(text, names));
    if (instrument) return instrument[1];
    if (hasLyrics || mentions(text, VOICES)) return VOICE_PROGRAM;
    return DEFAULT_PROGRAM;
}
