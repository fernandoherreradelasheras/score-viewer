import { cloneElement, useMemo, useState } from 'react';
import { Space, Pagination, Button, Tooltip } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, FullscreenExitOutlined, ProfileOutlined } from '@ant-design/icons';
import { PlayingState } from './types';
import PlayerControls from './PlayerControls';
import useScoreControls from './hooks/useScoreControls';
import { useTranslation } from 'react-i18next';
import useStore from './store';
import ScoreInfo from './components/ScoreInfo';
import PagePreview from './components/PagePreview';

interface ScoreControlProps {
    style?: React.CSSProperties | undefined;
    fullScreenElement: HTMLElement | null;
    showDownloadButton?: boolean | undefined;
    backgroundColor?: string | undefined;
    audioDuration: number;
}

const ScoreControls = ({ style, fullScreenElement, showDownloadButton, backgroundColor, audioDuration }: ScoreControlProps) => {
    const { t } = useTranslation("common")
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
        <Space orientation='horizontal'>
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
    ), [canZoomIn, canZoomOut, playingState, isFullScreen, score, t, zoomIn, zoomOut, handleFullScreenToggle]);

    const pagination = useMemo(() => (
        shouldShowPagination ?
            <Pagination
                style={{ flex: "1 1 auto", minWidth: 0, flexWrap: "wrap" }}
                disabled={playingState === PlayingState.PLAYING}
                align="center"
                current={currentPageNumber}
                defaultPageSize={1}
                total={pageCount}
                simple={false}
                showTitle={false}
                itemRender={(page, type, element) => {
                    if (type === 'page') {
                        return <PagePreview page={page} current={page === currentPageNumber} backgroundColor={backgroundColor}>{element as React.ReactElement}</PagePreview>
                    }
                    if (type === 'prev' || type === 'next') {
                        return cloneElement(element as React.ReactElement<{ title?: string }>,
                            { title: t(type === 'prev' ? 'pagination.previousPage' : 'pagination.nextPage') })
                    }
                    return element;
                }}
                onChange={handlePageClick} />
            : null
    ), [shouldShowPagination, playingState, currentPageNumber, pageCount, backgroundColor, t, handlePageClick]);

    const viewingControls = useMemo(() => {
        return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 32px", backgroundColor: "white" }}>
            {mainControls}
            {pagination}
        </div>
    }, [mainControls, pagination]);

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
