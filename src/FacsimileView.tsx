import { Button, Segmented, Space, Typography } from 'antd';
import { FacsimileItem, PlayingState } from './types';
import useStore, { FacsimileLayout } from "./store";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import { CloseOutlined, ColumnWidthOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FacsimileImageView, { FacsimileFrame } from './components/FacsimileImageView';
import FacsimilePagination from './components/FacsimilePagination';
import { bestFacsimileGrid, matchFacsimileSurface } from './utils/facsimile';

const IMAGE_PADDING = 12;
const CELL_GAP = 4;
const CELL_HEADER_HEIGHT = 32;
// Until the images say otherwise: a portrait page.
const DEFAULT_ASPECT_RATIO = 1 / 1.41;

// What each view shows: every image, or the images of one part.
type FacsimileViewSet = { part: string | null, items: FacsimileItem[] };


function FacsimileView({ path, items }: { path: string, items: FacsimileItem[] }) {
  const { t } = useTranslation("common");
  const splitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const setSplitView = useStore.use.setIsSplitView();
  const setLayoutHint = useStore.use.setSecondaryViewLayoutHint();
  const facsimileLayout = useStore.use.facsimileLayout();
  const setFacsimileLayout = useStore.use.setFacsimileLayout();
  const score = useStore.use.score();
  const playingState = useStore.use.playingState();
  const facsimileFocus = useStore.use.facsimileFocus();
  const setIsFacsimileLinked = useStore.use.setIsFacsimileLinked();

  const links = score?.properties.facsimileLinks ?? null;

  const parts = useMemo(() =>
    [...new Set(items.flatMap(item => item.part ? [item.part] : []))], [items]);
  const allParts = parts.length > 1 && facsimileLayout === 'all';

  // Images without a part, of the full score, have no cell of their own among the parts.
  const views: FacsimileViewSet[] = useMemo(() => allParts
    ? parts.map(part => ({ part, items: items.filter(item => item.part === part) }))
    : [{ part: null, items }], [allParts, parts, items]);

  const viewSurfaces = useMemo(() => views.map(view =>
    view.items.map(item => links ? matchFacsimileSurface(item, links.surfaces) : -1)), [views, links]);

  const [currentItems, setCurrentItems] = useState<number[]>(() => views.map(() => 0));
  const [frame, setFrame] = useState<{ view: number } & FacsimileFrame | null>(null);
  const [aspectRatios, setAspectRatios] = useState<(number | null)[]>([]);

  // Another set of images, or another layout, starts again at the first page of each
  // view. Adjusted while rendering rather than in an effect so the previous pages are
  // never painted with the new set.
  const [renderedViews, setRenderedViews] = useState(views);
  if (views !== renderedViews) {
    setRenderedViews(views);
    setCurrentItems(views.map(() => 0));
    setAspectRatios([]);
    setFrame(null);
  }

  const selectItem = useCallback((view: number, item: number) => {
    setCurrentItems(current => current.map((value, i) => i === view ? item : value));
    setFrame(null);
  }, []);

  const isLinked = splitView && viewSurfaces.some(surfaces => surfaces.some(s => s >= 0));
  useEffect(() => {
    setIsFacsimileLinked(isLinked);
  }, [isLinked, setIsFacsimileLinked]);
  useEffect(() => () => setIsFacsimileLinked(false), [setIsFacsimileLinked]);

  // The notes asked for, framed on the image that holds the first of them: the one on
  // show if it does, the first one that does otherwise. Those on other images are left
  // out. Taken on while rendering, like the views above, so the image is switched before
  // the previous one is painted with the frame.
  const [renderedFocus, setRenderedFocus] = useState(facsimileFocus);
  if (facsimileFocus !== renderedFocus) {
    setRenderedFocus(facsimileFocus);
    const zones = (facsimileFocus?.elementIds ?? []).flatMap(id => links?.zones[id] ?? []);
    const zoneSurface = zones[0]?.surface;
    const shown = viewSurfaces.findIndex((surfaces, view) => surfaces[currentItems[view]] === zoneSurface);
    const view = shown >= 0 ? shown : viewSurfaces.findIndex(surfaces => surfaces.includes(zoneSurface ?? -1));
    if (facsimileFocus && zoneSurface != null && view >= 0) {
      const item = shown >= 0 ? currentItems[view] : viewSurfaces[view].indexOf(zoneSurface);
      setCurrentItems(current => current.map((value, i) => i === view ? item : value));
      setFrame({ view, zones: zones.filter(zone => zone.surface === zoneSurface), seq: facsimileFocus.seq });
    }
  }
  if (frame && playingState === PlayingState.PLAYING) {
    setFrame(null);
  }

  // Only to another image of the same part, or of the full score for one of it: which
  // part the reader follows is theirs.
  const followPart = useCallback((view: number, toSurface: number) => {
    const viewItems = views[view].items;
    const part = viewItems[currentItems[view]]?.part;
    const item = viewItems.findIndex((candidate, i) => viewSurfaces[view][i] === toSurface && candidate.part === part);
    if (item >= 0) {
      setCurrentItems(current => current.map((value, i) => i === view ? item : value));
    }
  }, [views, viewSurfaces, currentItems]);

  const onAspectRatio = useCallback((view: number, aspectRatio: number | null) => {
    setAspectRatios(current => {
      const next = [...current];
      next[view] = aspectRatio;
      return next;
    });
  }, []);

  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [controlsRow, setControlsRow] = useState<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!root || !controlsRow) {
      return;
    }

    const measure = () => {
      const available = splitView
        ? root.clientHeight - controlsRow.offsetHeight
        : window.innerHeight - root.getBoundingClientRect().top - controlsRow.offsetHeight;
      setContainerHeight(Math.max(0, available - 2 * IMAGE_PADDING));
      setContainerWidth(root.clientWidth);
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

  // The split view is sized after the one image on show; the grid of parts fits in
  // whatever it is given.
  const singleAspectRatio = allParts ? null : aspectRatios[0] ?? null;
  useEffect(() => {
    if (!controlsRow || allParts) {
      return;
    }
    setLayoutHint(singleAspectRatio == null ? null
      : { aspectRatio: singleAspectRatio, chromeHeight: controlsRow.offsetHeight + 2 * IMAGE_PADDING });
  }, [singleAspectRatio, allParts, controlsRow, setLayoutHint]);

  useEffect(() => () => setLayoutHint(null), [setLayoutHint]);

  // The zoom of each view, for the buttons that drive it. Held in state, not a ref: the
  // views register into it as they mount.
  const [transforms] = useState(() => new Map<number, ReactZoomPanPinchContentRef>());

  const registerTransform = useCallback((view: number, ref: ReactZoomPanPinchContentRef | null) => {
    if (ref) {
      transforms.set(view, ref);
    } else {
      transforms.delete(view);
    }
  }, [transforms]);

  const viewHandlers = useMemo(() => views.map((_, view) => ({
    onAspectRatio: (aspectRatio: number | null) => onAspectRatio(view, aspectRatio),
    transformRef: (ref: ReactZoomPanPinchContentRef | null) => registerTransform(view, ref),
  })), [views, onAspectRatio, registerTransform]);

  // A cell of the grid starts over fitting its width, from the top of its image.
  const resetView = (view: number) => allParts
    ? transforms.get(view)?.setTransform(0, 0, 1)
    : transforms.get(view)?.centerView(1, 0);
  const resetViews = () => transforms.forEach((_, view) => resetView(view));

  const grid = useMemo(() => {
    const known = aspectRatios.filter((ratio): ratio is number => ratio != null);
    const aspectRatio = known.length > 0 ? known.reduce((sum, ratio) => sum + ratio, 0) / known.length : DEFAULT_ASPECT_RATIO;
    return bestFacsimileGrid(views.length, containerWidth, containerHeight + 2 * IMAGE_PADDING, aspectRatio, CELL_HEADER_HEIGHT);
  }, [aspectRatios, views.length, containerWidth, containerHeight]);

  const imageView = (view: number) =>
    <FacsimileImageView
      path={path}
      items={views[view].items}
      currentItem={currentItems[view] ?? 0}
      itemSurfaces={viewSurfaces[view]}
      fitWidth={allParts}
      containerHeight={containerHeight}
      frame={frame?.view === view ? frame : null}
      onPartMoved={surface => followPart(view, surface)}
      {...viewHandlers[view]} />

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      minHeight: 0,
      overflow: "hidden"
    }}
      ref={setRoot}>
      <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
        ref={setControlsRow}>
        <Space orientation="horizontal" size={12} style={{ flex: "0", marginLeft: "12px" }}>
          {!allParts ? <>
            <Button icon={<ZoomInOutlined />} onClick={() => transforms.get(0)?.zoomIn()} />
            <Button icon={<ZoomOutOutlined />} onClick={() => transforms.get(0)?.zoomOut()} />
          </> : null}
          <Button onClick={resetViews}>{t('reset')}</Button>
        </Space>
        {!allParts && items.length > 1 ?
          <FacsimilePagination style={{ flex: "1", textAlign: "center" }} path={path} items={items}
            currentItem={currentItems[0] ?? 0} onItemSelected={item => selectItem(0, item)} />
          : <div style={{ flex: 1 }} />}
        {parts.length > 1 ?
          <Segmented<FacsimileLayout> size="small" value={facsimileLayout} onChange={setFacsimileLayout}
            options={[
              { label: t('facsimileView.singlePart'), value: 'single' },
              { label: t('facsimileView.allParts'), value: 'all' },
            ]} /> : null}
        {splitView ? <Button icon={<CloseOutlined />} onClick={() => setSplitView(false)}
          disabled={playingState === PlayingState.PLAYING} /> : null}
      </div>
      {allParts ?
        <div style={{
          flex: "1 1 auto",
          minHeight: 0,
          height: splitView ? undefined : containerHeight + 2 * IMAGE_PADDING,
          display: "grid",
          gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          gap: CELL_GAP,
        }}>
          {views.map((view, index) =>
            <div key={view.part} style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
              <div style={{ flex: "0 0 auto", height: CELL_HEADER_HEIGHT, display: "flex", alignItems: "center", gap: 8, paddingInline: 8 }}>
                <Typography.Text strong ellipsis style={{ flex: "0 0 auto", maxWidth: "50%" }}>
                  {(view.part && score?.properties.partLabels[view.part]) || view.items[0]?.name}
                </Typography.Text>
                {view.items.length > 1 ?
                  <FacsimilePagination small style={{ flex: "0 1 auto", minWidth: 0 }} path={path} items={view.items}
                    currentItem={currentItems[index] ?? 0} onItemSelected={item => selectItem(index, item)} />
                  : null}
                <div style={{ flex: 1 }} />
                <Space size={2}>
                  <Button size="small" type="text" icon={<ZoomInOutlined />} onClick={() => transforms.get(index)?.zoomIn()} />
                  <Button size="small" type="text" icon={<ZoomOutOutlined />} onClick={() => transforms.get(index)?.zoomOut()} />
                  <Button size="small" type="text" icon={<ColumnWidthOutlined />} title={t('reset')}
                    onClick={() => resetView(index)} />
                </Space>
              </div>
              <div style={{ flex: "1 1 auto", minHeight: 0 }}>
                {imageView(index)}
              </div>
            </div>)}
        </div>
        :
        <div style={{ flex: "1 1 auto", minHeight: 0 }}>
          {imageView(0)}
        </div>}
    </div>
  );
}

export default FacsimileView;
