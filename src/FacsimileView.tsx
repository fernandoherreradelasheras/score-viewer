import { Button, Pagination, Space } from 'antd';
import { FacsimileItem } from './types';
import useStore from "./store";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { CloseOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// Room left around the image inside its container
const IMAGE_PADDING = 12;

function FacsimileView({ path, items }: { path: string, items: FacsimileItem[] }) {
  const { t } = useTranslation("common");
  const splitView = useStore.use.isSplitView();
  const splitViewOrientation = useStore.use.splitViewOrientation();
  const setSplitView = useStore.use.setIsSplitView();

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
      <Space direction="horizontal" size={12} style={{ flex: "0", marginLeft: "12px" }}>
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
        onChange={handlePageClick} /> : null}
      {splitView ? <Button icon={<CloseOutlined />} onClick={() => close()} /> : null}

    </div>
  }, [items, currentItem, splitView, splitViewOrientation, close, t, setSplitView]);


  // How much room is left for the image once the controls row has taken its own. A split
  // view panel has a height of its own, so it can be measured; a tab pane instead grows
  // with its content, and measuring it would only give back the height of the image
  // already in it, so there the fit is computed against the bottom of the window.
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

  useEffect(() => {
    setCurrentItem(0)
  }, [items])

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

  const initialScale = useMemo(() => {
    const isVerticalSplit = splitView && splitViewOrientation === 'vertical';
    return isVerticalSplit ? 0.7 : 1;
  }, [splitView, splitViewOrientation]);

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
      initialScale={initialScale}
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
      {/* The zoomable area takes the room the controls row leaves, and no more: given a
          height of its own it would add up with that row to more than the split view
          panel holds, and the panel would scroll the controls out of sight. */}
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
            <img src={imageFile} alt={imageTitle} style={imageStyle} />
          </div>
        </TransformComponent>
      </div>
    </TransformWrapper>
  );
}

export default FacsimileView;
