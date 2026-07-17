// Editorial-related types

export interface EditorialItem {
    id: string
    type: string
    reason?: string
    resp: string
    annotations: Set<Annotation>
    choice?: Choice
    correspIds?: string[]
}

export interface NoteContentDescription {
    kind: "note"
    pname: string
    accid: string
    oct: string
    dur: string
}

export interface RestContentDescription {
    kind: "rest"
    dur: string
}

export type ContentDescription = NoteContentDescription | RestContentDescription

export interface Option {
    type: string
    selector: string
    source: string | null
    contentDescription: ContentDescription[] | undefined
}

export interface Choice {
    id: string
    options: Option[]
}

export interface Annotation {
    id: string
    text: string
    targetIds: string[]
}

export interface CommentingElement {
    type: string
    id: string
    label: string
}
