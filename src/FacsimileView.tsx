import { Button, Pagination, Space } from 'antd';
import { FacsimileItem, PlayingState } from './types';
import useStore from "./store";
import { cloneElement, useCallback, useEffect, useMemo, useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FacsimilePreview from './components/FacsimilePreview';

const IMAGE_PADDING = 12;

function FacsimileView({ path, items }: { path: string, items: FacsimileItem[] }) {
  const { t } = useTranslation("common");
  const splitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const setSplitView = useStore.use.setIsSplitView();
  const playingState = useStore.use.playingState();
  const setLayoutHint = useStore.use.setSecondaryViewLayoutHint();

  const [currentItem, setCurrentItem] = useState(0);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [controlsRow, setControlsRow] = useState<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  const Controls = useCallback(() => {
    const { zoomIn, zoomOut, resetTransform } = useControls();

    const handlePageClick = (page: number) => {
      setCurrentItem(page - 1)
      resetTransform()
    };

    const close = useCallback(() => {
      setSplitView(false);
    }, [setSplitView]);

    useEffect(() => {
      resetTransform();
    }, [splitView, splitViewOrientation, resetTransform]);

    return <div style={{ display: "flex", justifyContent: "space-between" }}>
      <Space orientation="horizontal" size={12} style={{ flex: "0", marginLeft: "12px" }}>
        <Button icon={<ZoomInOutlined />} onClick={() => zoomIn()} />
        <Button icon={<ZoomOutOutlined />} onClick={() => zoomOut()} />
        <Button onClick={() => resetTransform()}>{t('reset')}</Button>
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
      {splitView ? <Button icon={<CloseOutlined />} onClick={() => close()}
        disabled={playingState === PlayingState.PLAYING} /> : null}

    </div>
  }, [items, path, currentItem, splitView, splitViewOrientation, playingState, close, t, setSplitView]);


  // A tab pane grows with its content, so measuring it would only give back the height of
  // the image already in it; the window is what bounds the image there.
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

  // The image's own proportion, declared for the split layout as soon as it is known:
  // the layout cannot measure what a panel would leave empty without first drawing it.
  // Withdrawn when the set of images changes, so the layout does not act on the old one.
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setCurrentItem(0)
    setImageAspectRatio(null)
  }, [items])

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

  const transformKey = useMemo(() =>
    `transform-${splitView ? 'split' : 'tab'}-${splitViewOrientation}`,
    [splitView, splitViewOrientation]
  );

  const imageFile = useMemo(() => currentItem < items.length ? path + items[currentItem].file : ''
    , [currentItem, items]);

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
      minScale={0.1}
      maxScale={5}
      centerOnInit={shouldCenterOnInit}
      limitToBounds={true}
      doubleClick={{
        disabled: false,
        mode: 'zoomIn',
        step: 0.5,
      }}
      wheel={{
        step: 0.1,
      }}
    >
      {/* With a height of its own the zoomable area would add up with the controls row to
          more than the split view panel holds, and the panel would scroll them away. */}
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
          <Controls />
        </div>
        <TransformComponent
          wrapperStyle={{ width: "100%", flex: "1 1 auto", minHeight: 0 }}>
          <div style={containerStyle}>
            <img src={imageFile} alt={imageTitle} style={imageStyle} onLoad={onImageLoad} />
          </div>
        </TransformComponent>
      </div>
    </TransformWrapper>
  );
}

export default FacsimileView;
