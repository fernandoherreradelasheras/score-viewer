import { ParallelIntervalViolation, Note as MeasureElement } from "./types";


const interval = (pitch1: number, pitch2: number): number => {
    const pitchInterval = Math.abs(pitch1 - pitch2) % 12;
    return pitchInterval
}

const isPerfectFifth = (pitch1: number, pitch2: number): boolean => {
    const pitchInterval = interval(pitch1, pitch2);
    return pitchInterval=== 7;
}

const isOctave = (pitch1: number, pitch2: number): boolean => {
    const pitchInterval = interval(pitch1, pitch2);
    return pitchInterval === 12 || pitchInterval === 0;
}

const nsResolver = (prefix: string | null) => { return { mei: "http://www.music-encoding.org/ns/mei", xml: "http://www.w3.org/XML/1998/namespace" }[prefix || ''] || null }


class PararellChecker {
    mei: Document;
    offsets: number[];
    staves: { n: string; label: string, elements: { [offset: string] : MeasureElement | undefined}} [];

    constructor(measureElements: { [offset: string] : MeasureElement[] }, score: string) {
        console.log(measureElements)
        this.offsets = Object.keys(measureElements).map(offset => parseInt(offset)).sort((a, b) => a - b);
        console.log(this.offsets)

        const parser = new DOMParser();
        this.mei = parser.parseFromString(score, "application/xml")

        const staffDefs = this.getStaffDefinitions()
        this.staves = staffDefs.map((staffDef) => {
            return {
                n: staffDef.n,
                label: staffDef.label,
                elements: Object.fromEntries(Object.entries(measureElements)
                    .map(([offset, elements]) => [offset, elements.find(element => this.getStaffForElement(element.id) === staffDef.n)])
                )
            }
        })
        console.log(this.staves)
    }


    private getStaffDefinitions(): { n: string; label: string }[] {
        const staffDefs: { n: string; label: string }[] = [];

        const xpath = '(//mei:scoreDef)[1]//mei:staffDef[@n]';
        const staffDefsResult = this.mei.evaluate(xpath, this.mei, nsResolver, XPathResult.ANY_TYPE, null);
        let staffDefElement = staffDefsResult.iterateNext();
        while (staffDefElement) {
            const element = staffDefElement as Element;
            const n = element.getAttribute('n');
            const labelElement = element.querySelector('mei\\:label, label');
            const label = labelElement?.textContent || `Part ${n}`;

            if (n) {
                staffDefs.push({ n, label });
            }

            staffDefElement = staffDefsResult.iterateNext();
        }

        return staffDefs
    }

    private getStaffForElement(id: string): string | null {
        const xpath = `//mei:*[@xml:id="${id}"]/ancestor::mei:staff/@n`;
        const res = this.mei.evaluate(xpath, this.mei, nsResolver, XPathResult.ANY_TYPE, null)
        return res.iterateNext()?.nodeValue || null;
    }

    private getMeasureForElement(id: string): string | null {
        const xpath = `//mei:*[@xml:id="${id}"]/ancestor::mei:measure/@n`;
        const res = this.mei.evaluate(xpath, this.mei, nsResolver, XPathResult.ANY_TYPE, null)
        return res.iterateNext()?.nodeValue || null;
    }


    /**
     * Find parallel intervals of a specific type between staff pairs
     */
    private findParallelIntervals(intervalCheckFn: (p1: number, p2: number) => boolean): ParallelIntervalViolation[] {

        const violations: ParallelIntervalViolation[] = [];


        for (let i = 0; i < this.offsets.length - 1; i++) {
            const offset_t1 = this.offsets[i];
            const offset_t2 = this.offsets[i+1];

            for (let j = 0; j < this.staves.length; j++) {
                for (let k = j + 1; k < this.staves.length; k++) {
                    const note1_t1 = this.staves[j].elements[offset_t1]
                    const note2_t1 = this.staves[k].elements[offset_t1]
                    const note1_t2 = this.staves[j].elements[offset_t2]
                    const note2_t2 = this.staves[k].elements[offset_t2]
                    if (!note1_t1 || !note2_t1 || !note1_t2 || !note2_t2) {
                        continue; // Skip if any note is missing
                    }

                    const motion1 = note1_t2.pitch - note1_t1.pitch
                    const motion2 = note2_t2.pitch - note2_t1.pitch
                    if (motion1 == 0 || motion2 == 0 || motion1 != motion2) {
                        continue
                    }
                    if (!intervalCheckFn(note1_t1.pitch, note2_t1.pitch) || !intervalCheckFn(note1_t2.pitch, note2_t2.pitch)) {
                        continue
                    }

                    const part1 = this.staves[j].label
                    const part2 = this.staves[k].label
                    const intervalType: "fifth" | "octave" = (intervalCheckFn === isPerfectFifth) ? 'fifth' : 'octave'
                    // We allow parallel octaves between Tenor and Guion
                    if (part1 == "Tenor" && part2.normalize() == "Guión" && intervalType === 'octave') {
                        continue
                    }

                    const measure1 = this.getMeasureForElement(note1_t1.id) || "?";
                    const measure2 = this.getMeasureForElement(note2_t1.id) || "?";
                    const violation = {
                        partNames: [part1, part2],
                        measureNumbers: [measure1, measure2],
                        offsets: [offset_t1, offset_t2],
                        notes: {
                            first: [note1_t1, note2_t1],
                            second: [note1_t2, note2_t2]
                        },
                        intervalType: intervalType
                    }
                    console.log(violation)
                    violations.push(violation);
                }
            }
        }

        return violations
    }


    analyzeParallelIntervals(): ParallelIntervalViolation[] {
        const fifthViolations = this.findParallelIntervals(isPerfectFifth);
        const octaveViolations = this.findParallelIntervals(isOctave);

        return [...fifthViolations, ...octaveViolations];

    }

}




export default PararellChecker
