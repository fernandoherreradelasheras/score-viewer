// Score-related types
import { EditorialItem } from './editorial';

export type FacsimileItem = {
    name: string
    file: string
}

export type ReconstructionItem = {
    voice: string
    label: string
    reconstructionBy: string
}

export type ParallelIntervalViolation = {
    partNames: string[]
    measureNumbers: string[]
    offsets: number[]
    notes: {
        first: Note[]
        second: Note[]
    }
    intervalType: 'fifth' | 'octave'
}

export type Score = {
    url: string;
    title: string;
    originalMei: string;
    singleVerseMei: string;
    properties: ScoreProperties;
    editorialItems: EditorialItem[];
    fascimileItems?: FacsimileItem[] | undefined;
}

export type TextPartsCache = {
    [url: string]: string | null
}

export type Reconstruction = {
    staff: string;
    voiceName: string;
    reconstructionsForVoice: ReconstructionItem[];
}

// just adding here those we might use. See verovio docs for explanation
export type Transposition = "" | "P4" | "+P4" | "-P4" | "M3" | "+M3" | "-M3" | "P8" | "+P8" | "-P8"


export type ScoreProperties = {
    hasFicta: boolean;
    numVerses: number;
    numMeasures: number;
    composer: string;
    lyricist: string;
    editor: string;
    reconstructions: Reconstruction[];
    reconstructionBy: string | null;
    sections: {label: string; id: string}[];
    notes: string[];
    hasEditorial: boolean;
    hasOriginalClefs: boolean;
    encodedTransposition?: Transposition | undefined
    tiedNotes: { first: string; second: string; }[];
}

export type VisualizationOptions = {
    showOriginalClefs?: boolean | null | undefined;
    showReconstructions?: { [staff:string] : string } | undefined;
}

export type LyricItem = {
    title: string
    text: string
}

export type TextParts = {
    lyrics: LyricItem[] | null;
    textComments: string | null;
    introduction: string | null;
}

export type Note = {
    id: string;
    pname: string;
    oct: string;
    dur: string
    pitch: number;

}
