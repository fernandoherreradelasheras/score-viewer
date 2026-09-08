import { cloneElement, useMemo, useState } from 'react';
import { Space, Pagination, Button, Col, Row, Tooltip } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, FullscreenExitOutlined, ProfileOutlined } from '@ant-design/icons';
import { PlayingState } from './types';
import PlayerControls from './PlayerControls';
import useScoreControls from './hooks/useScoreControls';
import { useTranslation } from 'react-i18next';
import useStore from './store';
import ScoreInfo from './components/ScoreInfo';
import PagePreview from './components/PagePreview';

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
    const score = useStore.use.score();

    const [showScoreInfo, setShowScoreInfo] = useState(false);

    // Use our custom hook for all score controls logic
    const {
        // State and derived state
        currentPageNumber,
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

            <Tooltip title={t('scoreInfo.button')}>
                <Button
                    icon={<ProfileOutlined />}
                    onClick={() => setShowScoreInfo(true)}
                    disabled={!score} >{t('scoreInfo.button')}</Button>
            </Tooltip>

        </Space>
    ), [canZoomIn, canZoomOut, playingState, isFullScreen, score, t]);

    const pagination = useMemo(() => (
        shouldShowPagination ?
            <Pagination
                disabled={playingState === PlayingState.PLAYING}
                align="center"
                current={currentPageNumber}
                defaultPageSize={1}
                total={pageCount}
                simple={false}
                showTitle={false}
                itemRender={(page, type, element) => {
                    if (type === 'page') {
                        return <PagePreview page={page}>{element}</PagePreview>
                    }
                    if (type === 'prev' || type === 'next') {
                        return cloneElement(element as React.ReactElement<{ title?: string }>,
                            { title: t(type === 'prev' ? 'pagination.previousPage' : 'pagination.nextPage') })
                    }
                    return element;
                }}
                onChange={handlePageClick} />
            : null
    ), [shouldShowPagination, playingState, currentPageNumber, pageCount, t]);

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

            <ScoreInfo
                open={showScoreInfo}
                onClose={() => setShowScoreInfo(false)}
                showDownload={showDownloadButton ?? false} />
        </div>
    );
};

export default ScoreControls;
