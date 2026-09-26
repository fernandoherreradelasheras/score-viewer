import { Ref } from "react";
import { FacsimileSurface, FacsimileZone } from "../types";

// A zone encoded as a single point carries no extent, so the marks around it are sized
// as fractions of the page width: roughly a notehead, and a notehead with its stem. On a
// page written closer they shrink, for the mark of a note not to reach the next one.
const POINT_ZONE_MAX_SIZE = 0.01;
const MARK_RADIUS = 0.018;
const FRAME_WIDTH = 0.045;
const FRAME_HEIGHT = 0.065;
const FRAME_PADDING = 0.008;
const MAX_RADIUS_TO_SPACING = 0.45;

export type FacsimileMark = { id: string, zone: FacsimileZone, color: string };

// Where the image is laid out inside its positioned container, untransformed.
export type ImageBox = { left: number, top: number, width: number, height: number };

interface FacsimileOverlayProps {
    surface: FacsimileSurface;
    box: ImageBox;
    marks?: FacsimileMark[];
    // Framed together, in a single box.
    frame?: FacsimileZone[] | null;
    frameRef?: Ref<SVGRectElement>;
    // Invisible points, for the view to be moved to.
    anchors?: { x: number, y: number, ref: Ref<SVGCircleElement> }[];
}

function FacsimileOverlay({ surface, box, marks = [], frame, frameRef, anchors = [] }: FacsimileOverlayProps) {
    const pageUnit = surface.width;
    const unit = surface.noteSpacing == null ? pageUnit
        : Math.min(pageUnit, surface.noteSpacing * MAX_RADIUS_TO_SPACING / MARK_RADIUS);
    const isPoint = (zone: FacsimileZone) =>
        zone.lrx - zone.ulx <= pageUnit * POINT_ZONE_MAX_SIZE && zone.lry - zone.uly <= pageUnit * POINT_ZONE_MAX_SIZE;
    const center = (zone: FacsimileZone) => ({ x: (zone.ulx + zone.lrx) / 2, y: (zone.uly + zone.lry) / 2 });

    const frameBox = (zone: FacsimileZone) => isPoint(zone)
        ? {
            left: center(zone).x - unit * FRAME_WIDTH / 2,
            top: center(zone).y - unit * FRAME_HEIGHT / 2,
            right: center(zone).x + unit * FRAME_WIDTH / 2,
            bottom: center(zone).y + unit * FRAME_HEIGHT / 2,
        }
        : {
            left: zone.ulx - unit * FRAME_PADDING,
            top: zone.uly - unit * FRAME_PADDING,
            right: zone.lrx + unit * FRAME_PADDING,
            bottom: zone.lry + unit * FRAME_PADDING,
        };

    const boxes = (frame ?? []).map(frameBox);
    const frameRect = boxes.length == 0 ? null : (() => {
        const left = Math.min(...boxes.map(b => b.left));
        const top = Math.min(...boxes.map(b => b.top));
        return {
            x: left,
            y: top,
            width: Math.max(...boxes.map(b => b.right)) - left,
            height: Math.max(...boxes.map(b => b.bottom)) - top,
        };
    })();

    return (
        <svg className="facsimile-overlay"
            viewBox={`0 0 ${surface.width} ${surface.height}`}
            preserveAspectRatio="none"
            style={{ position: "absolute", ...box, pointerEvents: "none", overflow: "visible" }}>
            {marks.map(({ id, zone, color }) => isPoint(zone)
                ? <circle key={id} className="facsimile-mark" fill={color} stroke={color}
                    cx={center(zone).x} cy={center(zone).y} r={unit * MARK_RADIUS} />
                : <rect key={id} className="facsimile-mark" fill={color} stroke={color}
                    x={zone.ulx} y={zone.uly} width={zone.lrx - zone.ulx} height={zone.lry - zone.uly} />)}
            {anchors.map(({ x, y, ref }, i) =>
                <circle key={i} ref={ref} cx={x} cy={y} r={unit * MARK_RADIUS} opacity={0} />)}
            {frameRect && <rect ref={frameRef} className="facsimile-frame" {...frameRect} rx={unit * FRAME_PADDING} />}
        </svg>
    );
}

export default FacsimileOverlay;
