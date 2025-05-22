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

export type LyricItem = {
    title: string
    text: string
}

export type Score = {
    url: string
    title: string
    originalMei: string
    singleVerseMei: string
    properties: ScoreProperties
    editorialItems: EditorialItem[]
    lyrics?: LyricItem[]
    fascimileItems?: FacsimileItem[]
}

export type Reconstruction = {
    staff: string
    voiceName:string
    reconstructionsForVoice: ReconstructionItem[]
}

/**
 * Properties of a music score
 */
export type ScoreProperties = {
    hasFicta: boolean,
    numVerses: number,
    numMeasures: number,
    composer: string,
    lyricist: string,
    editor: string,
    reconstructions: Reconstruction[],
    reconstructionBy: string | null,
    sections: {label: string, id: string}[],
    notes: string[],
    hasEditorial: boolean,
    hasOriginalClefs: boolean,
    encodedTransposition?: string
    tiedNotes: { first: string, second: string }[]
}

export type VisualizationOptions = {
    showOriginalClefs?: boolean | null
    showReconstructions?: { [staff:string] : string }
}