import { useEffect, useState } from 'react';
import { Splitter } from 'antd';
import useStore from '../store';

interface SplitViewLayoutProps {
  scoreView: React.ReactNode;
  textView: React.ReactNode | null;
  introView: React.ReactNode | null;
  facsimileView: React.ReactNode | null;
  splitView: string | null;
  sizes: (number | string)[];
  setSizes: (sizes: (number | string)[]) => void;
  onResizeEnd: () => void;
  onContainerResize: (size: { width: number, height: number }) => void;
}

export default function SplitViewLayout({
  scoreView,
  textView,
  introView,
  facsimileView,
  splitView,
  sizes,
  setSizes,
  onResizeEnd,
  onContainerResize,
}: SplitViewLayoutProps) {

  const orientation = useStore.use.splitViewOrientation();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(() =>
      onContainerResize({ width: container.clientWidth, height: container.clientHeight }));
    observer.observe(container);
    return () => observer.disconnect();
  }, [container, onContainerResize]);

  const getSecondaryView = (): React.ReactNode => {
    if (splitView === "facsimile") {
      return facsimileView;
    } else if (splitView === "text") {
      return textView;
    } else if (splitView === "intro") {
      return introView;
    }
    return null;
  };

  return (
    <div ref={setContainer} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Splitter
        // antd (5.26) measures the container only from its ResizeObserver; a layout change
        // alone leaves the panels sized against the previous axis, so it must remount.
        key={orientation}
        orientation={orientation}
        onResize={setSizes}
        onResizeEnd={onResizeEnd}
        style={{ flex: 1, minHeight: 0, boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)' }}
      >
        <Splitter.Panel size={sizes[0]} resizable={true} className="score-splitter-panel">
          {scoreView}
        </Splitter.Panel>
        <Splitter.Panel size={sizes[1]}>
          {getSecondaryView()}
        </Splitter.Panel>
      </Splitter>
    </div>
  );
}

export { type SplitViewLayoutProps };
