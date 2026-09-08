// Editorial-related types


// <gap> and <handShift> are not yet supported by verovio.
export const EDITORIAL_TRANSPARENT_TAGS = ["abbr", "add", "annot", "corr", "damage", "del", "expan", "orig", "ref", "reg", "restore", "sic", "supplied", "unclear"]
export const EDITORIAL_SELECTION_TAGS = ["app", "choice", "subst"]
export const EDITORIAL_APP_CHILD_TAGS = ["lem", "rdg"]
// nested choice elements are allowed in MEI but we don't support them.
export const CHOICE_ALLOWED_CHILD_TAGS = ["abbr", "corr", "expan", "orig", "reg", "sic", "subst", "unclear"]
export const SUBST_ALLOWED_CHILD_TAGS = ["add", "corr", "damage", "del", "orig", "reg", "restore", "sic", "supplied", "unclear"]

export const EDITORIAL_ALL_TAGS = [...new Set([
    ...EDITORIAL_SELECTION_TAGS, ...EDITORIAL_APP_CHILD_TAGS, ...EDITORIAL_TRANSPARENT_TAGS
])]

// An <annot> may point at plain notes, which verovio draws as ordinary music: nothing
// there for the reader to hover or click. The score processor wraps each such target in
// an editorial element carrying this @type, and the type is what keeps the wrapper from
// being read as what its tag says: it is an annotation, not a regularization. Verovio
// copies @type into the SVG class list, so it also names the wrapper in the rendered score.
export const ANNOTATION_TARGET_WRAPPER = "reg"
export const ANNOTATION_TARGET_TYPE = "annotation-target"

// <app> types handled as global options (the options panel) rather than as editorial
// choices. Kept in sync with GLOBAL_APP_READINGS in useScoreActions.
export const GLOBAL_APP_TYPES = ["app_clefs", "dissonant_analysis"]


export interface NoteContentDescription {
    kind: "note"
    pname: string
    accid: string
    editorialAccid: boolean
    oct: string
    dur: string
}

export interface RestContentDescription {
    kind: "rest"
    dur: string
}

export type ContentDescription = NoteContentDescription | RestContentDescription



interface BaseEditorialItem {
    id: string
    reason?: string
    resp: string
    source: string
    annotations: Set<Annotation>
    correspIds?: string[]
    measure: string | null
    voice: string | null
    partN: number | null
}


export interface ChoiceEditorialItem extends BaseEditorialItem {
    type: "app" | "choice" | "subst"
    choice: Choice
}

export interface SimpleEditorialItem extends BaseEditorialItem {
    type: "abbr" | "add" | "annot" | "corr" | "damage" | "del" | "expan" | "orig" | "ref" | "reg" | "restore" | "sic" | "supplied" | "unclear"
    childIds: string[]
    contentDescription: ContentDescription[]
}

export type EditorialItem = ChoiceEditorialItem | SimpleEditorialItem



export interface Option {
    id: string | null
    type: string
    label: string | null
    categoryId: string | null
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
