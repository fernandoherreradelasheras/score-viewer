import { EditorialItem, Annotation, ScoreProperties, Option, Sources, ContentDescription } from "./types";



const nsResolver = (prefix: string | null) => { return { mei: "http://www.music-encoding.org/ns/mei", xml: "http://www.w3.org/XML/1998/namespace" }[prefix || ''] || null }

const APP_GLOBAL_TYPES = ["app_clefs", "voice_reconstruction"]



class ScoreAnalyzer {
    tonoNumber: number
    document: Document


    constructor(tonoNumber: number, score: string) {
        const parser = new DOMParser();
        this.document = parser.parseFromString(score, "application/xml")
        this.tonoNumber = tonoNumber
    }


    describeNoteElement(element: Element): ContentDescription {
        return {
            kind: "note",
            pname: element.getAttribute("pname") || "",
            accid: element.getAttribute("accid") || "",
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
        const res = this.document.evaluate('//mei:rdg[@label="app_clefs"]', this.document, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()
        return res != null
    }

    hasEditorialElements() {
        const annots = this.document.evaluate('count(//mei:annot)', this.document, nsResolver, XPathResult.ANY_TYPE, null)?.numberValue
        const variants = this.document.evaluate('count(//mei:app[@type="variant"])', this.document, nsResolver, XPathResult.ANY_TYPE, null)?.numberValue
        return (annots != null && annots > 0) || (variants != null && variants > 0)
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
            hasEditorial: this.hasEditorialElements(),
            hasOriginalClefs: this.hasOriginalClefs(),
            tiedNotes: this.getTiedNotes(),
        }
    }

    getIdForMeasureN(n: string) {
        const res = this.document?.evaluate(`//mei:measure[@n="${n}"]/@xml:id`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        return res?.iterateNext()?.nodeValue
    }

    getFirstMeasureId() {
        return this.document.evaluate(`(//mei:measure)[1]/@xml:id`, this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.nodeValue || null
    }

    getEditorialNodesOfType = (type: string) => {
        const items: EditorialItem[] = []
        let matches = this.document.evaluate(`//mei:${type}`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            if (node.parentElement?.tagName != "choice" && node.parentElement?.tagName != "app") {
                const element = node as Element
                const id = element.getAttribute("xml:id")
                const reason = element.getAttribute("reason")
                const resp = element.getAttribute("resp")
                items.push({
                    id: id!!,
                    reason: reason || "",
                    resp: resp || "",
                    type: type,
                    annotations: new Set()
                })
            }
            node = matches.iterateNext()
        }
        return items
    }

    choiceNodeToEditorialItem(node: Element, type: string): EditorialItem {
        const choiceId = node.getAttribute("xml:id")
        const options: Option[] = []
        const choice = { id: choiceId!!, options: options }

        for (let child of [...node.childNodes?.values()].filter(n => n.nodeType == Node.ELEMENT_NODE)) {
            const choiceElement = child as Element
            const optionLabel = choiceElement.getAttribute("label")
            const optionSource = choiceElement.getAttribute("source")
            const nodeType = choiceElement.tagName
            const descriptions: ContentDescription[] = [];
            for (const child of choiceElement.childNodes) {
                if (child instanceof Element && child.tagName === "note") {
                    descriptions.push(this.describeNoteElement(child));
                } else if (child instanceof Element && child.tagName === "rest") {
                    descriptions.push(this.describeRestElement(child));
                }
            }

            choice.options.push(
                {
                    type: nodeType,
                    selector: `./${nodeType}[@label='${optionLabel}']`,
                    source: optionSource ? optionSource.slice(1) : null,
                    contentDescription: descriptions.length > 0 ? descriptions : undefined
                })
        }
        return { id: choiceId!!, type: type, resp: "", reason: "", choice: choice, annotations: new Set() }
    }


    getChoiceNodes() {
        const items: EditorialItem[] = []
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

    getAppChoiceNodes() {
        const items: EditorialItem[] = []
        let matches = this.document.evaluate(`//mei:app`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const element = node as Element
            // app elements with global defined type are not considered editorial choices but
            // global choices and are handles on the options panel (e.g. voice reconstruction, original clefs, etc...)
            // app element with no type are also ignored (harm analysis, etc...)
            const type = element.getAttribute("type")
            if (type != null && !APP_GLOBAL_TYPES.includes(type)) {
                const item = this.choiceNodeToEditorialItem(element, "app")
                items.push(item)
            }
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



    getEditorial(): EditorialItem[] {
        const editorialElements: EditorialItem[] =
            this.getEditorialNodesOfType("unclear")
                .concat(this.getEditorialNodesOfType("sic"))
                .concat(this.getEditorialNodesOfType("corr"))
                .concat(this.getEditorialNodesOfType("supplied"))
                .concat(this.getEditorialNodesOfType("reg"))
                .concat(this.getChoiceNodes())
                .concat(this.getAppChoiceNodes())

        const annotations = this.getScoreAnnotations()
        const consumedAnnotationsTargets = new Set()

        editorialElements.forEach(e => {
            const annot = annotations.find(a => a.targetIds.includes(e.id))
            if (annot) {
                e.annotations.add(annot)
                consumedAnnotationsTargets.add(e.id)
            }
        })

        // Create EditorialElements for those ids that were target of an annotation but are not covered by
        // any other EditorialElement
        annotations.forEach(annot => {
            const unusedIds = annot.targetIds?.filter(id => !consumedAnnotationsTargets.has(id))

            if (unusedIds && unusedIds.length > 0) {
                const elementsForAnnotation = editorialElements.filter(e => e.annotations.has(annot))
                if (elementsForAnnotation.length == 1) {
                    // Append the ids referenced by the annotation as @corres
                    elementsForAnnotation[0].correspIds = [...unusedIds]
                } else {
                    console.log(`Cannot add the targetIds ${unusedIds}`)
                }
            }
        })

        return editorialElements
    }

}




export default ScoreAnalyzer
