// Score-related types
import { EditorialItem } from './editorial';

export type FacsimileItem = {
    name: string
    url: string
}

export type Score = {
    url: string
    title: string
    originalMei: string
    singleVerseMei: string
    properties: ScoreProperties
    editorialItems: EditorialItem[]
    text?: string
    fascimileItems?: FacsimileItem[]
}

/**
 * Properties of a music score
 */
export type ScoreProperties = {
    hasFicta: boolean,
    numVerses: number,
    numMeasures: number,
    editor: string,
    reconstructionBy: string | null,
    sections: {label: string, id: string}[],
    notes: string[],
    hasEditorial: boolean,
    encodedTransposition?: string
}