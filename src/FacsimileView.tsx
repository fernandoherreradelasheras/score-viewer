import { Button, Pagination, Space } from 'antd';
import { FacsimileItem, PlayingState } from './types';
import useStore from "./store";
import { cloneElement, useCallback, useEffect, useMemo, useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FacsimilePreview from './components/FacsimilePreview';

const IMAGE_PADDING = 12;

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

  useEffect(() => {
    centerView(1, 0);
  }, [splitView, splitViewOrientation, centerView]);

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

  const minScale = splitView && splitViewOrientation === 'vertical' ? 0.1 : 1;

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
            onPageSelected={setCurrentItem} />
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
