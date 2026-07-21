export type NoteAnchor = {
    box: DOMRect;
    /** Centre of the notehead, in the note's own user space. */
    cx: number;
    cy: number;
    /** The layer group the note hangs from, which shares that same user space. */
    parent: Node;
};

/**
 * Verovio puts no transform on the note group or on any group between it and the
 * layer, so the notehead's getBBox() is already expressed in the coordinates that
 * siblings of the note are placed in. No transform chain has to be resolved.
 */
export const noteAnchor = (element: SVGGElement | null): NoteAnchor | null => {
    const notehead = element?.querySelector(".notehead") as SVGGraphicsElement | null;
    const parent = element?.parentNode;
    if (notehead == null || parent == null) {
        return null;
    }
    const box = notehead.getBBox();
    return { box, cx: box.x + box.width / 2, cy: box.y + box.height / 2, parent };
};

/**
 * Scale about an arbitrary point of the note's user space. Needed because parts of
 * a note (head, stem, flag) are separate siblings: letting each scale about its own
 * fill-box centre would pull them apart instead of inflating the note as one shape.
 */
export const scaleAbout = (cx: number, cy: number, scale: number) =>
    `translate(${cx}px, ${cy}px) scale(${scale}) translate(${-cx}px, ${-cy}px)`;

/**
 * Anchors the CSS transform to the note's own user space with an explicit origin,
 * so `scaleAbout` composes exactly as written. `will-change` gets the element its
 * own layer, which keeps slow scaling from stepping between device pixels.
 */
export const SHARED_TRANSFORM_STYLE = `transform-box: view-box; transform-origin: 0 0; will-change: transform;`;
