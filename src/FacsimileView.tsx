import { Button, Pagination, Space } from 'antd';
import { FacsimileItem, FacsimileZone, PlayingState } from './types';
import useStore from "./store";
import { cloneElement, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FacsimilePreview from './components/FacsimilePreview';
import FacsimileOverlay, { ImageBox } from './components/FacsimileOverlay';
import FacsimilePlayerOverlay from './components/FacsimilePlayerOverlay';
import { matchFacsimileSurface } from './utils/facsimile';

const IMAGE_PADDING = 12;
const FRAME_ZOOM_SCALE = 2;
const FRAME_ZOOM_ANIMATION_MS = 300;

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

// A component of its own because useControls only works under TransformWrapper.
function FacsimileControls({ path, items, currentItem, onPageSelected }:
  { path: string, items: FacsimileItem[], currentItem: number, onPageSelected: (item: number) => void }) {
  const { t } = useTranslation("common");
  const splitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const setSplitView = useStore.use.setIsSplitView();
  const playingState = useStore.use.playingState();

  const { zoomIn, zoomOut, centerView } = useControls();

  const fitToContainer = () => centerView(1, 0);

  const handlePageClick = (page: number) => {
    onPageSelected(page - 1)
    fitToContainer()
  };

  // Not keyed on centerView: useControls hands out new handlers on every render, and
  // every render would snap the image back to 1:1.
  useEffect(() => {
    centerView(1, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitView, splitViewOrientation, currentItem]);

  return <div style={{ display: "flex", justifyContent: "space-between" }}>
    <Space orientation="horizontal" size={12} style={{ flex: "0", marginLeft: "12px" }}>
      <Button icon={<ZoomInOutlined />} onClick={() => zoomIn()} />
      <Button icon={<ZoomOutOutlined />} onClick={() => zoomOut()} />
      <Button onClick={() => fitToContainer()}>{t('reset')}</Button>
    </Space>
    {items.length > 1 ? <Pagination
      style={{ flex: "1", textAlign: "center" }}
      align="center"
      current={currentItem + 1}
      defaultPageSize={1}
      total={items.length}
      simple={false}
      showTitle={false}
      itemRender={(page, type, element) => {
        if (type === 'page' && items[page - 1]) {
          return <FacsimilePreview
            page={page}
            name={items[page - 1].name}
            src={path + items[page - 1].file}>{element}</FacsimilePreview>
        }
        if (type === 'prev' || type === 'next') {
          return cloneElement(element as React.ReactElement<{ title?: string }>,
            { title: t(type === 'prev' ? 'pagination.previousPage' : 'pagination.nextPage') })
        }
        return element;
      }}
      onChange={handlePageClick} /> : null}
    {splitView ? <Button icon={<CloseOutlined />} onClick={() => setSplitView(false)}
      disabled={playingState === PlayingState.PLAYING} /> : null}

  </div>
}


function FacsimileView({ path, items }: { path: string, items: FacsimileItem[] }) {
  const splitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const setLayoutHint = useStore.use.setSecondaryViewLayoutHint();
  const score = useStore.use.score();
  const playingState = useStore.use.playingState();
  const facsimileFocus = useStore.use.facsimileFocus();
  const setIsFacsimileLinked = useStore.use.setIsFacsimileLinked();

  const links = score?.properties.facsimileLinks ?? null;

  const [currentItem, setCurrentItem] = useState(0);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [controlsRow, setControlsRow] = useState<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);


  useEffect(() => {
    if (!root || !controlsRow) {
      return;
    }

    const measure = () => {
      const available = splitView
        ? root.clientHeight - controlsRow.offsetHeight
        : window.innerHeight - root.getBoundingClientRect().top - controlsRow.offsetHeight;
      setContainerHeight(Math.max(0, available - 2 * IMAGE_PADDING));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(controlsRow);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [root, controlsRow, splitView, splitViewOrientation])

  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  const [frame, setFrame] = useState<{ zones: FacsimileZone[], seq: number } | null>(null);

  // A different set of images starts again at its first page, adjusted while rendering
  // rather than in an effect so the previous page is never painted with the new set.
  const [renderedItems, setRenderedItems] = useState(items);
  if (items !== renderedItems) {
    setRenderedItems(items);
    setCurrentItem(0);
    setImageAspectRatio(null);
    setFrame(null);
  }

  const itemSurfaces = useMemo(() =>
    items.map(item => links ? matchFacsimileSurface(item, links.surfaces) : -1), [items, links]);
  const surface = itemSurfaces[currentItem] ?? -1;

  const isLinked = splitView && itemSurfaces.some(s => s >= 0);
  useEffect(() => {
    setIsFacsimileLinked(isLinked);
  }, [isLinked, setIsFacsimileLinked]);
  useEffect(() => () => setIsFacsimileLinked(false), [setIsFacsimileLinked]);

  // The notes asked for, framed on the image that holds the first of them: the one on
  // show if it does, the first one that does otherwise. Those on other images are left
  // out. Taken on while rendering, like the items above, so the image is switched before
  // the previous one is painted with the frame.
  const [renderedFocus, setRenderedFocus] = useState(facsimileFocus);
  if (facsimileFocus !== renderedFocus) {
    setRenderedFocus(facsimileFocus);
    const zones = (facsimileFocus?.elementIds ?? []).flatMap(id => links?.zones[id] ?? []);
    const zoneSurface = zones[0]?.surface;
    const item = zoneSurface == null ? -1 : surface === zoneSurface ? currentItem : itemSurfaces.indexOf(zoneSurface);
    if (facsimileFocus && item >= 0) {
      setCurrentItem(item);
      setFrame({ zones: zones.filter(zone => zone.surface === zoneSurface), seq: facsimileFocus.seq });
    }
  }
  if (frame && playingState === PlayingState.PLAYING) {
    setFrame(null);
  }

  const [frameElement, setFrameElement] = useState<SVGRectElement | null>(null);
  const zoomedFrameSeqRef = useRef<number | null>(null);

  const selectItem = useCallback((item: number) => {
    setCurrentItem(item);
    setFrame(null);
  }, []);

  const partStaves = useMemo(() => {
    const part = items[currentItem]?.part;
    return (part && score?.properties.partStaves[part]) || [];
  }, [items, currentItem, score]);

  // Only to another image of the same part: which part the reader follows is theirs.
  const followPart = useCallback((toSurface: number) => {
    const part = items[currentItem]?.part;
    const item = items.findIndex((candidate, i) => itemSurfaces[i] === toSurface && candidate.part === part);
    if (part && item >= 0) {
      setCurrentItem(item);
    }
  }, [items, currentItem, itemSurfaces]);

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
    setImageAspectRatio(naturalHeight > 0 ? naturalWidth / naturalHeight : null);
  }, []);

  useEffect(() => {
    if (!controlsRow) {
      return;
    }
    setLayoutHint(imageAspectRatio == null ? null
      : { aspectRatio: imageAspectRatio, chromeHeight: controlsRow.offsetHeight + 2 * IMAGE_PADDING });
  }, [imageAspectRatio, controlsRow, setLayoutHint]);

  useEffect(() => () => setLayoutHint(null), [setLayoutHint]);

  const minScale = splitView && splitViewOrientation === 'vertical' ? 0.1 : 1;

  const transformKey = useMemo(() =>
    `transform-${splitView ? 'split' : 'tab'}-${splitViewOrientation}`,
    [splitView, splitViewOrientation]
  );

  const imageFile = useMemo(() => currentItem < items.length ? path + items[currentItem].file : ''
    , [currentItem, items, path]);

  const imageTitle = useMemo(() => currentItem < items.length ? items[currentItem].name : ''
    , [currentItem, items]);

  const imageStyle = useMemo(() => {
    const isVerticalSplit = splitView && splitViewOrientation === 'vertical';
    const isHorizontalSplit = splitView && splitViewOrientation === 'horizontal';

    if (isVerticalSplit) {
      // Vertical split: fit to width, allow height to extend
      return { width: "100%", height: "auto" };
    } else if (isHorizontalSplit) {
      // Horizontal split: fit to both dimensions to maximize space usage
      return { maxWidth: "100%", maxHeight: `${containerHeight}px`, width: "auto", height: "auto" };
    } else {
      // Tab mode: fit to height
      return { height: `${containerHeight}px`, width: "auto" };
    }
  }, [splitView, splitViewOrientation, containerHeight]);

  const shouldCenterOnInit = useMemo(() => {
    const isVerticalSplit = splitView && splitViewOrientation === 'vertical';
    const isHorizontalSplit = splitView && splitViewOrientation === 'horizontal';

    return !isVerticalSplit && !isHorizontalSplit;
  }, [splitView, splitViewOrientation]);

  const containerStyle = useMemo(() => {
    const isHorizontalSplit = splitView && splitViewOrientation === 'horizontal';

    const baseStyle = {
      position: "relative" as const,
      width: "100%",
      height: "100%",
      padding: `${IMAGE_PADDING}px`
    };

    if (isHorizontalSplit) {
      return {
        ...baseStyle,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        flexDirection: "column" as const
      };
    } else {
      return baseStyle;
    }
  }, [splitView, splitViewOrientation]);

  return (
    <TransformWrapper
      key={transformKey}
      minScale={minScale}
      maxScale={5}
      centerOnInit={shouldCenterOnInit}
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
    >
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        overflow: "hidden"
      }}
        ref={(el: HTMLDivElement | null) => setRoot(el)}>
        <div style={{ flex: "0 0 auto" }} ref={(el: HTMLDivElement | null) => setControlsRow(el)}>
          <FacsimileControls path={path} items={items} currentItem={currentItem}
            onPageSelected={selectItem} />
        </div>
        <FacsimileFrameZoom frame={frameElement} seq={frame?.seq ?? null} zoomedSeqRef={zoomedFrameSeqRef} />
        <TransformComponent
          wrapperStyle={{ width: "100%", flex: "1 1 auto", minHeight: 0 }}>
          <div style={containerStyle}>
            <img ref={setImage} src={imageFile} alt={imageTitle} style={imageStyle} onLoad={onImageLoad} />
            {links && surface >= 0 && splitView && imageBox?.src === imageFile ? <>
              <FacsimilePlayerOverlay links={links} surface={surface} box={imageBox}
                partStaves={partStaves} onPartMoved={followPart} />
              {frame?.zones[0]?.surface === surface ?
                <FacsimileOverlay surface={links.surfaces[surface]} box={imageBox}
                  frame={frame.zones} frameRef={setFrameElement} /> : null}
            </> : null}
          </div>
        </TransformComponent>
      </div>
    </TransformWrapper>
  );
}

export default FacsimileView;
