import { noteAnchor, scaleAbout, SHARED_TRANSFORM_STYLE } from "./geometry";
import { NoteAttack, NoteVisualization } from "./types";

const HALO_CLASS = "note-halo";

const START_SCALE = 0.3;
const END_SCALE = 3.2;
/** Wider than tall, echoing the shape of the notehead it blooms from. */
const RADIUS_X_RATIO = 0.7;
const RADIUS_Y_RATIO = 0.5;
const OPACITY = 0.8;

/** How front-loaded the expansion is: higher means the halo reaches most of its
 *  size in the first instants and then only creeps. Keeping the attack sharp is
 *  what lets the halo span a whole note without reading as a slow wash. */
const GROWTH_CURVE = 24;
/** Samples of that curve. The keyframes are dense enough that linear interpolation
 *  between them is indistinguishable from the curve itself. */
const GROWTH_STEPS = 12;

const growth = (progress: number) =>
    Math.log1p(GROWTH_CURVE * progress) / Math.log1p(GROWTH_CURVE);

/** Expands logarithmically while fading out linearly, so the halo dies exactly
 *  when the note stops sounding however long that is. */
const haloKeyframes = (cx: number, cy: number) =>
    Array.from({ length: GROWTH_STEPS + 1 }, (_, i) => {
        const progress = i / GROWTH_STEPS;
        return {
            transform: scaleAbout(cx, cy, START_SCALE + (END_SCALE - START_SCALE) * growth(progress)),
            opacity: OPACITY * (1 - progress),
        };
    });

/**
 * A halo blooming out of the notehead and fading.
 *
 * This replaces the original feMorphology filter: an animated dilate is the most
 * expensive SVG filter primitive there is, it was rasterised over a 300% region
 * for every sounding notehead on every frame, and its SMIL animation was shared
 * per staff, so two simultaneous notes in one voice fought over a single radius.
 * A plain ellipse costs nothing to compose and is per note.
 */
export const createGlowVisualization = (): NoteVisualization => {
    const running = new Map<string, { halo: SVGEllipseElement; animation: Animation }>();

    const clear = (noteId: string) => {
        const entry = running.get(noteId);
        if (entry == null) {
            return;
        }
        running.delete(noteId);
        entry.animation.cancel();
        entry.halo.remove();
    };

    return {
        id: "glow",

        styles: `.${HALO_CLASS} { ${SHARED_TRANSFORM_STYLE} pointer-events: none; }`,

        attack: ({ noteId, element, color, durationMs }: NoteAttack) => {
            const anchor = noteAnchor(element);
            if (anchor == null || durationMs <= 0) {
                return;
            }
            clear(noteId);

            const halo = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
            halo.setAttribute("class", HALO_CLASS);
            halo.setAttribute("cx", `${anchor.cx}`);
            halo.setAttribute("cy", `${anchor.cy}`);
            halo.setAttribute("rx", `${anchor.box.width * RADIUS_X_RATIO}`);
            halo.setAttribute("ry", `${anchor.box.height * RADIUS_Y_RATIO}`);
            halo.setAttribute("fill", color);
            // Inserted before the note so it paints underneath it.
            anchor.parent.insertBefore(halo, element);

            const animation = halo.animate(haloKeyframes(anchor.cx, anchor.cy), { duration: durationMs });

            running.set(noteId, { halo, animation });
            animation.finished.then(() => clear(noteId)).catch(() => { });
        },

        // The halo outlives neither the note nor its own timeline; it retires itself.
        release: () => { },

        reset: () => [...running.keys()].forEach(clear),
    };
};
