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

export interface Option {
    type: string
    selector: string
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