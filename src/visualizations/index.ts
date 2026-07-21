import { EMPTY_TIE_LINKS, TieLinks } from "../utils/ties";
import { createDurationBarVisualization } from "./durationBar";
import { createGlowVisualization } from "./glow";
import { createPulseVisualization } from "./pulse";
import { NoteVisualization, NoteVisualizationId } from "./types";

export * from "./types";

export const createNoteVisualization = (
    id: NoteVisualizationId,
    ties: TieLinks = EMPTY_TIE_LINKS
): NoteVisualization => {
    switch (id) {
        case "pulse":
            return createPulseVisualization();
        case "duration-bar":
            return createDurationBarVisualization(ties);
        default:
            return createGlowVisualization();
    }
};
