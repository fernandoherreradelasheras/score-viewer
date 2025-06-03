import { Button, Pagination, Space } from 'antd';
import { FacsimileItem } from './types';
import { useCallback, useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';


function FacsimileView({ path, items }: { path: string, items: FacsimileItem[] }) {

  const [currentItem, setCurrentItem] = useState(0);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  const Controls = useCallback(()  => {
      const { zoomIn, zoomOut, resetTransform } = useControls();

      const handlePageClick = (page: number) => {
        setCurrentItem(page - 1)
        resetTransform()
      };

      return <div style={{ display: "flex", justifyContent: "space-between", padding: "12px" }}>
        <Space direction="horizontal" size={12} style={{ flex: "0", marginLeft: "12px" }}>
          <Button icon={<ZoomInOutlined />} onClick={() => zoomIn()}/>
          <Button icon={<ZoomOutOutlined />} onClick={() => zoomOut()}/>
          <Button onClick={() => resetTransform()}>Reset</Button>
        </Space>
         { items.length > 1 ?  <Pagination
                  style={{ flex: "1", textAlign: "center" }}
                  align="center"
                  current={currentItem + 1}
                  defaultPageSize={1}
                  total={items.length}
                  simple={false}
                  onChange={handlePageClick} /> : null }
      </div>
  }, [items, currentItem]);


  useEffect(() => {
    if (container) {
      const { top } = container.getBoundingClientRect();
      const height = window.innerHeight - top - 24;
      setContainerHeight(height);
    }
  }, [container])

  useEffect(() => {
    setCurrentItem(0)
  }, [items])

  return (
      <TransformWrapper initialScale={1}  >
          <>
            <Controls />
            <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}>
                <div style={{ width: "100%", height: "100%", padding: "12px" }}  ref={(el: HTMLDivElement | null) => setContainer(el)}>
                  <img src={path + items[currentItem].file} alt={items[currentItem].name} style={{height: `${containerHeight}px`, width: "auto" }}/>
                </div>
            </TransformComponent>
          </>
      </TransformWrapper>
  );
}

export default FacsimileView;