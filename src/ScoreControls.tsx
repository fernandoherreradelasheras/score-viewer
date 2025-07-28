import { useMemo } from 'react';
import { Space, Pagination, Button, Col, Row } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, FullscreenExitOutlined, DownloadOutlined } from '@ant-design/icons';
import { PlayingState } from './types';
import ScoreOptionsPanel from './ScoreOptionsPanel';
import PlayerControls from './PlayerControls';
import useScoreControls from './hooks/useScoreControls';
import { useTranslation } from 'react-i18next';

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
    allowUserLanguageChange: boolean;
    audioDuration: number;
}

const ScoreControls = ({ style, fullScreenElement, showDownloadButton, audioDuration, allowUserLanguageChange }: ScoreControlProps) => {
    const { t } = useTranslation("common")

    // Use our custom hook for all score controls logic
    const {
        // State and derived state
        currentPageNumber,
        scoreUrl,
        pageCount,
        playingState,
        openDrawer,
        shouldShowPagination,
        isFullScreen,
        canZoomIn,
        canZoomOut,

        // Functions
        handlePageClick,
        zoomIn,
        zoomOut,
        handleFullScreenToggle,
        showDrawer,
        onDrawserClose,
    } = useScoreControls(fullScreenElement);


    const mainControls = useMemo(() => (
        <Space direction='horizontal'>
            <Button shape="circle" icon={<ZoomOutOutlined />} onClick={zoomOut} disabled={!canZoomOut} />
            <Button shape="circle" icon={<ZoomInOutlined />} onClick={zoomIn} disabled={!canZoomIn} />
            <Button
                icon={isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={handleFullScreenToggle}
                disabled={playingState === PlayingState.PLAYING} />
            <Button
                onClick={showDrawer}
                disabled={playingState === PlayingState.PLAYING}>{t('scoreControls.options')}</Button>

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

    const viewingControls = useMemo(() => (
        <Row style={{ justifyContent: "left", backgroundColor: "white" }} gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
                <Col xxl={4} xl={6} lg={8} md={10} sm={12} xs={14} >
                    {mainControls}
                </Col>
                <Col xxl={12} xl={12} lg={14} md={14} sm={20} xs={24} >
                    {pagination}
                </Col>
            </Row>
    ), [mainControls, pagination]);

    return (
        <div className="score-controls" style={style} >
            {openDrawer ? <ScoreOptionsPanel allowUserLanguageChange={allowUserLanguageChange} onClose={onDrawserClose} open={openDrawer} /> : null}

            {playingState === PlayingState.STOPPED ?
                viewingControls : <PlayerControls audioDuration={audioDuration} />}
        </div>
    );
};

export default ScoreControls;
