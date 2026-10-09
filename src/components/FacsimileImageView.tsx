import { Ref, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactZoomPanPinchContentRef, TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import useStore from "../store";
import { FacsimileItem, FacsimileZone } from '../types';
import FacsimileOverlay, { FACSIMILE_TARGET_CLASS, ImageBox } from './FacsimileOverlay';
import FacsimilePlayerOverlay from './FacsimilePlayerOverlay';
import { useFacsimileLinkHandler } from '../hooks/useFacsimileLinkHandler';

const IMAGE_PADDING = 12;
const CELL_IMAGE_PADDING = 4;
const FRAME_ZOOM_SCALE = 2;
const FRAME_ZOOM_ANIMATION_MS = 300;

export type FacsimileFrame = { zones: FacsimileZone[], seq: number };

// A component of its own because useControls only works under TransformWrapper. The
// last frame zoomed to is kept by the caller: this remounts with the wrapper when the
// layout changes, and must not zoom to the same frame again.
function FacsimileFrameZoom({ frame, seq, zoomedSeqRef }:
  { frame: SVGRectElement | null, seq: number | null, zoomedSeqRef: RefObject<number | null> }) {
  const { zoomToElement, instance } = useControls();

  useEffect(() => {
    if (frame == null || seq == null || seq === zoomedSeqRef.current) {
      return;
    }
    const zoom = () => {
      zoomedSeqRef.current = seq;
      // Relative to the scale that fits the whole image: in a vertical split the image
      // already fills the width at scale 1, and is taller than the view.
      const { wrapperComponent, contentComponent } = instance;
      const fitScale = wrapperComponent && contentComponent ? Math.min(
        wrapperComponent.clientWidth / contentComponent.offsetWidth,
        wrapperComponent.clientHeight / contentComponent.offsetHeight) : 1;
      const scale = Math.max(instance.state.scale, FRAME_ZOOM_SCALE * fitScale);
      // Typed for HTML elements, but all it reads from the node is its client rect.
      zoomToElement(frame as unknown as HTMLElement, { scale, animationTime: FRAME_ZOOM_ANIMATION_MS });
    };
    // A frame on an image just switched to arrives with the image, and the wrapper hears
    // of the new size only at the next layout, when it realigns the content cancelling
    // any animation under way: the zoom has to start after that.
    let request = requestAnimationFrame(() => {
      request = requestAnimationFrame(zoom);
    });
    return () => cancelAnimationFrame(request);
  }, [frame, seq, zoomedSeqRef, zoomToElement, instance]);

  return null;
}

// Another image, or another layout, starts again from the whole image, or from the top
// of it when it only fits the width of the view. A cell keeps its scale. Keyed on the image once loaded, not on its index:
// another score starts at the same index, and before the load the content still has the
// size of the previous image.
function FacsimileViewReset({ loadedImage, fitWidth }: { loadedImage: string | null, fitWidth: boolean }) {
  const splitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const { centerView, setTransform, instance } = useControls();

  // Not keyed on the handlers: useControls hands out new ones on every render, and every
  // render would snap the image back.
  useEffect(() => {
    if (fitWidth) {
      setTransform(0, 0, instance.state.scale, 0);
    } else if (splitView && splitViewOrientation === 'vertical') {
      setTransform(0, 0, 1, 0);
    } else {
      centerView(1, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitView, splitViewOrientation, loadedImage, fitWidth]);

  return null;
}

interface FacsimileImageViewProps {
  path: string;
  items: FacsimileItem[];
  currentItem: number;
  // The <surface> of each item, -1 for those not linked.
  itemSurfaces: number[];
  // Fits the image to the width of the view, as a cell of the grid of parts does.
  fitWidth: boolean;
  // The height the image is fitted to when not fitting the width.
  containerHeight: number;
  frame: FacsimileFrame | null;
  // Marks what sounds and travels with it.
  followsPlayback: boolean;
  onPartMoved: (surface: number) => void;
  onAspectRatio?: (aspectRatio: number | null) => void;
  transformRef?: Ref<ReactZoomPanPinchContentRef>;
}

function FacsimileImageView({ path, items, currentItem, itemSurfaces, fitWidth, containerHeight, frame,
  followsPlayback, onPartMoved, onAspectRatio, transformRef }: FacsimileImageViewProps) {
  const splitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const score = useStore.use.score();

  const links = score?.properties.facsimileLinks ?? null;
  const surface = itemSurfaces[currentItem] ?? -1;

  const [frameElement, setFrameElement] = useState<SVGRectElement | null>(null);
  const zoomedFrameSeqRef = useRef<number | null>(null);

  const { facsimileClickable, showInScore } = useFacsimileLinkHandler();
  const targets = useMemo(() => links == null ? [] : Object.entries(links.zones)
    .filter(([, zone]) => zone.surface === surface)
    .map(([id, zone]) => ({ id, zone })), [links, surface]);

  const partStaves = useMemo(() => {
    const part = items[currentItem]?.part;
    return part ? score?.properties.partStaves[part] ?? [] : null;
  }, [items, currentItem, score]);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageBox, setImageBox] = useState<ImageBox & { src: string } | null>(null);

  useEffect(() => {
    if (!image) {
      return;
    }
    const measure = () => {
      if (image.complete && image.naturalWidth > 0) {
        setImageBox({
          src: image.getAttribute("src") ?? "",
          left: image.offsetLeft,
          top: image.offsetTop,
          width: image.offsetWidth,
          height: image.offsetHeight,
        });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    image.addEventListener("load", measure);
    return () => {
      observer.disconnect();
      image.removeEventListener("load", measure);
    };
  }, [image]);

  const onImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    onAspectRatio?.(naturalHeight > 0 ? naturalWidth / naturalHeight : null);
  }, [onAspectRatio]);

  const isVerticalSplit = splitView && splitViewOrientation === 'vertical';
  const isHorizontalSplit = splitView && splitViewOrientation === 'horizontal';

  const minScale = fitWidth || isVerticalSplit ? 0.1 : 1;

  const transformKey = `transform-${splitView ? 'split' : 'tab'}-${splitViewOrientation}-${fitWidth ? 'width' : 'fit'}`;

  const imageFile = currentItem < items.length ? path + items[currentItem].file : '';
  const imageTitle = currentItem < items.length ? items[currentItem].name : '';

  // Measured on the image on show: a tab hidden until now still has the size of nothing,
  // and the marks laid over it would send the view astray.
  const imageShown = imageBox?.src === imageFile && imageBox.width > 0;

  const imageStyle = useMemo(() => {
    if (fitWidth || isVerticalSplit) {
      return { width: "100%", height: "auto" };
    } else if (isHorizontalSplit) {
      // Fit to both dimensions to maximize space usage
      return { maxWidth: "100%", maxHeight: `${containerHeight}px`, width: "auto", height: "auto" };
    } else {
      // Tab mode: fit to height
      return { height: `${containerHeight}px`, width: "auto" };
    }
  }, [fitWidth, isVerticalSplit, isHorizontalSplit, containerHeight]);

  const containerStyle = useMemo(() => {
    const baseStyle = {
      position: "relative" as const,
      boxSizing: "border-box" as const,
      width: "100%",
      height: "100%",
      padding: `${fitWidth ? CELL_IMAGE_PADDING : IMAGE_PADDING}px`
    };

    if (isHorizontalSplit && !fitWidth) {
      return {
        ...baseStyle,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        flexDirection: "column" as const
      };
    }
    return baseStyle;
  }, [fitWidth, isHorizontalSplit]);

  return (
    <TransformWrapper
      key={transformKey}
      ref={transformRef}
      minScale={minScale}
      maxScale={5}
      centerOnInit={!splitView && !fitWidth}
      limitToBounds={true}
      doubleClick={{
        disabled: false,
        mode: 'zoomIn',
        step: 0.5,
      }}
      // Multiplied by the event's deltaY, which is 100 or 120 for one notch of a mouse
      // wheel: a step in the order the buttons use would take a single notch to maxScale.
      wheel={{
        step: 0.002,
      }}
      panning={{
        excluded: [FACSIMILE_TARGET_CLASS],
      }}
    >
      <FacsimileViewReset loadedImage={imageBox?.src === imageFile ? imageFile : null} fitWidth={fitWidth} />
      <FacsimileFrameZoom frame={frameElement} seq={frame?.seq ?? null} zoomedSeqRef={zoomedFrameSeqRef} />
      <TransformComponent
        wrapperStyle={{ width: "100%", height: "100%", minHeight: 0 }}
        // The whole image fits in a horizontal split: the content takes the size of the
        // view, for the image to be centred in it by layout rather than by the transform.
        {...(isHorizontalSplit && !fitWidth ? { contentStyle: { width: "100%", height: "100%" } } : {})}>
        <div style={containerStyle}>
          <img ref={setImage} src={imageFile} alt={imageTitle} style={imageStyle} onLoad={onImageLoad} />
          {links && surface >= 0 && imageShown ? <>
            {followsPlayback ?
              <FacsimilePlayerOverlay links={links} surface={surface} box={imageBox}
                partStaves={partStaves} onPartMoved={onPartMoved} /> : null}
            {splitView && frame?.zones[0]?.surface === surface ?
              <FacsimileOverlay key={frame.seq} surface={links.surfaces[surface]} box={imageBox}
                frame={frame.zones} frameRef={setFrameElement} /> : null}
            {facsimileClickable ?
              <FacsimileOverlay surface={links.surfaces[surface]} box={imageBox}
                targets={targets} onTargetClick={showInScore} /> : null}
          </> : null}
        </div>
      </TransformComponent>
    </TransformWrapper>
  );
}

export default FacsimileImageView;
