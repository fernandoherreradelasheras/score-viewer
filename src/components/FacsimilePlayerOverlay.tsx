import { useEffect, useMemo, useRef } from "react";
import { useControls } from "react-zoom-pan-pinch";
import useStore from "../store";
import { FacsimileLinks, PlayingState } from "../types";
import { playerStaffColor } from "../types/colors";
import { buildElementIntervals, buildNoteTimings, noteTimingAt } from "../utils/timemap";
import { facsimilePath } from "../utils/facsimile";
import usePlaybackTimemap from "../hooks/usePlaybackTimemap";
import FacsimileOverlay, { ImageBox } from "./FacsimileOverlay";

interface FacsimilePlayerOverlayProps {
    links: FacsimileLinks;
    surface: number;
    box: ImageBox;
    // Staves of the part the image shows, null for an image of the full score.
    partStaves: string[] | null;
    onPartMoved: (surface: number) => void;
}

const JUMP_ANIMATION_MS = 250;

// Kept apart from the image so that the position ticks re-render the marks alone.
function FacsimilePlayerOverlay({ links, surface, box, partStaves, onPartMoved }: FacsimilePlayerOverlayProps) {
    const playingState = useStore.use.playingState();
    const playingPosition = useStore.use.playingPosition();
    const seekPosition = useStore.use.seekPosition();
    const timemap = usePlaybackTimemap();
    const noteStaffMap = useStore.use.score()?.properties.noteStaffMap;

    const linked = useMemo(() => {
        const intervals = buildElementIntervals(timemap ?? []);
        return Object.entries(links.zones)
            .flatMap(([id, zone]) => (intervals.get(id) ?? [])
                .map(interval => ({ id, zone, staff: noteStaffMap?.[id] ?? "", ...interval })))
            .sort((a, b) => a.onsetMs - b.onsetMs);
    }, [links, timemap, noteStaffMap]);

    const noteTimings = useMemo(() => buildNoteTimings(timemap ?? []), [timemap]);

    const notStarted = linked.findIndex(e => e.onsetMs > playingPosition);
    const started = playingState == PlayingState.STOPPED ? [] :
        linked.slice(0, notStarted == -1 ? linked.length : notStarted);

    const marks = started
        .filter(e => e.zone.surface == surface && playingPosition < e.endMs)
        .map(({ id, zone, staff, onsetMs }) => {
            const timing = noteTimingAt(noteTimings.get(id), onsetMs);
            // Only notes pulse, and only while playing, as on the score.
            const pulse = timing && playingState == PlayingState.PLAYING ? {
                durationMs: timing.durationMs,
                durationQuarters: timing.durationQuarters,
                elapsedMs: Math.max(0, playingPosition - onsetMs),
                run: seekPosition,
            } : undefined;
            return { id, zone, color: playerStaffColor(parseInt(staff) || 1), pulse };
        });

    const lastOfPart = started.filter(e => partStaves == null || partStaves.includes(e.staff)).pop();

    // What the view travels along: the part of the image, or else its first staff, or in a
    // full score every voice.
    const followed = useMemo(() => {
        const onSurface = linked.filter(e => e.zone.surface == surface);
        const staves = partStaves == null ? null : partStaves.length > 0 ? partStaves
            : onSurface.map(e => e.staff).sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 1);
        const elements = staves == null ? onSurface : onSurface.filter(e => staves.includes(e.staff));
        return facsimilePath(elements, staves != null, links.surfaces[surface].width);
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
    // Shown on a playback already under way, as when its tab is opened while playing: the
    // view is put on the music at once, not swept there from wherever the image was.
    const joinsPlaybackRef = useRef(playingState == PlayingState.PLAYING);

    useEffect(() => {
        const move = ++moveRef.current;
        if (seekPosition !== seekRef.current) {
            seekRef.current = seekPosition;
            headingToRef.current = null;
        }

        if (playingState != PlayingState.PLAYING) {
            joinsPlaybackRef.current = false;
            // The library runs its animations on its own clock: a short one to where the
            // view already is replaces the one under way.
            const { positionX, positionY, scale } = instance.state;
            setTransform(positionX, positionY, scale, 1);
            if (playingState == PlayingState.STOPPED) {
                headingToRef.current = null;
            }
            return;
        }

        if (!current || !currentAnchorRef.current) {
            return;
        }
        const joinsPlayback = joinsPlaybackRef.current;
        const jumpMs = joinsPlayback ? 0 : JUMP_ANIMATION_MS;
        // Typed for HTML elements, but all it reads from the node is its client rect.
        const moveTo = (anchor: SVGCircleElement, animationTime: number, animationType: "easeOut" | "linear") =>
            zoomToElement(anchor as unknown as HTMLElement, { scale: instance.state.scale, animationTime, animationType });

        const travel = () => {
            joinsPlaybackRef.current = false;
            const currentAnchor = currentAnchorRef.current;
            if (!currentAnchor) {
                return;
            }
            // Travelling to this note already, or paused on the way to the next one.
            const onTrack = headingToRef.current === current.id || headingToRef.current === next?.id;
            const nextAnchor = nextAnchorRef.current;

            if (!next || next.line != current.line || !nextAnchor) {
                headingToRef.current = current.id;
                if (!onTrack) {
                    moveTo(currentAnchor, jumpMs, "easeOut");
                }
                return;
            }

            headingToRef.current = next.id;
            const remaining = next.onsetMs - playingPosition;
            if (onTrack) {
                moveTo(nextAnchor, remaining, "linear");
            } else {
                moveTo(currentAnchor, jumpMs, "easeOut").then(() => {
                    if (move === moveRef.current && nextAnchorRef.current) {
                        moveTo(nextAnchorRef.current, Math.max(1, remaining - jumpMs), "linear");
                    }
                });
            }
        };

        if (!joinsPlayback) {
            travel();
            return;
        }
        // Just shown, the wrapper hears of its size only at the next layout, when it
        // realigns the content cancelling any move under way: the first one waits for it.
        let request = requestAnimationFrame(() => {
            request = requestAnimationFrame(travel);
        });
        return () => cancelAnimationFrame(request);
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
