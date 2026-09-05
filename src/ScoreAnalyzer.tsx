import { Annotation, Categories, Choice, ChoiceEditorialItem, ContentDescription, EDITORIAL_ALL_TAGS, EDITORIAL_SELECTION_TAGS, EDITORIAL_TRANSPARENT_TAGS, EditorialItem, GLOBAL_APP_TYPES, Option, ScoreProperties, SimpleEditorialItem, Sources } from "./types";



const MEI_NS = "http://www.music-encoding.org/ns/mei"

const nsResolver = (prefix: string | null) => { return { mei: MEI_NS, xml: "http://www.w3.org/XML/1998/namespace" }[prefix || ''] || null }


const EDITORIAL_SELF_TEST = EDITORIAL_ALL_TAGS.map(tag => `self::mei:${tag}`).join(" or ")


class ScoreAnalyzer {
    tonoNumber: number
    document: Document
    categories: Categories


    constructor(tonoNumber: number, score: string) {
        const parser = new DOMParser();
        this.document = parser.parseFromString(score, "application/xml")
        this.tonoNumber = tonoNumber
        this.categories = this.getCategories()
        this.collectCategoryApps()
    }


    soundingAccidental(note: Element): { accid: string, editorialAccid: boolean } {
        const carriers = [note, ...Array.from(note.children).filter(c => c.localName == "accid")];
        for (const name of ["accid.ges", "accid"]) {
            const carrier = carriers.find(c => c.getAttribute(name));
            if (carrier) {
                return { accid: carrier.getAttribute(name)!, editorialAccid: carrier.getAttribute("func") == "edit" };
            }
        }
        return { accid: "", editorialAccid: false };
    }

    describeNoteElement(element: Element): ContentDescription {
        return {
            kind: "note",
            pname: element.getAttribute("pname") || "",
            ...this.soundingAccidental(element),
            oct: element.getAttribute("oct") || "",
            dur: element.getAttribute("dur") || "",
        };
    }

    describeRestElement(element: Element): ContentDescription {
        return {
            kind: "rest",
            dur: element.getAttribute("dur") || "",
        };
    }

    maxVerseNum() {
        let matches = this.document.evaluate("//mei:verse/@n", this.document, nsResolver, XPathResult.ANY_TYPE, null)
        var max = 0
        let node
        while ((node = matches?.iterateNext())) {
            let value = parseInt(node.nodeValue || "0")
            if (value > max) {
                max = value
            }
        }
        return max
    }

    hasFictaElements() {
        const it = this.document.evaluate('//mei:accid[@func="edit"]', this.document, nsResolver, XPathResult.ANY_TYPE, null)
        return it.iterateNext() != null
    }

