// Score-related types
import { EditorialItem } from './editorial';
import { AudioTrack } from './player';

export type FacsimileItem = {
    name: string
    file: string
}

export type ReconstructionItem = {
    voice: string
    label: string
    reconstructionBy: string
}


export type Score = {
    url: string;
    title: string;
    originalMei: string;
    singleVerseMei: string;
    properties: ScoreProperties;
    editorialItems: EditorialItem[];
    audioUrl: string | null;
    audioOverlayTracks: AudioTrack[];
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
    composer: string;
    lyricist: string;
    editor: string;
    reconstructionBy: string | null;
    sections: { label: string; id: string }[];
    sources: Sources;
    notes: string[];
    hasEditorial: boolean;
    hasOriginalClefs: boolean;
    encodedTransposition?: Transposition | undefined
    // Whether the external audio plays expansions/repeats expanded (see ScoreViewerConfigScore).
    audioUsesExpansions?: boolean | undefined
    tiedNotes: { first: string; second: string; }[];
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
    text: string | FetchError
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
