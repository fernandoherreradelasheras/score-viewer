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