    hasOriginalClefs() {
        const res = this.document.evaluate('//mei:rdg[@type="app_clefs"]', this.document, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()
        return res != null
    }

    // Mirrors the reading that useScoreActions selects for the harmonic analysis
    // option, so the option can be skipped on scores that do not encode one.
    hasHarmonicAnalysis() {
        const res = this.document.evaluate(`//mei:rdg[contains(@type, "dissonant_analysis")]`, this.document, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()
        return res != null
    }

    // Whether the score carries anything score-viewer presents as an editorial
    // intervention: what the editorial layer highlights and lists. The global
    // apparatus is excluded along with everything inside it, because original clefs
    // and harmonic analysis are display options, not interventions by the editor.
    //
    // This is narrower than "does this MEI contain editorial elements" in verovio's
    // sense. That broader question mattered while repeat expansion was on the table,
    // since verovio refuses to expand a score containing any editorial element,
    // global apparatus included. If it is ever needed again it is a different query,
    // not this one.
    hasEditorialInterventions() {
        const globalApp = GLOBAL_APP_TYPES.map(type => `@type='${type}'`).join(" or ")
        const it = this.document.evaluate(`//*[(${EDITORIAL_SELF_TEST}) and not(ancestor-or-self::mei:app[${globalApp}])]`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        return it.iterateNext() != null
    }

    getNumMeasures() {
        let lastMeasureN = this.document.evaluate(`(//mei:measure)[last()]/@n`, this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.nodeValue
        return lastMeasureN ? parseInt(lastMeasureN) : 0
    }

    getEditor() {
        let name = this.document.evaluate("//mei:respStmt/mei:persName[@role=\"transcriber\"][1]", this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return name ? name : "<missing>"
    }

    getComposer() {
        let name = this.document.evaluate("//mei:composer/mei:persName[@role=\"composer\"][1]", this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return name || null
    }

    getLyricist() {
        let name = this.document.evaluate("//mei:lyricist/mei:persName[@role=\"lyricist\"][1]", this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return name || null
    }

    getReconstructionBy() {
        let name = this.document.evaluate("//mei:respStmt/mei:persName[@role=\"reconstruction\"][1]", this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return name ? name : null
    }

    getMeiNotes() {
        let matches = this.document.evaluate("//mei:meiHead//mei:extMeta//mei:pendingIssues", this.document, nsResolver, XPathResult.ANY_TYPE, null)
        const notes = []
        let node
        while ((node = matches?.iterateNext())) {
            if (node.textContent != null) {
                notes.push(node.textContent)
            }
        }
        return notes
    }

    getSections() {
        const sections = []
        let matches = this.document.evaluate(`//mei:section[@label]`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        var node = matches.iterateNext()
        while (node != null) {
            const section = node as Element
            sections.push({ label: section.getAttribute("label") || "", id: section.getAttribute("xml:id") || "" })
            node = matches.iterateNext()
        }
        return sections
    }

    getSources() {
        const sources: Sources = {};
        let matches = this.document.evaluate(`//mei:sourceDesc/mei:source`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        var node = matches.iterateNext()
        while (node != null) {
            const source = node as Element
            const id = source.getAttribute("xml:id")
            if (id) {
                let title: string | null = null;
                for (const child of source.childNodes) {
                    if (child instanceof Element && child.tagName === "bibl") {
                        for (const subChild of child.childNodes) {
                            if (subChild instanceof Element && subChild.tagName === "title") {
                                title = subChild.textContent || "";
                            }
                        }
                    }
                }
                sources[id] = { title: title || "" }
            }
            node = matches.iterateNext()
        }
        return sources
    }


    getCategories(): Categories {
        const categories: Categories = {}
        const matches = this.document.evaluate(`//mei:classDecls//mei:category[@xml:id]`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const category = node as Element
            const id = category.getAttribute("xml:id")!
            const child = (tag: string) => [...category.childNodes.values()]
                .find(c => c instanceof Element && c.tagName == tag)?.textContent?.trim() || null
            categories[id] = { label: child("label") || id, desc: child("desc"), apps: [] }
            node = matches.iterateNext()
        }
        return categories
    }


    // The @n of the nearest ancestor of the given tag. Walked rather than queried: the
    // same lookup by XPath would need the element as context node.
    ancestorNumber(element: Element, tag: string): string | null {
        for (let e: Element | null = element; e != null; e = e.parentElement) {
            if (e.tagName == tag) {
                return e.getAttribute("n")
            }
        }
        return null
    }

    // Where an intervention sits, for anything that has to place it for the reader.
    locationOf(element: Element): { measure: string | null, voice: string | null, partN: number | null } {
        const staff = this.ancestorNumber(element, "staff")
        return {
            measure: this.ancestorNumber(element, "measure"),
            voice: staff ? this.getVoiceName(staff) : null,
            partN: staff ? parseInt(staff) : null
        }
    }

    // Record every <app> under the category its readings classify with, so a dialog on
    // one of them can tell what else changes with it. An <app> counts only when all its
    // readings agree on the category, the same rule that names the decision as a whole
    // (see getItemCategory in Editorials); global apparatus <app>s are display options,
    // not editorial decisions, and stay out.
    collectCategoryApps() {
        const matches = this.document.evaluate(`//mei:app`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const app = node as Element
            const id = app.getAttribute("xml:id")
            const type = app.getAttribute("type")
            if (id && (type == null || !GLOBAL_APP_TYPES.includes(type))) {
                const ids = new Set([...app.childNodes.values()]
                    .filter(c => c.nodeType == Node.ELEMENT_NODE)
                    .map(c => this.optionCategoryId(c as Element)))
                const [categoryId] = [...ids]
                if (ids.size == 1 && categoryId && this.categories[categoryId]) {
                    this.categories[categoryId].apps.push(id)
                }
            }
            node = matches.iterateNext()
        }
    }


    getResponsibilities() {
        const responsibilities: Record<string, string> = {}
        let matches = this.document.evaluate(`//mei:respStmt/mei:persName[@xml:id]`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const person = node as Element
            const id = person.getAttribute("xml:id")
            if (id) {
                responsibilities[id] = person.textContent?.trim() || id
            }
            node = matches.iterateNext()
        }
        return responsibilities
    }

    getVoiceName(staff: string) {
        let voiceName = this.document.evaluate(`//mei:staffDef[@n="${staff}"]/mei:label`, this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return voiceName ? voiceName : null
    }


    getScoreProperties(): ScoreProperties {
        return {
            hasFicta: this.hasFictaElements(),
            numVerses: this.maxVerseNum(),
            numMeasures: this.getNumMeasures(),
            composer: this.getComposer(),
            lyricist: this.getLyricist(),
            editor: this.getEditor(),
            reconstructionBy: this.getReconstructionBy(),
            notes: this.getMeiNotes(),
            sections: this.getSections(),
            sources: this.getSources(),
            // The instance's own, not a fresh parse: this one has its <app> members.
            categories: this.categories,
            responsibilities: this.getResponsibilities(),
            hasEditorialInterventions: this.hasEditorialInterventions(),
            hasOriginalClefs: this.hasOriginalClefs(),
            hasHarmonicAnalysis: this.hasHarmonicAnalysis(),
            tiedNotes: this.getTiedNotes(),
            noteStaffMap: this.getNoteStaffMap(),
        }
    }

    getIdForMeasureN(n: string) {
        const res = this.document?.evaluate(`//mei:measure[@n="${n}"]/@xml:id`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        return res?.iterateNext()?.nodeValue
    }

    getEditorialNodesOfType = (editorialType: SimpleEditorialItem["type"]): SimpleEditorialItem[] => {
        const items: SimpleEditorialItem[] = []
        let matches = this.document.evaluate(`//mei:${editorialType}`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            if (node.parentElement?.tagName && !EDITORIAL_SELECTION_TAGS.includes(node.parentElement?.tagName)) {
                const element = node as Element
                const id = element.getAttribute("xml:id")
                const reason = element.getAttribute("reason")
                const resp = element.getAttribute("resp")
                const source = element.getAttribute("source")
                const childIds: string[] = []
                const descriptions: ContentDescription[] = []
                for (let child of [...node.childNodes?.values()].filter(n => n.nodeType == Node.ELEMENT_NODE)) {
                    const childElement = child as Element;
                    const childId = childElement.getAttribute("xml:id")
                    if (childId) {
                        childIds.push(childId)
                    }
                    if (childElement.tagName === "note") {
                        descriptions.push(this.describeNoteElement(childElement));
                    } else if (childElement.tagName === "rest") {
                        descriptions.push(this.describeRestElement(childElement));
                    }
                }

                items.push({
                    id: id!!,
                    reason: reason || "",
                    resp: resp || "",
                    source: source || "",
                    type: editorialType,
                    annotations: new Set(),
                    childIds: childIds,
                    contentDescription: descriptions,
                    ...this.locationOf(element)
                })
            }
            node = matches.iterateNext()
        }
        return items
    }

    getNoteOrRestDescription(el: Element): ContentDescription | null {
        if (el.tagName === "note") {
            return this.describeNoteElement(el);
        } else if (el.tagName === "rest") {
            return this.describeRestElement(el);
        } else {
            return null
        }
    }

    // The variant group a reading belongs to: the first @class pointer that resolves to
    // a <category> declared in <classDecls>. Other class tokens are left alone, they
    // classify the reading for something else.
    optionCategoryId(element: Element): string | null {
        const tokens = (element.getAttribute("class") || "").split(/\s+/).filter(Boolean)
        const id = tokens.map(t => t.replace(/^#/, "")).find(t => t in this.categories)
        return (id && !id.includes("'")) ? id : null
    }

    // Selecting an <app> reading by its variant group instead of by its id is what makes
    // several <app> elements one editorial decision: verovio applies the query to every
    // <app>, so a single query on the group flips all of them at once (a variant spanning
    // measures, or the same variant across voices). Only <app> works this way; <choice>
    // and <subst> readings are selected one by one.
    // When an <app> offers several readings of the same group, @n is what tells them
    // apart, and it pairs each one with its counterpart in the other <app> elements.
    appOptionSelector(app: Element, tag: string, categoryId: string | null, n: string | null): string | null {
        if (!categoryId) {
            return null
        }
        // @class is a list, hence the surrounding spaces: they keep '#var-c2' from matching
        // inside '#var-c2-3'.
        const inGroup = `contains(concat(' ',@class,' '),' #${categoryId} ')`
        const sameGroup = [...app.childNodes.values()]
            .filter(c => c.nodeType == Node.ELEMENT_NODE)
            .map(c => c as Element)
            .filter(e => e.tagName == tag && this.optionCategoryId(e) == categoryId)
        if (sameGroup.length == 1) {
            return `./${tag}[${inGroup}]`
        }
        if (!n || sameGroup.filter(e => e.getAttribute("n") == n).length != 1) {
            return null
        }
        return `./${tag}[${inGroup}][@n='${n}']`
    }

    choiceNodeToEditorialItem(node: Element, type: "app" | "choice" | "subst"): ChoiceEditorialItem {
        const choiceId = node.getAttribute("xml:id")
        const options: Option[] = []
        const choice: Choice = { id: choiceId!, options: options }

        for (let child of [...node.childNodes?.values()].filter(n => n.nodeType == Node.ELEMENT_NODE)) {
            const choiceElement = child as Element
            const nodeType = choiceElement.tagName
            const choiceId = choiceElement.getAttribute("xml:id") || null

            const label = choiceElement.getAttribute("label") || null
            const categoryId = this.optionCategoryId(choiceElement)
            const selector = (type == "app" && this.appOptionSelector(node, nodeType, categoryId, choiceElement.getAttribute("n")))
                || `./${nodeType}[@xml:id='${choiceId}']`
            const source = choiceElement.getAttribute("source")?.slice(1) || null
            const descriptions: ContentDescription[] = [];
            const description = this.getNoteOrRestDescription(choiceElement)
            if (description) {
                descriptions.push(description)
            } else {
                for (const choiceChild of [...choiceElement.childNodes?.values()].filter(n => n.nodeType == Node.ELEMENT_NODE)) {
                    const choiceChildElement = choiceChild as Element
                    const description = this.getNoteOrRestDescription(choiceChildElement)
                    if (description) {
                        descriptions.push(description)
                    }
                }
            }

            choice.options.push(
                {
                    id: choiceId,
                    type: nodeType,
                    label: label,
                    categoryId: categoryId,
                    selector: selector,
                    source: source,
                    contentDescription: descriptions.length > 0 ? descriptions : undefined
                })
        }
        return {
            id: choiceId!!, type: type, resp: "", reason: "", source: "",
            choice: choice, annotations: new Set(), ...this.locationOf(node)
        }
    }


    getChoiceNodes(): ChoiceEditorialItem[] {
        const items: ChoiceEditorialItem[] = []
        let matches = this.document.evaluate('//mei:choice', this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const element = node as Element
            const item = this.choiceNodeToEditorialItem(element, "choice")
            items.push(item)
            node = matches.iterateNext()
        }
        return items
    }

    getAppChoiceNodes(): ChoiceEditorialItem[] {
        const items: ChoiceEditorialItem[] = []
        let matches = this.document.evaluate(`//mei:app`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const element = node as Element
            const type = element.getAttribute("type")
            // app elements with global defined type are not considered editorial choices but
            // global choices and are handled on the options panel (original clefs and
            // harmonic analysis).
            if (type == null || !GLOBAL_APP_TYPES.includes(type)) {
                const item = this.choiceNodeToEditorialItem(element, "app")
                items.push(item)
            }

            node = matches.iterateNext()
        }
        return items
    }

    getSubstChoiceNodes(): ChoiceEditorialItem[] {
        const items: ChoiceEditorialItem[] = []
        let matches = this.document.evaluate('//mei:subst', this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const element = node as Element
            const item = this.choiceNodeToEditorialItem(element, "subst")
            items.push(item)
            node = matches.iterateNext()
        }
        return items
    }

    // Only annotations inside <score> are musical editorial annotations. Annotations
    // under <back> (e.g. <annot type="text-note">) belong to the poetic text and
    // are extracted separately (see poem-from-mei), so they are excluded here.
    getScoreAnnotations() {
        const annotations: Annotation[] = []
        let matches = this.document.evaluate(`//mei:score//mei:annot`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const element = node as Element
            const annotId = element.getAttribute("xml:id")
            const text = [...element.childNodes?.values()].filter(n => n.nodeType == Node.TEXT_NODE).map((n) => n.textContent).join("\n")
            const targetIds = element.getAttribute("plist")?.split(" ").map(ref => ref.replace("#", ""))
            annotations.push({ id: annotId!, text: text, targetIds: targetIds! })
            node = matches.iterateNext()
        }
        return annotations
    }

    getTiedNotes() {
        const tiedNotes: { first: string, second: string }[] = []
        let matches = this.document.evaluate(`//mei:tie`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const element = node as Element
            const startid = element.getAttribute("startid")
            const endid = element.getAttribute("endid")
            const first = startid?.startsWith("#") ? startid?.slice(1) : null
            const second = endid?.startsWith("#") ? endid?.slice(1) : null
            if (first && second) {
                tiedNotes.push({ first, second })
            }
            node = matches.iterateNext()
        }
        return tiedNotes
    }

    // Map of note/rest/chord xml:id -> its staff @n. Built from the full MEI (all
    // pages), so the player can resolve a note's staff without querying the SVG,
    // whose DOM only holds the currently rendered page.
    getNoteStaffMap() {
        const map: Record<string, string> = {}
        const staves = this.document.getElementsByTagNameNS(MEI_NS, "staff")
        for (let i = 0; i < staves.length; i++) {
            const n = staves[i].getAttribute("n") || ""
            for (const tag of ["note", "rest", "chord"]) {
                const els = staves[i].getElementsByTagNameNS(MEI_NS, tag)
                for (let j = 0; j < els.length; j++) {
                    const id = els[j].getAttribute("xml:id")
                    if (id) map[id] = n
                }
            }
        }
        return map
    }

    getAnnotationMatchIds(item: EditorialItem): string[] {
        if ("childIds" in item) {
            return [item.id, ...item.childIds]
        }
        return [item.id, ...item.choice.options.flatMap(o => o.id ? [o.id] : [])]
    }

    getEditorial(): EditorialItem[] {

        const editorialElements: EditorialItem[] = [
            ...EDITORIAL_TRANSPARENT_TAGS.flatMap(tag => this.getEditorialNodesOfType(tag as SimpleEditorialItem["type"])),
            ...this.getChoiceNodes(),
            ...this.getAppChoiceNodes(),
            ...this.getSubstChoiceNodes()
        ]

        // Attach each score annotation to the editorial item it targets.
        const annotations = this.getScoreAnnotations()
        editorialElements.forEach(item => {
            const matchIds = this.getAnnotationMatchIds(item)
            annotations.forEach(annot => {
                if (annot.targetIds?.some(target => matchIds.includes(target))) {
                    item.annotations.add(annot)
                }
            })
        })

        return editorialElements
    }

}




export default ScoreAnalyzer
