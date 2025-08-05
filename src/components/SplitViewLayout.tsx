import { Splitter } from 'antd';
import useStore from '../store';

interface SplitViewLayoutProps {
  scoreView: React.ReactNode;
  textView: React.ReactNode | null;
  introView: React.ReactNode | null;
  facsimileView: React.ReactNode | null;
  sizes: (number | string)[];
  setSizes: (sizes: (number | string)[]) => void;
}

export default function SplitViewLayout({
  scoreView,
  textView,
  introView,
  facsimileView,
  sizes,
  setSizes,
}: SplitViewLayoutProps) {

  const activeSplitView = useStore.use.activeSplitView();
  const orientation = useStore.use.splitViewOrientation();

  const getSecondaryView = (): React.ReactNode => {
    if (activeSplitView === "facsimile") {
      return facsimileView;
    } else if (activeSplitView === "text") {
      return textView;
    } else if (activeSplitView === "intro") {
      return introView;
    }
    return null;
  };

  return (
    <>
      <Splitter
        layout={orientation}
        onResize={setSizes}
        style={{ height: "100%", boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)' }}
      >
        <Splitter.Panel size={sizes[0]} resizable={true}>
          {scoreView}
        </Splitter.Panel>
        <Splitter.Panel size={sizes[1]}>
          {getSecondaryView()}
        </Splitter.Panel>
      </Splitter>
    </>
  );
}

export { type SplitViewLayoutProps };
