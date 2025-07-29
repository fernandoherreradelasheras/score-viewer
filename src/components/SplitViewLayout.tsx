import { Splitter } from 'antd';

interface SplitViewLayoutProps {
  scoreView: React.ReactNode;
  textView: React.ReactNode | null;
  introView: React.ReactNode | null;
  facsimileView: React.ReactNode | null;
  activeSplitView: string | null;
  onSplitViewSelectorChanged: (key: string) => void;
  sizes: (number | string)[];
  setSizes: (sizes: (number | string)[]) => void;
  orientation: 'horizontal' | 'vertical';
}

export default function SplitViewLayout({
  scoreView,
  textView,
  introView,
  facsimileView,
  activeSplitView,
  sizes,
  setSizes,
  orientation
}: SplitViewLayoutProps) {


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
