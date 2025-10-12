import { EditorialItem, Annotation, ReconstructionItem, ScoreProperties, Option, Sources } from "./types";
import i18next from './i18n'



const nsResolver = (prefix: string | null) => { return { mei: "http://www.music-encoding.org/ns/mei", xml: "http://www.w3.org/XML/1998/namespace" }[prefix || ''] || null }

const APP_GLOBAL_TYPES = ["app_clefs", "voice_reconstruction"]


const PITCH_NAMES: Record<string, { key: string; fallback: string }> = {
    a: { key: "music.pitch.a", fallback: "A" },
    b: { key: "music.pitch.b", fallback: "B" },
    c: { key: "music.pitch.c", fallback: "C" },
    d: { key: "music.pitch.d", fallback: "D" },
    e: { key: "music.pitch.e", fallback: "E" },
    f: { key: "music.pitch.f", fallback: "F" },
    g: { key: "music.pitch.g", fallback: "G" },
};

const ACCIDENTALS: Record<string, { key: string; fallback: string; symbol: string }> = {
    f: { key: "music.accidental.flat", fallback: "flat", symbol: "♭" },
    s: { key: "music.accidental.sharp", fallback: "sharp", symbol: "♯" },
    n: { key: "music.accidental.natural", fallback: "natural", symbol: "♮" },
    ff: { key: "music.accidental.doubleFlat", fallback: "double flat", symbol: "𝄫" },
    ss: { key: "music.accidental.doubleSharp", fallback: "double sharp", symbol: "𝄪" },
};

const MENSURAL_DURATIONS: Record<string, { key: string; fallback: string }> = {
    "1": { key: "music.mensural.semibrevis", fallback: "semibrevis" },
    "2": { key: "music.mensural.minima", fallback: "minima" },
    "4": { key: "music.mensural.semiminima", fallback: "semiminima" },
    "8": { key: "music.mensural.corchea", fallback: "corchea" },
};





class ScoreAnalyzer {
    document: Document
    tonoNumber: number
    t: any

    constructor(t: any, tonoNumber: number, score: string) {
        const parser = new DOMParser();
        this.document = parser.parseFromString(score, "application/xml")
        this.tonoNumber = tonoNumber
        this.t = t
    }


    describeMensuralDuration(dur?: string | null) {
        if (!dur) {
            return this.t("music.mensural.unknown", { duration: "", defaultValue: "unknown duration" });
        }
        const entry = MENSURAL_DURATIONS[dur];
        if (!entry) {
            return this.t("music.mensural.unknown", { duration: dur, defaultValue: `unknown duration (${dur})` });
        }
        return this.t(entry.key, { defaultValue: entry.fallback });
    };

    describeNoteElement(element: Element): string {
        const pname = element.getAttribute("pname")?.toLowerCase() || "";
        const pitchEntry = PITCH_NAMES[pname];
        const pitchName = pitchEntry
            ? this.t(pitchEntry.key, { defaultValue: pitchEntry.fallback })
            : this.t("music.pitch.unknown", { pitch: pname, defaultValue: pname.toUpperCase() || "Unknown pitch" });

        const accidCode = element.getAttribute("accid") || "";
        const accidentalEntry = accidCode ? ACCIDENTALS[accidCode] : undefined;
        const accidentalText = accidentalEntry
            ? this.t(accidentalEntry.key, { defaultValue: accidentalEntry.fallback })
            : "";

        const pitchWithAccidental = accidentalEntry
            ? this.t("music.pitch.withAccidental", {
                pitch: pitchName,
                accidental: accidentalText,
                symbol: accidentalEntry.symbol,
                defaultValue: `${pitchName} ${accidentalText}`,
            })
            : pitchName;

        const durationText = this.describeMensuralDuration(element.getAttribute("dur"));

        return this.t("music.note.description", {
            pitch: pitchWithAccidental,
            duration: durationText,
            defaultValue: `${pitchWithAccidental}, ${durationText}`,
        });
    }

    describeRestElement(element: Element): string {
        const durationText = this.describeMensuralDuration(element.getAttribute("dur"));

        return this.t("music.rest.description", {
            duration: durationText,
            defaultValue: `${durationText} rest`,
        });
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
        return name || i18next.t("anonymous")
    }

    getLyricist() {
        let name = this.document.evaluate("//mei:lyricist/mei:persName[@role=\"lyricist\"][1]", this.document, nsResolver, XPathResult.ANY_TYPE, null)?.iterateNext()?.textContent
        return name || i18next.t("anonymous")
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


    getReconstructions() {
        const reconstructions: { staff: string, voiceName: string, reconstructionsForVoice: ReconstructionItem[] }[] = []
        let matches = this.document.evaluate(`//mei:app[@type="voice_reconstruction"]/mei:rdg`, this.document, nsResolver, XPathResult.ANY_TYPE, null)
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
                reconstructions.push({ staff: staff, voiceName: voiceName, reconstructionsForVoice: reconstructionsForVoice })
            }

            if (reconstructionsForVoice.find(r => r.label == label)) {
                node = matches.iterateNext()
                continue
            }

            const reconstructionItem: ReconstructionItem = { label: label, voice: voiceName, reconstructionBy: "" }
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
            composer: this.getComposer(),
            lyricist: this.getLyricist(),
            editor: this.getEditor(),
            reconstructionBy: this.getReconstructionBy(),
            reconstructions: this.getReconstructions(),
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
            let contentDescription = ""
            for (const child of choiceElement.childNodes) {
                if (child instanceof Element && child.tagName === "note") {
                    contentDescription += " " + this.describeNoteElement(child);
                } else if (child instanceof Element && child.tagName === "rest") {
                    contentDescription += " " + this.describeRestElement(child);
                }

            }
            choice.options.push(
                {
                    type: nodeType,
                    selector: `./${nodeType}[@label='${optionLabel}']`,
                    source: optionSource ? optionSource.slice(1) : null,
                    contentDescription: contentDescription !== "" ? contentDescription : undefined
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

    getAnnotations() {
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
