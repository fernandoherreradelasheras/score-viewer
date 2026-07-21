import { TieLinks } from "../utils/ties";
import { noteAnchor } from "./geometry";
import { NoteAttack, NoteVisualization } from "./types";

const BAR_CLASS = "note-duration-bar";

/** Verovio user units, relative to the notehead the bar hangs from. */
const GAP_RATIO = 0.5;
const HEIGHT_RATIO = 0.6;
const WIDTH_PER_QUARTER = 1.8;
const LONGEST_QUARTERS = 8;

/** Translucent, so a thick bar reads as a solid body without hiding whatever it
 *  crosses. A stroke is deliberately avoided: scaleX would squash its vertical
 *  edges while the bar grows. */
const FILL_OPACITY = 0.8;

const FADE_MS = 160;

/**
 * An underline that grows beneath the note for exactly as long as it sounds.
 *
 * The bar is inserted as a sibling of the note: verovio puts no transform on the
 * note group, so the notehead's getBBox() is already in the coordinate system the
 * bar is placed in, and no transform chain has to be resolved.
 */
export const createDurationBarVisualization = (ties: TieLinks): NoteVisualization => {
    const running = new Map<string, { bar: SVGRectElement; animation: Animation }>();

    const clear = (noteId: string) => {
        const entry = running.get(noteId);
        if (entry == null) {
            return;
        }
        running.delete(noteId);
        entry.animation.cancel();
        entry.bar.remove();
    };

    /**
     * Right edge of the tie chain starting at `noteId`, as long as it stays inside
     * this system. Returns null when the note is not tied forward, so that a single
     * bar spans a tied note instead of one bar per notehead.
     */
    const tiedEnd = (noteId: string, element: SVGGElement) => {
        const system = element.closest(".system");
        let end: DOMRect | null = null;
        let cursor = ties.next.get(noteId);
        while (cursor != null) {
            const next = document.getElementById(cursor) as SVGGElement | null;
            const anchor = next?.closest(".system") === system ? noteAnchor(next ?? null) : null;
            if (anchor == null) {
                break;
            }
            end = anchor.box;
            cursor = ties.next.get(cursor);
        }
        return end;
    };

    return {
        id: "duration-bar",

        styles: `.${BAR_CLASS} { transform-box: fill-box; transform-origin: left center; }`,

        attack: ({ noteId, element, color, durationMs, durationQuarters }: NoteAttack) => {
            const anchor = noteAnchor(element);
            // A tie continuation is covered by the bar of the note it continues from;
            // drawing its own would break the illusion of one sustained sound.
            if (element == null || anchor == null || durationMs <= 0 || ties.previous.has(noteId)) {
                return;
            }
            clear(noteId);

            const box = anchor.box;
            const end = tiedEnd(noteId, element);
            const height = box.height * HEIGHT_RATIO;
            // Across a tie the real distance between noteheads beats the estimate.
            const width = end != null
                ? end.x + end.width - box.x
                : Math.max(box.width, box.width * WIDTH_PER_QUARTER * Math.min(durationQuarters, LONGEST_QUARTERS));

            const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            bar.setAttribute("class", BAR_CLASS);
            bar.setAttribute("x", `${box.x}`);
            bar.setAttribute("y", `${box.y + box.height + box.height * GAP_RATIO}`);
            bar.setAttribute("width", `${width}`);
            bar.setAttribute("height", `${height}`);
            bar.setAttribute("rx", `${height / 2}`);
            bar.setAttribute("fill", color);
            bar.setAttribute("fill-opacity", `${FILL_OPACITY}`);
            anchor.parent.appendChild(bar);

            const totalMs = durationMs + FADE_MS;
            const animation = bar.animate(
                [
                    { transform: "scaleX(0)", opacity: 1 },
                    { transform: "scaleX(1)", opacity: 1, offset: durationMs / totalMs },
                    { transform: "scaleX(1)", opacity: 0 },
                ],
                { duration: totalMs, easing: "linear" }
            );

            running.set(noteId, { bar, animation });
            animation.finished.then(() => clear(noteId)).catch(() => { });
        },

        // The bar's lifetime is the note's duration, so it retires on its own; an
        // explicit release only matters when playback is cut short.
        release: () => { },

        reset: () => [...running.keys()].forEach(clear),
    };
};
