import { useEffect, useMemo, useRef } from "react";
import { useControls } from "react-zoom-pan-pinch";
import useStore from "../store";
import { FacsimileLinks, PlayingState } from "../types";
import { playerStaffColor } from "../types/colors";
import { buildElementIntervals } from "../utils/timemap";
import FacsimileOverlay, { ImageBox } from "./FacsimileOverlay";

interface FacsimilePlayerOverlayProps {
    links: FacsimileLinks;
    surface: number;
    box: ImageBox;
    // Staves of the part the image shows, empty when the config does not say.
    partStaves: string[];
    onPartMoved: (surface: number) => void;
}

const FOLLOW_ANIMATION_MS = 250;

// Kept apart from the image so that the position ticks re-render the marks alone.
function FacsimilePlayerOverlay({ links, surface, box, partStaves, onPartMoved }: FacsimilePlayerOverlayProps) {
    const playingState = useStore.use.playingState();
    const playingPosition = useStore.use.playingPosition();
    const timemap = useStore.use.renderedSvgData()?.timemap;
    const noteStaffMap = useStore.use.score()?.properties.noteStaffMap;

    const linked = useMemo(() => {
        const intervals = buildElementIntervals(timemap ?? []);
        return Object.entries(links.zones)
            .flatMap(([id, zone]) => {
                const interval = intervals.get(id);
                return interval ? [{ id, zone, staff: noteStaffMap?.[id] ?? "", ...interval }] : [];
            })
            .sort((a, b) => a.onsetMs - b.onsetMs);
    }, [links, timemap, noteStaffMap]);

    const notStarted = linked.findIndex(e => e.onsetMs > playingPosition);
    const started = playingState == PlayingState.STOPPED ? [] :
        linked.slice(0, notStarted == -1 ? linked.length : notStarted);

    const marks = started
        .filter(e => e.zone.surface == surface && playingPosition < e.endMs)
        .map(({ id, zone, staff }) => ({ id, zone, color: playerStaffColor(parseInt(staff) || 1) }));

    const lastOfPart = started.filter(e => partStaves.includes(e.staff)).pop();

    // What sounds is kept in the middle of the view, at the scale the reader left: zoomed
    // in, the marks would otherwise run out of sight.
    const { zoomToElement, instance } = useControls();
    const marksRef = useRef<SVGGElement>(null);
    const marksKey = marks.map(mark => mark.id).join(" ");
    useEffect(() => {
        if (marksKey == "" || marksRef.current == null) {
            return;
        }
        // Typed for HTML elements, but all it reads from the node is its client rect.
        zoomToElement(marksRef.current as unknown as HTMLElement,
            { scale: instance.state.scale, animationTime: FOLLOW_ANIMATION_MS });
        // Only when other notes start sounding, not on every tick of the position.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marksKey]);

    // Only when another element of the part starts: a reader turning the page by hand
    // while it plays is not sent back on every tick.
    useEffect(() => {
        if (lastOfPart && lastOfPart.zone.surface != surface) {
            onPartMoved(lastOfPart.zone.surface);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastOfPart?.id]);

    return <FacsimileOverlay surface={links.surfaces[surface]} box={box} marks={marks} marksRef={marksRef} />;
}

export default FacsimilePlayerOverlay;
