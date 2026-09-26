import { useEffect, useMemo, useRef } from "react";
import { useControls } from "react-zoom-pan-pinch";
import useStore from "../store";
import { FacsimileLinks, FacsimileZone, PlayingState } from "../types";
import { playerStaffColor } from "../types/colors";
import { buildElementIntervals } from "../utils/timemap";
import FacsimileOverlay, { ImageBox } from "./FacsimileOverlay";

interface FacsimilePlayerOverlayProps {
    links: FacsimileLinks;
    surface: number;
    box: ImageBox;
    // Staves of the part the image shows, null for an image of the full score.
    partStaves: string[] | null;
    onPartMoved: (surface: number) => void;
}

// A line of the manuscript ends where the music goes back to the left, or where a part
// lands this far above or below, as fractions of the page width. In a full score the
// voices starting together are not quite aligned, hence the tolerance.
const LINE_JUMP = 0.15;
const FULL_SCORE_ALIGNMENT = 0.01;
const JUMP_ANIMATION_MS = 250;

// Kept apart from the image so that the position ticks re-render the marks alone.
function FacsimilePlayerOverlay({ links, surface, box, partStaves, onPartMoved }: FacsimilePlayerOverlayProps) {
    const playingState = useStore.use.playingState();
    const playingPosition = useStore.use.playingPosition();
    const seekPosition = useStore.use.seekPosition();
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

    const lastOfPart = started.filter(e => partStaves == null || partStaves.includes(e.staff)).pop();

    // What the view travels along: the part of the image, or else its first staff, or in a
    // full score every voice, each instant where something starts taken as one point.
    // Each point is held at the height of its line, so the view does not bob with the pitch.
    const followed = useMemo(() => {
        const onSurface = linked.filter(e => e.zone.surface == surface);
        const unit = links.surfaces[surface].width;
        const center = (zone: FacsimileZone) => ({ x: (zone.ulx + zone.lrx) / 2, y: (zone.uly + zone.lry) / 2 });
        const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

        let points: { id: string, onsetMs: number, x: number, y: number }[];
        if (partStaves == null) {
            const byOnset = new Map<number, FacsimileZone[]>();
            onSurface.forEach(e => byOnset.set(e.onsetMs, [...byOnset.get(e.onsetMs) ?? [], e.zone]));
            points = [...byOnset].map(([onsetMs, zones]) => ({
                id: `onset-${onsetMs}`,
                onsetMs,
                x: mean(zones.map(zone => center(zone).x)),
                y: mean(zones.map(zone => center(zone).y)),
            }));
        } else {
            const staves = partStaves.length > 0 ? partStaves
                : onSurface.map(e => e.staff).sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 1);
            points = onSurface
                .filter(e => staves.includes(e.staff))
                .map(e => ({ id: e.id, onsetMs: e.onsetMs, ...center(e.zone) }));
        }

        const lines: (typeof points)[] = [];
        points.forEach((point, i) => {
            const line = lines[lines.length - 1];
            const previous = points[i - 1];
            const newLine = !line || (partStaves == null
                ? point.x < previous.x - unit * FULL_SCORE_ALIGNMENT
                : point.x < previous.x || Math.abs(point.y - line[0].y) > unit * LINE_JUMP);
            if (newLine) {
                lines.push([point]);
            } else {
                line.push(point);
            }
        });
        return lines.flatMap((line, index) => {
            const y = line.reduce((sum, point) => sum + point.y, 0) / line.length;
            return line.map(point => ({ ...point, y, line: index }));
        });
    }, [linked, surface, partStaves, links]);

    const upcoming = followed.findIndex(e => e.onsetMs > playingPosition);
    const next = upcoming == -1 ? undefined : followed[upcoming];
    const current = upcoming == -1 ? followed[followed.length - 1] : followed[upcoming - 1];

    // The view travels from the note that starts to the next one for as long as the first
    // lasts, so it scrolls at the pace of the music, keeping what sounds in the middle at
    // the scale the reader left. At the end of a line it waits for the next one to start
    // and jumps there, instead of sweeping back across the page.
    const { zoomToElement, setTransform, instance } = useControls();
    const currentAnchorRef = useRef<SVGCircleElement>(null);
    const nextAnchorRef = useRef<SVGCircleElement>(null);
    const headingToRef = useRef<string | null>(null);
    const moveRef = useRef(0);
    const seekRef = useRef(seekPosition);

    useEffect(() => {
        const move = ++moveRef.current;
        if (seekPosition !== seekRef.current) {
            seekRef.current = seekPosition;
            headingToRef.current = null;
        }

        if (playingState != PlayingState.PLAYING) {
            // The library runs its animations on its own clock: a short one to where the
            // view already is replaces the one under way.
            const { positionX, positionY, scale } = instance.state;
            setTransform(positionX, positionY, scale, 1);
            if (playingState == PlayingState.STOPPED) {
                headingToRef.current = null;
            }
            return;
        }

        const currentAnchor = currentAnchorRef.current;
        if (!current || !currentAnchor) {
            return;
        }
        // Typed for HTML elements, but all it reads from the node is its client rect.
        const moveTo = (anchor: SVGCircleElement, animationTime: number, animationType: "easeOut" | "linear") =>
            zoomToElement(anchor as unknown as HTMLElement, { scale: instance.state.scale, animationTime, animationType });

        // Travelling to this note already, or paused on the way to the next one.
        const onTrack = headingToRef.current === current.id || headingToRef.current === next?.id;
        const nextAnchor = nextAnchorRef.current;

        if (!next || next.line != current.line || !nextAnchor) {
            headingToRef.current = current.id;
            if (!onTrack) {
                moveTo(currentAnchor, JUMP_ANIMATION_MS, "easeOut");
            }
            return;
        }

        headingToRef.current = next.id;
        const remaining = next.onsetMs - playingPosition;
        if (onTrack) {
            moveTo(nextAnchor, remaining, "linear");
        } else {
            moveTo(currentAnchor, JUMP_ANIMATION_MS, "easeOut").then(() => {
                if (move === moveRef.current && nextAnchorRef.current) {
                    moveTo(nextAnchorRef.current, Math.max(1, remaining - JUMP_ANIMATION_MS), "linear");
                }
            });
        }
        // On a new note, a change of transport and a seek: the position is read when they
        // happen, and following every tick would restart the travel on each one.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current?.id, playingState, seekPosition]);

    // Only when another element of the part starts: a reader turning the page by hand
    // while it plays is not sent back on every tick.
    useEffect(() => {
        if (lastOfPart && lastOfPart.zone.surface != surface) {
            onPartMoved(lastOfPart.zone.surface);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastOfPart?.id]);

    const anchors = [
        ...current ? [{ x: current.x, y: current.y, ref: currentAnchorRef }] : [],
        ...next ? [{ x: next.x, y: next.y, ref: nextAnchorRef }] : [],
    ];

    return <FacsimileOverlay surface={links.surfaces[surface]} box={box} marks={marks} anchors={anchors} />;
}

export default FacsimilePlayerOverlay;
