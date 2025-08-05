import { useMemo } from 'react';
import { Space, Pagination, Button, Col, Row } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, FullscreenExitOutlined, DownloadOutlined } from '@ant-design/icons';
import { PlayingState } from './types';
import PlayerControls from './PlayerControls';
import useScoreControls from './hooks/useScoreControls';
import { useTranslation } from 'react-i18next';
import useStore from './store';

export enum PlayerControlEventType {
    SEEK,
}

export type PlayerControlEvent = {
    type: PlayerControlEventType,
    value?: any
}

interface ScoreControlProps {
    style?: React.CSSProperties | undefined;
    fullScreenElement: HTMLElement | null;
    showDownloadButton?: boolean | undefined;
    audioDuration: number;
}

const ScoreControls = ({ style, fullScreenElement, showDownloadButton, audioDuration }: ScoreControlProps) => {
    const { t } = useTranslation("common")
  const splitView = useStore.use.isSplitView();

    // Use our custom hook for all score controls logic
    const {
        // State and derived state
        currentPageNumber,
        scoreUrl,
        pageCount,
        playingState,
        shouldShowPagination,
        isFullScreen,
        canZoomIn,
        canZoomOut,

        // Functions
        handlePageClick,
        zoomIn,
        zoomOut,
        handleFullScreenToggle,
    } = useScoreControls(fullScreenElement);


    const mainControls = useMemo(() => (
        <Space direction='horizontal'>
            <Button shape="circle" icon={<ZoomOutOutlined />} onClick={zoomOut} disabled={!canZoomOut} />
            <Button shape="circle" icon={<ZoomInOutlined />} onClick={zoomIn} disabled={!canZoomIn} />
            <Button
                icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={handleFullScreenToggle}
                disabled={playingState === PlayingState.PLAYING} />


            {showDownloadButton ?
                <Button type="default" icon={<DownloadOutlined />} download href={scoreUrl || ''}>MEI</Button> : null}

        </Space>
    ), [canZoomIn, canZoomOut, playingState, isFullScreen, scoreUrl, t]);

    const pagination = useMemo(() => (
        shouldShowPagination ?
            <Pagination
                disabled={playingState === PlayingState.PLAYING}
                align="center"
                current={currentPageNumber}
                defaultPageSize={1}
                total={pageCount}
                simple={false}
                onChange={handlePageClick} />
            : null
    ), [shouldShowPagination, playingState, currentPageNumber, pageCount]);

    const viewingControls = useMemo(() => {
        return <Row style={{ justifyContent: "left", backgroundColor: "white" }} gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
            <Col xxl={8} xl={14} lg={8} md={10} sm={12} xs={14} >
                {mainControls}
            </Col>
            <Col xxl={12} xl={10} lg={14} md={14} sm={20} xs={24} >
                {pagination}
            </Col>
        </Row>
    }, [mainControls, pagination, splitView]);

    return (
        <div className="score-controls" style={style} >

            {playingState === PlayingState.STOPPED ?
                viewingControls : <PlayerControls audioDuration={audioDuration} />}
        </div>
    );
};

export default ScoreControls;
