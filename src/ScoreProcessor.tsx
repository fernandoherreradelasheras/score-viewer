type FilterFunc = (doc: Document, params: any) => void

type Filters = [FilterFunc, any][];

const nsResolver = (prefix: string | null) => { return { mei: "http://www.music-encoding.org/ns/mei", xml: "http://www.w3.org/XML/1998/namespace" }[prefix || ''] || null }


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

const FilterToNVerses: FilterFunc = (doc: Document, params: {n: number}) => {
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
    const fictacAccidIter = doc?.evaluate('//mei:accid[@func="edit"]', doc, nsResolver, XPathResult.ANY_TYPE, null)
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

const EnsureElementIdFilter = (doc: Document, element: string, prefix: string) => {

    let matches = doc?.evaluate(`//mei:${element}[not(@xml:id)]`, doc, nsResolver, XPathResult.ANY_TYPE, null)
    if (matches == null) {
        return
    }
    const nodes = []
    let node
    while ((node = matches?.iterateNext() as Element) != null) {
        nodes.push(node)
    }
    nodes.forEach(n => {
        n.setAttribute("xml:id", `${prefix}-${Math.random().toString(36).substring(2, 15)}`)
    })
}


const EnsureMeasuresIdFilter: FilterFunc = (doc: Document, _: {}) => {
    EnsureElementIdFilter(doc, "measure", "m")
}

const EnsureSectionsIdFilter: FilterFunc = (doc: Document, _: {}) => {
    EnsureElementIdFilter(doc, "section", "s")
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
        this.filters.push([FilterToNVerses, { n: numVerses}])
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
