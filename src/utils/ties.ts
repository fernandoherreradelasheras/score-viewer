export type TieLinks = {
    /** Note id -> the id it is tied forward to. */
    next: Map<string, string>;
    /** Note id -> the id it continues from. */
    previous: Map<string, string>;
};

export const EMPTY_TIE_LINKS: TieLinks = { next: new Map(), previous: new Map() };

/**
 * Tie information cannot be recovered from the timemap: `mergeTimemapTies` makes
 * both halves of a tie start and stop together, so they become indistinguishable.
 * Visualizations that must tell a continuation from a fresh attack read it here.
 */
export const buildTieLinks = (tiedNotes: { first: string; second: string }[]): TieLinks => {
    const next = new Map<string, string>();
    const previous = new Map<string, string>();
    tiedNotes.forEach(({ first, second }) => {
        next.set(first, second);
        previous.set(second, first);
    });
    return { next, previous };
};
