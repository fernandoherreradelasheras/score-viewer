import { FacsimileItem, FacsimileSurface } from "../types";

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
