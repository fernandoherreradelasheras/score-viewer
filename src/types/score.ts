// Score-related types
import { EditorialItem } from './editorial';

export type AudioFile = {
    url: string;
    name?: string;
}

export type FacsimileItem = {
    name: string
    file: string
    // xml:id of the <perfRes> whose part the image shows. Its staves are the <staffDef>s
    // whose @decls point at it. An image without one is of the full score.
    part?: string | undefined
}

// A <surface> of the MEI <facsimile>, in its own coordinate space, and the image it is
// drawn on (its <graphic>@target, which config images are matched against).
export type FacsimileSurface = {
    label: string
    target: string
    width: number
    height: number
    // Median distance from each zone to its nearest one: how closely the notes are
    // written on this page. Null with fewer than two zones.
    noteSpacing: number | null
}

export type FacsimileZone = {
    surface: number
    ulx: number
    uly: number
    lrx: number
    lry: number
}

export type FacsimileLinks = {
    surfaces: FacsimileSurface[]
    // note/rest/chord xml:id -> the zone its @facs points at
    zones: Record<string, FacsimileZone>
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

// Terms declared in <classDecls>, keyed by the xml:id that @class points at.
// `members` holds the xml:ids of the <app>, <choice> and <subst> elements whose readings
// all classify under the term, in document order. More than one is a variant group:
// several entries that verovio flips together, so they are a single editorial decision
// for the reader. Where each one sits is the editorial item's business, not this map's.
export type Categories = { [id: string]: { label: string; desc: string | null; members: string[] } }


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
    categories: Categories;
    responsibilities: Record<string, string>;
    notes: string[];
    // Anything score-viewer presents as an editorial intervention, i.e. what the
    // editorial layer highlights and lists. The global apparatus does not count:
    // original clefs and harmonic analysis are display options, and each has its own
    // flag below. Narrower than "the MEI contains editorial elements" in verovio's
    // sense, which also covers the global apparatus.
    hasEditorialInterventions: boolean;
    hasOriginalClefs: boolean;
    hasHarmonicAnalysis: boolean;
    encodedTransposition?: Transposition | undefined
    tiedNotes: { first: string; second: string; }[];
    // note/rest/mRest/chord xml:id -> staff @n, for page-independent staff resolution.
    noteStaffMap: Record<string, string>;
    // null when no note or rest is linked to a <facsimile> zone.
    facsimileLinks: FacsimileLinks | null;
    // <perfRes> xml:id -> @n of the staves whose <staffDef> @decls point at it.
    partStaves: Record<string, string[]>;
    // <perfRes> xml:id -> its name.
    partLabels: Record<string, string>;
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
