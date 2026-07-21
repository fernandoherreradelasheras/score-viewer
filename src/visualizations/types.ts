export const NOTE_VISUALIZATIONS = ["glow", "pulse", "duration-bar"] as const;

export type NoteVisualizationId = typeof NOTE_VISUALIZATIONS[number];

export type NoteAttack = {
    noteId: string;
    /** The <g class="note"> of the current page, or null if it is not rendered. */
    element: SVGGElement | null;
    staff: number;
    color: string;
    durationMs: number;
    durationQuarters: number;
};

/**
 * How a sounding note is rendered on top of the base tint that every mode shares.
 * Visualizations own their per-note state, so `release` and `reset` only need ids.
 */
export interface NoteVisualization {
    readonly id: NoteVisualizationId;
    /** CSS appended to the highlighter stylesheet while this mode is selected. */
    readonly styles?: string;
    attack(note: NoteAttack): void;
    release(noteId: string): void;
    reset(): void;
}
