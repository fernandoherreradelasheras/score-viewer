import { noteAnchor, scaleAbout, SHARED_TRANSFORM_STYLE } from "./geometry";
import { NoteAttack, NoteVisualization } from "./types";

const PULSE_CLASS = "note-pulse";

/** Head, stem and flag inflate together, so a hollow half note reads as strongly
 *  as a filled quarter. Lyrics are deliberately left out. */
const PULSE_PARTS = ".notehead, .stem, .flag";

const MIN_SCALE = 1.05;
const MAX_SCALE = 1.95;
const SHORTEST_QUARTERS = 0.25;
const LONGEST_QUARTERS = 8;
/** Growth per doubling of the note value. Anything much below this and adjacent
 *  note values are indistinguishable to the eye. */
const SCALE_PER_OCTAVE = 0.2;

const MIN_ATTACK_MS = 40;
const MAX_ATTACK_MS = 140;
const ATTACK_RATIO = 0.18;
/** Share of the post-attack time spent falling from the peak to the sustain. */
const SETTLE_RATIO = 0.25;
/** Fraction of the peak growth kept while the note keeps sounding. */
const SUSTAIN_RATIO = 0.6;

/**
 * Grow with the note length, but logarithmically: a whole note reads as clearly
 * longer than a sixteenth without its head swallowing the neighbouring staves.
 */
const pulseScale = (durationQuarters: number) => {
    const quarters = Math.min(Math.max(durationQuarters, SHORTEST_QUARTERS), LONGEST_QUARTERS);
    return Math.min(MAX_SCALE, MIN_SCALE + SCALE_PER_OCTAVE * Math.log2(quarters / SHORTEST_QUARTERS));
};

export const createPulseVisualization = (): NoteVisualization => {
    const running = new Map<string, Animation[]>();

    const clear = (noteId: string) => {
        const animations = running.get(noteId);
        if (animations == null) {
            return;
        }
        running.delete(noteId);
        animations.forEach(animation => {
            (animation.effect as KeyframeEffect)?.target?.classList.remove(PULSE_CLASS);
            animation.cancel();
        });
    };

    return {
        id: "pulse",

        styles: `.${PULSE_CLASS} { ${SHARED_TRANSFORM_STYLE} }`,

        attack: ({ noteId, element, durationMs, durationQuarters }: NoteAttack) => {
            const anchor = noteAnchor(element);
            const parts = element ? [...element.querySelectorAll(PULSE_PARTS)] : [];
            if (anchor == null || parts.length === 0 || durationMs <= 0) {
                return;
            }
            clear(noteId);

            // The animation spans the whole note: a sharp attack, a quick settle to a
            // sustained size, then a slow release. That is what makes a whole note read
            // as longer than a quarter — the peak scale alone barely registers.
            const attackMs = Math.min(MAX_ATTACK_MS, Math.max(MIN_ATTACK_MS, durationMs * ATTACK_RATIO));
            const settleMs = (durationMs - attackMs) * SETTLE_RATIO;
            const peak = pulseScale(durationQuarters);
            const sustain = 1 + (peak - 1) * SUSTAIN_RATIO;
            const at = (scale: number) => scaleAbout(anchor.cx, anchor.cy, scale);
            const keyframes = [
                { transform: at(1), easing: "ease-out" },
                { transform: at(peak), offset: attackMs / durationMs, easing: "ease-in-out" },
                { transform: at(sustain), offset: (attackMs + settleMs) / durationMs, easing: "ease-in" },
                { transform: at(1) },
            ];

            const animations = parts.map(part => {
                part.classList.add(PULSE_CLASS);
                return part.animate(keyframes, { duration: durationMs });
            });

            running.set(noteId, animations);
            animations[0].finished.then(() => clear(noteId)).catch(() => { });
        },

        release: clear,

        reset: () => [...running.keys()].forEach(clear),
    };
};
