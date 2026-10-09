import { ScoreViewerConfigScore } from "../types/config";

export const resolveScoreIndex = (scores: ScoreViewerConfigScore[], score: number | string): number | null => {
    if (typeof score === "number") {
        return Number.isInteger(score) && score >= 0 && score < scores.length ? score : null;
    }
    if (typeof score === "string") {
        const index = scores.findIndex(s => s.path === score);
        return index >= 0 ? index : null;
    }
    return null;
};
