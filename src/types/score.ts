// Score-related types
import { EditorialItem } from './editorial';

export type AudioFile = {
    url: string;
    name?: string;
}

export type FacsimileItem = {
    name: string
    file: string
}

export type Score = {
    url: string;
    title: string;
    originalMei: string;
    singleVerseMei: string;
    properties: ScoreProperties;
    editorialItems: EditorialItem[];
    // Alternative rendered-audio versions of the score. The first is the default.
    audioFiles: AudioFile[];
    // Poetic text and text notes extracted from the MEI `<back>` block.
    scoreText: LyricItem[];
    scoreTextComments: string | null;
}

export type TextPartsCache = {
    [url: string]: string | FetchError | null
}

// just adding here those we might use. See verovio docs for explanation
export type Transposition = "" | "P4" | "+P4" | "-P4" | "M3" | "+M3" | "-M3" | "P8" | "+P8" | "-P8"

export type Sources = { [id: string]: { title: string } }


export type ScoreProperties = {
    hasFicta: boolean;
    numVerses: number;
    numMeasures: number;
    composer: string | null;
    lyricist: string | null;
    editor: string;
    reconstructionBy: string | null;
    sections: { label: string; id: string }[];
    sources: Sources;
    responsibilities: Record<string, string>;
    notes: string[];
    hasEditorial: boolean;
    hasOriginalClefs: boolean;
    hasHarmonicAnalysis: boolean;
    encodedTransposition?: Transposition | undefined
    tiedNotes: { first: string; second: string; }[];
    // note/rest/chord xml:id -> staff @n, for page-independent staff resolution.
    noteStaffMap: Record<string, string>;
}

export type VisualizationOptions = {
    showOriginalClefs?: boolean | null | undefined;
}

export class FetchError extends Error {
    type: string;

    constructor(type: string, message: string) {
        super(message);
        this.type = type;
        Object.setPrototypeOf(this, FetchError.prototype);
    }
}

export type LyricItem = {
    title: string
    // Strophes of the block; each strophe is its ordered list of verses (lines).
    // TextView assembles these into markdown.
    strophes: string[][]
}

export type Note = {
    id: string;
    pname: string;
    oct: string;
    dur: string
    pitch: number;

}
