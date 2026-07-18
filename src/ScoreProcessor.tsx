import { EDITORIAL_ALL_TAGS } from "./types/editorial";

type FilterFunc = (doc: Document, params: any) => void

type Filters = [FilterFunc, any][];

const XPATH_FICTA_ACCIDS = '//mei:accid[@func="edit"]'

const MEI_NS = "http://www.music-encoding.org/ns/mei"

const nsResolver = (prefix: string | null) => { return { mei: MEI_NS, xml: "http://www.w3.org/XML/1998/namespace" }[prefix || ''] || null }

// Editorial element used to wrap an annotation target that is not already
// editorial.
const ANNOTATION_TARGET_WRAPPER = "reg"

// Elements it is valid and meaningful to wrap in an editorial element (layer-level
// events). Non-musical annotation targets are left untouched.
const WRAPPABLE_TARGET_TAGS = new Set(["note", "rest", "chord", "mRest", "multiRest", "space"])


const AddSectionTitlesFilter: FilterFunc = (doc: Document, _: {}) => {
    let matches = doc?.evaluate(`//mei:section[@label]/@label`, doc, nsResolver, XPathResult.ANY_TYPE, null)
    let node;
    const labels = []
    while ((node = matches?.iterateNext())) {
        if (node.nodeValue != null && node.nodeValue.indexOf("_heading") < 0) {
            labels.push(node.nodeValue)
        }
    }

    // Only write titles if we have more than one section
    if (labels.length <= 1) {
        return
    }
    labels.forEach(label => {
        let measure = doc?.evaluate(`//mei:section[@label="${label}"]/mei:measure[1]`, doc, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()
        if (measure == null) {
            return
        }
        const title = (label.charAt(0).toUpperCase() + label.slice(1)).replace(/_/g, " ")
        const dir = doc.createElement("dir")
        dir.setAttribute("place", "above")
        dir.setAttribute("staff", "1")
        dir.setAttribute("tstamp", "0")
        measure?.insertBefore(dir, measure.firstChild)
        const rend = doc.createElement("rend")
        rend.setAttribute("fontstyle", "normal")
        rend.setAttribute("fontweight", "bold")
        dir.appendChild(rend)
        const text = doc.createTextNode(title)
        rend.appendChild(text)
    })
}


const FilterToNVerses: FilterFunc = (doc: Document, params: { n: number }) => {
    const numVerses = params.n
    let matches = doc?.evaluate(`//mei:verse[@n > "${numVerses}"]`, doc, nsResolver, XPathResult.ANY_TYPE, null)
    if (matches == null) {
        return
    }
    const nodes = []
    var node = matches.iterateNext()
    while (node != null) {
        nodes.push(node)
        node = matches.iterateNext()
    }
    nodes.forEach(n => n.parentElement?.removeChild(n))
}


const FilterNormalizeFicta: FilterFunc = (doc: Document, _: {}) => {
    const fictacAccidIter = doc?.evaluate(XPATH_FICTA_ACCIDS, doc, nsResolver, XPathResult.ANY_TYPE, null)
    if (fictacAccidIter == null) {
        return
    }

    const nodes = []
    var node = fictacAccidIter.iterateNext()
    while (node != null) {
        nodes.push(node as Element)
        node = fictacAccidIter.iterateNext()
    }

    nodes.forEach(n => {
        n.removeAttribute("func")
        n.removeAttribute("enclose")
    })

}

const FilterRemoveBracketSpan: FilterFunc = (doc: Document, _: {}) => {
    let matches = doc?.evaluate(`//mei:bracketSpan[@func="coloration"]`, doc, nsResolver, XPathResult.ANY_TYPE, null)
    if (matches == null) {
        return
    }
    const nodes = []
    var node = matches.iterateNext()
    while (node != null) {
        nodes.push(node)
        node = matches.iterateNext()
    }
    nodes.forEach(n => n.parentElement?.removeChild(n))
}
const EnsureElementIdFilter = (doc: Document, element: string, prefix: string) => {
    EnsureQueryIdFilter(doc, `//mei:${element}[not(@xml:id)]`, prefix)
}

const EnsureQueryIdFilter = (doc: Document, query: string, prefix: string) => {
    let matches = doc?.evaluate(query, doc, nsResolver, XPathResult.ANY_TYPE, null)
    if (matches == null) {
        return
    }
    const nodes = []
    let node
    while ((node = matches?.iterateNext() as Element) != null) {
        nodes.push(node)
    }
    nodes.forEach(n => {
        const id = `${prefix}-${Math.random().toString(36).substring(2, 15)}`
        n.setAttribute("xml:id", id)
    })
}


const EnsureMeasuresIdFilter: FilterFunc = (doc: Document, _: {}) => {
    EnsureElementIdFilter(doc, "measure", "m")
}

const EnsureSectionsIdFilter: FilterFunc = (doc: Document, _: {}) => {
    EnsureElementIdFilter(doc, "section", "s")
}


const EnsureNotesRestsIdFilter: FilterFunc = (doc: Document, _: {}) => {
    EnsureElementIdFilter(doc, "note", "n")
    EnsureElementIdFilter(doc, "rest", "r")
}


const WrapAnnotationTargetsFilter: FilterFunc = (doc: Document, _: {}) => {
    const editorialTags = new Set(EDITORIAL_ALL_TAGS)

    const targetIds = new Set<string>()
    const plists = doc.evaluate(`//mei:score//mei:annot/@plist`, doc, nsResolver, XPathResult.ANY_TYPE, null)
    let attr
    while ((attr = plists?.iterateNext()) != null) {
        (attr.nodeValue || "").split(/\s+/).filter(Boolean).forEach(ref => targetIds.add(ref.replace(/^#/, "")))
    }
    if (targetIds.size === 0) return


    const toWrap: Element[] = []
    targetIds.forEach(id => {
        const el = doc.evaluate(`//*[@xml:id='${id}']`, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() as Element | null
        if (!el || !WRAPPABLE_TARGET_TAGS.has(el.localName)) return
        for (let a: Element | null = el; a != null; a = a.parentElement) {
            if (editorialTags.has(a.localName)) return
        }
        toWrap.push(el)
    })

    toWrap.forEach(el => {
        const wrapper = doc.createElementNS(MEI_NS, ANNOTATION_TARGET_WRAPPER)
        wrapper.setAttribute("xml:id", `${ANNOTATION_TARGET_WRAPPER}-${el.getAttribute("xml:id")}`)
        el.parentNode?.insertBefore(wrapper, el)
        wrapper.appendChild(el)
    })
}

const EnsureEditorialElementsWithoutIdFilter: FilterFunc = (doc: Document, _: {}) => {
    EDITORIAL_ALL_TAGS.forEach(tag => {
        EnsureElementIdFilter(doc, tag, tag.substring(0, 1))
        EnsureQueryIdFilter(doc, `//mei:${tag}/*[not(@xml:id)]`, `${tag.substring(0, 1)}_opt`)
    })
}

class ScoreProcessor {
    score: string
    filters: Filters

    constructor(score: string) {
        this.score = score
        this.filters = []
    }

    addTitlesFilter() {
        this.filters.push([AddSectionTitlesFilter, {}])
    }
    addNVersesFilter(numVerses: number) {
        this.filters.push([FilterToNVerses, { n: numVerses }])
    }
    addNormalizeFictaFilter() {
        this.filters.push([FilterNormalizeFicta, {}])
    }
    addEnsureMeasuresIdFilter() {
        this.filters.push([EnsureMeasuresIdFilter, {}])
    }
    addEnsureSectionsIdFilter() {
        this.filters.push([EnsureSectionsIdFilter, {}])
    }
    addEnsureNotesRestsIdFilter() {
        this.filters.push([EnsureNotesRestsIdFilter, {}])
    }
    addEnsureEditorialElementsWithoutIdFilter() {
        this.filters.push([EnsureEditorialElementsWithoutIdFilter, {}])
    }
    addWrapAnnotationTargetsFilter() {
        this.filters.push([WrapAnnotationTargetsFilter, {}])
    }
    addRemoveBracketSpanFilter() {
        this.filters.push([FilterRemoveBracketSpan, {}])
    }

    filterScore(): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.score, "application/xml")

        this.filters.forEach(([func, params]) => {
            func(doc, params)
        })

        const s = new XMLSerializer()
        return s.serializeToString(doc)
    }

}

export default ScoreProcessor
