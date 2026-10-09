import { useCallback, useEffect, useMemo, useRef } from "react";
import useStore from "./store";
import { PlayingState, TimeMapEvent } from "./types";
import { noteAnchor } from "./visualizations/geometry";
import { cursorStops, lastStopAt } from "./utils/cursor";

const CURSOR_CLASS = "playback-cursor";

/** In staff spaces. */
const CURSOR_WIDTH = 1.4;
const CURSOR_OVERHANG = 1;

/** A drift this large from the audio, as after a seek, puts the cursor back in place. */
const MAX_DRIFT_MS = 100;

type SystemFrame = { top: number, bottom: number, right: number, staffSpace: number };

type Placement = { x: number, system: SVGGElement, frame: SystemFrame };

type Cursor = { element: SVGRectElement, animation: Animation, stop: number };

// From the top line of the first staff to the bottom line of the last, and to the end of
// the last measure. Verovio puts no transform on the system or anything inside it, so the
// boxes of its staff lines are already in its own coordinates.
const systemFrame = (system: SVGGElement): SystemFrame | null => {
    const boxes = [...system.querySelectorAll(".measure > .staff > path")]
        .map(line => (line as SVGGraphicsElement).getBBox());
    if (boxes.length < 2) {
        return null;
    }
    return {
        top: Math.min(...boxes.map(box => box.y)),
        bottom: Math.max(...boxes.map(box => box.y + box.height)),
        right: Math.max(...boxes.map(box => box.x + box.width)),
        staffSpace: Math.abs(boxes[1].y - boxes[0].y),
    };
};

const centerX = (element: SVGGElement) => {
    const anchor = noteAnchor(element);
    if (anchor) {
        return anchor.cx;
    }
    const box = element.getBBox();
    return box.x + box.width / 2;
};

/**
 * A band across the system that travels with the music in the paged view: from the
 * notes that start to the next ones, at the pace between them, and to the end of the
 * system after the last of its notes. Notes on other pages leave it hidden.
 */
function PlaybackCursor({ timemap }: { timemap: TimeMapEvent[] }) {
    const playingState = useStore.use.playingState();
    const playingPosition = useStore.use.playingPosition();
    const seekPosition = useStore.use.seekPosition();
    const renderedSvgData = useStore.use.renderedSvgData();
    const showPlaybackCursor = useStore.use.showPlaybackCursor();

    const stops = useMemo(() => cursorStops(timemap), [timemap]);

    const positionRef = useRef(0);
    const cursorRef = useRef<Cursor | null>(null);
    // What is known of the page on screen: its elements by id, and where each stop and
    // system lies on it. Rebuilt for every new SVG.
    const pageRef = useRef<{
        svg: SVGSVGElement,
        elements: Map<string, SVGGElement>,
        placements: Map<number, Placement | null>,
        frames: Map<SVGGElement, SystemFrame | null>,
    } | null>(null);

    const clear = useCallback(() => {
        cursorRef.current?.animation.cancel();
        cursorRef.current?.element.remove();
        cursorRef.current = null;
    }, []);

    const placement = useCallback((index: number): Placement | null => {
        const svg = document.querySelector(".svg-container.static-score svg") as SVGSVGElement | null;
        if (svg == null || index < 0 || index >= stops.length) {
            return null;
        }
        if (pageRef.current?.svg !== svg) {
            const elements = new Map<string, SVGGElement>();
            svg.querySelectorAll<SVGGElement>("g.note, g.rest, g.mRest, g.chord").forEach(element =>
                elements.set(element.id, element));
            pageRef.current = { svg, elements, placements: new Map(), frames: new Map() };
        }
        const page = pageRef.current;
        if (!page.placements.has(index)) {
            const found = stops[index].ids.flatMap(id => page.elements.get(id) ?? []);
            const system = found[0]?.closest(".system") as SVGGElement | null;
            if (system && !page.frames.has(system)) {
                page.frames.set(system, systemFrame(system));
            }
            const frame = system ? page.frames.get(system) : null;
            page.placements.set(index, system && frame ? {
                x: found.reduce((sum, element) => sum + centerX(element), 0) / found.length,
                system,
                frame,
            } : null);
        }
        return page.placements.get(index) ?? null;
    }, [stops]);

    const place = useCallback((index: number, position: number) => {
        const from = placement(index);
        if (from == null) {
            return;
        }
        const next = placement(index + 1);
        const toX = next != null && next.system === from.system ? next.x : from.frame.right;
        const endMs = stops[index + 1]?.tstamp ?? timemap[timemap.length - 1]?.tstamp ?? stops[index].tstamp;

        const { top, bottom, staffSpace } = from.frame;
        const width = staffSpace * CURSOR_WIDTH;
        const overhang = staffSpace * CURSOR_OVERHANG;
        const element = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        element.setAttribute("class", CURSOR_CLASS);
        element.setAttribute("x", `${-width / 2}`);
        element.setAttribute("y", `${top - overhang}`);
        element.setAttribute("width", `${width}`);
        element.setAttribute("height", `${bottom - top + 2 * overhang}`);
        element.setAttribute("rx", `${width / 4}`);
        // First in the system, for the notes to be painted over it.
        from.system.insertBefore(element, from.system.firstChild);

        const animation = element.animate(
            [{ transform: `translateX(${from.x}px)` }, { transform: `translateX(${toX}px)` }],
            { duration: Math.max(1, endMs - stops[index].tstamp), easing: "linear", fill: "forwards" });
        animation.currentTime = position - stops[index].tstamp;
        cursorRef.current = { element, animation, stop: index };
    }, [placement, stops, timemap]);

    const sync = useCallback(() => {
        if (!showPlaybackCursor || playingState === PlayingState.STOPPED) {
            clear();
            return;
        }
        const position = positionRef.current;
        const index = lastStopAt(stops, position);
        const cursor = cursorRef.current;
        if (cursor == null || cursor.stop !== index || !cursor.element.isConnected) {
            clear();
            place(index, position);
        }
        const placed = cursorRef.current;
        if (placed == null) {
            return;
        }
        const elapsed = position - stops[index].tstamp;
        if (playingState === PlayingState.PAUSED) {
            placed.animation.pause();
            placed.animation.currentTime = elapsed;
        } else {
            if (Math.abs(Number(placed.animation.currentTime ?? 0) - elapsed) > MAX_DRIFT_MS) {
                placed.animation.currentTime = elapsed;
            }
            if (placed.animation.playState === "paused") {
                placed.animation.play();
            }
        }
    }, [showPlaybackCursor, playingState, stops, clear, place]);

    // The position is held apart from the transport: a seek while paused does not move
    // the playing position, which would otherwise put the cursor back where it was.
    useEffect(() => {
        positionRef.current = playingPosition;
        sync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playingPosition]);

    useEffect(() => {
        if (seekPosition >= 0) {
            positionRef.current = seekPosition;
            sync();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seekPosition]);

    useEffect(() => {
        sync();
    }, [renderedSvgData, sync]);

    useEffect(() => clear, [clear]);

    return null;
}

export default PlaybackCursor;
