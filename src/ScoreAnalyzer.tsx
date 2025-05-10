import { EditorialItem, Annotation, ReconstructionItem, ScoreProperties } from "./types";



const nsResolver = (prefix: string | null) => { return { mei: "http://www.music-encoding.org/ns/mei", xml: "http://www.w3.org/XML/1998/namespace" }[prefix || ''] || null }


export interface Option {
    type: string
    selector: string
}

class ScoreAnalyzer {
    document: Document
    tonoNumber: number

    constructor(tonoNumber: number, score: string) {
        const parser = new DOMParser();
        this.document = parser.parseFromString(score, "application/xml")
        this.tonoNumber = tonoNumber
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
        console.log(res)
        return res != null
    }

    hasEditorialElements() {
        const it = this.document.evaluate('count(//mei:annot)', this.document, nsResolver, XPathResult.ANY_TYPE, null)?.numberValue
        return it != null && it > 0
    }

    getNumMeasures() {
        let lastMeasureN = this.document.evaluate(`(//mei:measure)[last()]/@n`, this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.nodeValue
        return lastMeasureN ? parseInt(lastMeasureN) : 0
    }

    getEditor() {
        let name = this.document.evaluate("//mei:respStmt/mei:persName[@role=\"transcriber\"][1]", this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return name ? name : "<missing>"
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

    getVoiceName(staff: string) {
        let voiceName = this.document.evaluate(`//mei:staffDef[@n="${staff}"]/mei:label`, this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return voiceName ? voiceName : null
    }


    getReconstructions() {
        const reconstructions : { staff: string, voiceName: string, reconstructionsForVoice : ReconstructionItem[] }[] = []
        let matches = this.document.evaluate(`//mei:app[@type="voice_reconstruction"]/mei:rdg`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        console.log(matches)
        var node = matches.iterateNext()
        while (node != null) {
            const reconstruction = node as Element
            const label = reconstruction.getAttribute("label")
            const staff = reconstruction.parentElement?.parentElement?.tagName == "staff" ? reconstruction.parentElement.parentElement.getAttribute("n") : null
            if (!label || !staff) {
                node = matches.iterateNext()
                continue
            }
            const voiceName = this.getVoiceName(staff)
            if (!voiceName) {
                node = matches.iterateNext()
                continue
            }

            var reconstructionsForVoice = reconstructions.find(r => r.voiceName == voiceName)?.reconstructionsForVoice
            if (!reconstructionsForVoice) {
                reconstructionsForVoice = []
                reconstructions.push({staff: staff, voiceName: voiceName, reconstructionsForVoice: reconstructionsForVoice})
            }

            if (reconstructionsForVoice.find(r => r.label == label)) {
                node = matches.iterateNext()
                continue
            }

            const reconstructionItem : ReconstructionItem = { label: label, voice: voiceName, reconstructionBy: "" }
            reconstructionsForVoice.push(reconstructionItem)
            node = matches.iterateNext()
        }

        return reconstructions.length > 0 ? reconstructions.map(r => {
            return {
                staff: r.staff,
                voiceName: r.voiceName,
                reconstructionsForVoice:
                    [...r.reconstructionsForVoice,
                    { label: "none", voice: r.voiceName, reconstructionBy: "" }],

            }
        }) : []
    }


    getScoreProperties(): ScoreProperties {
        return {
            hasFicta: this.hasFictaElements(),
            numVerses: this.maxVerseNum(),
            numMeasures: this.getNumMeasures(),
            editor: this.getEditor(),
            reconstructionBy: this.getReconstructionBy(),
            reconstructions: this.getReconstructions(),
            notes: this.getMeiNotes(),
            sections: this.getSections(),
            hasEditorial: this.hasEditorialElements(),
            hasOriginalClefs: this.hasOriginalClefs(),
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

    choiceNodeToEditorialItem (node: Element, type: string) : EditorialItem {
        const choiceId = node.getAttribute("xml:id")
        const options: Option[] = []
        const choice = { id: choiceId!!, options: options }

        for (let child of [...node.childNodes?.values()].filter(n => n.nodeType == Node.ELEMENT_NODE)) {
            const choiceElement = child as Element
            const optionLabel = choiceElement.getAttribute("label")
            const nodeType = choiceElement.tagName
            choice.options.push({ type: nodeType, selector: `./${nodeType}[@label='${optionLabel}']` })
        }

        return { id: choiceId!!, type: type, resp: "", reason: "", choice: choice, annotations: new Set() }
    }


    getChoiceNodes ()  {
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

    getAppChoiceNodes ()  {
        const items: EditorialItem[] = []
        let matches = this.document.evaluate(`//mei:app`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
        let node = matches.iterateNext()
        while (node != null) {
            const element = node as Element
            // app elements with defined type are not considered editorial choices but
            // global choices and are handles on the options panel (e.g. voice reconstruction, original clefs, etc...)
            if (element.getAttribute("type") == null) {
                const item = this.choiceNodeToEditorialItem(element, "app")
                items.push(item)
            }
            node = matches.iterateNext()
        }
        return items
    }

    getAnnotations()  {
        const annotations: Annotation[] = []
        let matches = this.document.evaluate(`//mei:annot`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
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


    getEditorial() : EditorialItem[] {
        const editorialElements: EditorialItem[] =
            this.getEditorialNodesOfType("unclear")
                .concat(this.getEditorialNodesOfType("sic"))
                .concat(this.getEditorialNodesOfType("corr"))
                .concat(this.getEditorialNodesOfType("supplied"))
                .concat(this.getEditorialNodesOfType("reg"))
                .concat(this.getChoiceNodes())
                .concat(this.getAppChoiceNodes())

        const annotations = this.getAnnotations()
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
            const unusedIds = annot.targetIds.filter(id => !consumedAnnotationsTargets.has(id))

            if (unusedIds.length > 0) {
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
