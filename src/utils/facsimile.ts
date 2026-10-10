import { FacsimileItem, FacsimileSurface, FacsimileZone } from "../types";

/**
 * The <surface> an image of the config shows, found by its <graphic>@target. The config
 * may reach the image through a longer path than the MEI does, so either one may only
 * be a trailing part of the other. The surface @label, against the image name, is the
 * fallback. -1 when neither matches.
 */
export const matchFacsimileSurface = (item: FacsimileItem, surfaces: FacsimileSurface[]) => {
    const byTarget = surfaces.findIndex(({ target }) => target != "" &&
        (item.file == target || item.file.endsWith("/" + target) || target.endsWith("/" + item.file)));
    return byTarget != -1 ? byTarget : surfaces.findIndex(({ label }) => label != "" && label == item.name);
};

/**
 * The columns and rows that show `count` images, laid out fitting the width of their
 * cells, the largest: the arrangement where a whole image, `aspectRatio` wide for each
 * unit of height, gets the most width while still fitting the height of its cell.
 * `cellChrome` is the height each cell takes beside its image.
 */
export const bestFacsimileGrid = (count: number, width: number, height: number, aspectRatio: number, cellChrome: number) => {
    let best = { columns: 1, rows: Math.max(1, count), imageWidth: -1 };
    for (let columns = 1; columns <= count; columns++) {
        const rows = Math.ceil(count / columns);
        const imageWidth = Math.min(width / columns, Math.max(0, height / rows - cellChrome) * aspectRatio);
        if (imageWidth > best.imageWidth) {
            best = { columns, rows, imageWidth };
        }
    }
    return { columns: best.columns, rows: best.rows };
};

// A line of the manuscript ends where the music goes back to the left further than the
// voices sounding together may be out of line with each other, or where a part lands
// this far above or below, as fractions of the page width.
const LINE_JUMP = 0.15;
const ALIGNMENT = 0.05;

export type FacsimilePathPoint = { id: string, onsetMs: number, x: number, y: number, line: number };

// The closest sequence that never decreases (pool adjacent violators): a value below the
// ones before it is averaged with them.
const nonDecreasing = (values: number[]) => {
    const blocks: { sum: number, count: number }[] = [];
    for (const value of values) {
        blocks.push({ sum: value, count: 1 });
        while (blocks.length > 1 &&
            blocks[blocks.length - 1].sum / blocks[blocks.length - 1].count < blocks[blocks.length - 2].sum / blocks[blocks.length - 2].count) {
            const last = blocks.pop()!;
            blocks[blocks.length - 1].sum += last.sum;
            blocks[blocks.length - 1].count += last.count;
        }
    }
    return blocks.flatMap(block => Array<number>(block.count).fill(block.sum / block.count));
};

/**
 * What the view travels along while the music plays on an image: a point for each instant
 * where something starts, at the middle of what starts then, sorted by `onsetMs`. `inPart`
 * says that the elements are those of a part, which keeps to its own staves: there a jump
 * up or down also ends a line, while in a full score each instant has other voices at
 * other heights. Within a line the path never goes back: a voice written a little behind
 * one that sounded before is averaged with it, so that the view slows down instead.
 * Each line is held at its mean height, so the view does not bob with the pitch.
 */
export const facsimilePath = (elements: { onsetMs: number, zone: FacsimileZone }[], inPart: boolean, pageWidth: number): FacsimilePathPoint[] => {
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const byOnset = new Map<number, FacsimileZone[]>();
    elements.forEach(e => byOnset.set(e.onsetMs, [...byOnset.get(e.onsetMs) ?? [], e.zone]));
    const seen = new Set<string>();
    const points = [...byOnset].map(([onsetMs, zones]) => {
        // A figure sounding again, written once where it first sounded, says nothing of
        // where the music is now, unless all that starts was heard before, as in a repeat.
        const keys = zones.map(zone => `${zone.ulx},${zone.uly},${zone.lrx},${zone.lry}`);
        const fresh = zones.filter((_, i) => !seen.has(keys[i]));
        keys.forEach(key => seen.add(key));
        const centers = (fresh.length > 0 ? fresh : zones).map(zone => ({ x: (zone.ulx + zone.lrx) / 2, y: (zone.uly + zone.lry) / 2 }));
        // What starts at once across a line break, as a voice held into the next line:
        // the music goes on in the new line, the one to the left.
        const left = Math.min(...centers.map(center => center.x));
        const right = Math.max(...centers.map(center => center.x));
        const kept = right - left > pageWidth * LINE_JUMP
            ? centers.filter(center => center.x <= left + pageWidth * ALIGNMENT)
            : centers;
        return {
            id: `onset-${onsetMs}`,
            onsetMs,
            x: mean(kept.map(center => center.x)),
            y: mean(kept.map(center => center.y)),
        };
    });

    const lines: (typeof points)[] = [];
    points.forEach((point, i) => {
        const line = lines[lines.length - 1];
        const newLine = !line || point.x < points[i - 1].x - pageWidth * ALIGNMENT ||
            (inPart && Math.abs(point.y - line[0].y) > pageWidth * LINE_JUMP);
        if (newLine) {
            lines.push([point]);
        } else {
            line.push(point);
        }
    });
    return lines.flatMap((line, index) => {
        const y = mean(line.map(point => point.y));
        const xs = nonDecreasing(line.map(point => point.x));
        return line.map((point, i) => ({ ...point, x: xs[i], y, line: index }));
    });
};
