import { Drawer, Space, Row, Col, Typography, Switch, Select, Divider, SelectProps, Button } from "antd"
import { useTranslation } from 'react-i18next';
import { isMobile } from 'react-device-detect';

import { LANGUAGE_SESSION_STORAGE_KEY, SUPPORTED_LANGUAGES } from "./types/ui";
import useStore from "./store";
import { useCallback, useMemo } from "react";




function ScoreOptionsPanel({ allowUserLanguageChange, onClose, open }: { allowUserLanguageChange: boolean, onClose: () => void, open: boolean }) {
    const { t, i18n } = useTranslation("common")

    const score = useStore.use.score();
    const showNVerses = useStore.use.showNVerses();
    const setShowNVerses = useStore.use.setShowNVerses();
    const showOriginalClefs = useStore.use.showOriginalClefs();
    const setShowOriginalClefs = useStore.use.setShowOriginalClefs();
    const showEditorial = useStore.use.showEditorial();
    const setShowEditorial = useStore.use.setShowEditorial();
    const normalizeFicta = useStore.use.normalizeFicta();
    const setNormalizeFicta = useStore.use.setNormalizeFicta();
    const withoutTransposition = useStore.use.withoutTransposition();
    const setWithoutTransposition = useStore.use.setWithoutTransposition();
    const showMusicAnalysis = useStore.use.showMusicAnalysis();
    const setShowMusicAnalysis = useStore.use.setShowMusicAnalysis();
    const isSplitView = useStore.use.isSplitView();
    const setIsSplitView = useStore.use.setIsSplitView();
    const splitViewOrientation = useStore.use.splitViewOrientation();
    const setSplitViewOrientation = useStore.use.setSplitViewOrientation();
    const measureNumberInterval = useStore.use.measureNumberInterval();
    const setMeasureNumberInterval = useStore.use.setMeasureNumberInterval();
    const resetScoreSettings = useStore.use.resetScoreSettings();
    const resetUILayout = useStore.use.resetUILayout();

    const onVersesSelected = useCallback((value: number) => {
        setShowNVerses(value);
    }, [setShowNVerses]);

    const onShowEditorialChange = useCallback((value: boolean) => {
        setShowEditorial(value);
    }, [setShowEditorial]);

    const onNormalizeFictaChange = useCallback((value: boolean) => {
        setNormalizeFicta(value);
    }, [setNormalizeFicta]);

    const onShowOriginalClefsChange = useCallback((value: boolean) => {
        setShowOriginalClefs(value);
    }, [setShowOriginalClefs]);

    const onWithoutTranspositionChange = useCallback((value: boolean) => {
        setWithoutTransposition(value);
    }, [setWithoutTransposition]);

    const onShowMusicAnalysisChange = useCallback((value: boolean) => {
        setShowMusicAnalysis(value);
    }, [setShowMusicAnalysis]);

    const onMeasureNumberIntervalChange = useCallback((value: number) => {
        setMeasureNumberInterval(value);
    }, [setMeasureNumberInterval]);


    const numVersesAvailable = 8;
    const verseOptions: SelectProps['options'] = useMemo(() =>
        Array.from({ length: numVersesAvailable }, (_, key) => 1 + key).map(i => ({
            value: i,
            label: t("scoreOptions.verseAmmount", { "count": i })
        })),
        [numVersesAvailable, t]
    )

    const onLanguageSelected = useCallback((value: string) => {
        sessionStorage.setItem(LANGUAGE_SESSION_STORAGE_KEY, value)
        i18n.changeLanguage(value);
    }, [i18n]);

    const layoutOptions = [
        { label: "Tabs", value: "tabs" },
        { label: "Horizontal Split", value: "horizontal-split" },
        { label: "Vertical Split", value: "vertical-split" }
    ]


    const onLayoutSelected = useCallback((value: string) => {
        if (value === "tabs") {
            setIsSplitView(false);
        } else {
            setIsSplitView(true);
            if (value === "horizontal-split") {
                setSplitViewOrientation('horizontal');
            } else if (value === "vertical-split") {
                setSplitViewOrientation('vertical');
            }
        }
    }, [setIsSplitView, setSplitViewOrientation])

    const languageOptions = allowUserLanguageChange ? SUPPORTED_LANGUAGES.map(lang => ({ label: lang.label, value: lang.key })) : [];

    const languageRow = allowUserLanguageChange ?
        <Row align={"middle"}>
            <Col span={16}>
                <Space direction="vertical">
                    <Typography.Text strong={true} >
                        {t('scoreOptions.language.title')}
                    </Typography.Text>
                    <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} >
                        {t('scoreOptions.language.description')}
                    </Typography.Text>
                </Space>
            </Col>
            <Col span={8}>
                <Select value={i18n.language} options={languageOptions} onSelect={onLanguageSelected} />
            </Col>
        </Row> : null

    const iuLayoutRow = !isMobile ?
        <Row align={"middle"}>
            <Col span={16}>
                <Space direction="vertical">
                    <Typography.Text strong={true}>
                        {t('scoreOptions.uiLayout.title')}
                    </Typography.Text>
                    <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }}>
                        {t('scoreOptions.uiLayout.description')}
                    </Typography.Text>
                </Space>
            </Col>
            <Col span={8}>
                <Select
                    defaultValue={isSplitView ? `${splitViewOrientation}-split` : "tabs"}
                    options={layoutOptions}
                    onSelect={onLayoutSelected}
                />
            </Col>
        </Row> : null


    const onReset = useCallback(() => {
        resetScoreSettings();
        resetUILayout();
    }, [resetScoreSettings, resetUILayout]);



    return (
        <Drawer title={t('scoreOptions.title')} open={open} onClose={onClose}>
            <Space direction="vertical" size="large">

                {/* UI Settings Section */}
                {(languageRow || iuLayoutRow) &&
                    <>
                        <Typography.Title level={5} style={{ margin: 0 }}>
                            {t('scoreOptions.uiSettings.title')}
                        </Typography.Title>
                        <Space direction="vertical" size="middle">
                            {languageRow}
                            {iuLayoutRow}
                        </Space>
                        <Divider />
                    </>
                }
                <Typography.Title level={5} style={{ margin: 0 }}>
                    {t('scoreOptions.scoreViewerSettings.title')}
                </Typography.Title>
                <Space direction="vertical" size="middle">
                    <Row align={"middle"}>
                        <Col span={20}>
                            <Space direction="vertical">
                                <Typography.Text strong={true}  {...(!showEditorial ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.editorialNotes.title')}
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }}  {...(!showEditorial ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.editorialNotes.description')}
                                </Typography.Text>
                            </Space>
                        </Col>
                        <Col span={4}>
                            <Switch value={showEditorial || false} defaultValue={false} onChange={onShowEditorialChange} />
                        </Col>
                    </Row>

                    <Row align={"middle"}>
                        <Col span={20}>
                            <Space direction="vertical">
                                <Typography.Text strong={true}  {...(!normalizeFicta ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.normalizeFicta.title')}
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!normalizeFicta ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.normalizeFicta.description')}
                                </Typography.Text>
                            </Space>
                        </Col>
                        <Col span={4}>
                            <Switch defaultValue={normalizeFicta || false} onChange={onNormalizeFictaChange} />
                        </Col>
                    </Row>

                    <Row align={"middle"}>
                        <Col span={20}>
                            <Space direction="vertical">
                                <Typography.Text strong={true} {...(!showOriginalClefs ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.originalClefs.title')}
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!showOriginalClefs ? { type: 'secondary' } : {})} >
                                    {t('scoreOptions.originalClefs.description')}
                                </Typography.Text>
                            </Space>
                        </Col>
                        <Col span={4}>
                            <Switch
                                defaultValue={showOriginalClefs || false}
                                onChange={onShowOriginalClefsChange}
                            />
                        </Col>
                    </Row>

                    <Row align={"middle"}>
                        <Col span={20}>
                            <Space direction="vertical">
                                <Typography.Text strong={true} {...(!withoutTransposition ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.noTransposition.title')}
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!withoutTransposition ? { type: 'secondary' } : {})} >
                                    {t('scoreOptions.noTransposition.description', { encodedTransposition: score?.properties?.encodedTransposition })}
                                </Typography.Text>
                            </Space>
                        </Col>
                        <Col span={4}>
                            <Switch
                                value={withoutTransposition}
                                onChange={onWithoutTranspositionChange}
                            />
                        </Col>
                    </Row>


                    <Row align={"middle"}>
                        <Col span={20}>
                            <Space direction="vertical">
                                <Typography.Text strong={true} {...(!showMusicAnalysis ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.harmonicAnalysis.title')}
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!showMusicAnalysis ? { type: 'secondary' } : {})} >
                                    {t('scoreOptions.harmonicAnalysis.description')}
                                </Typography.Text>
                            </Space>
                        </Col>
                        <Col span={4}>
                            <Switch
                                value={showMusicAnalysis}
                                onChange={onShowMusicAnalysisChange}
                            />
                        </Col>
                    </Row>


                    <Row align={"middle"}>
                        <Col span={16}>
                            <Space direction="vertical">
                                <Typography.Text strong={true} {...(!showNVerses ? { type: 'secondary' } : {})}>
                                    {t('scoreOptions.limitVerses.title')}
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!showNVerses ? { type: 'secondary' } : {})} >
                                    {t('scoreOptions.limitVerses.description')}
                                </Typography.Text>
                            </Space>
                        </Col>
                        <Col span={8}>
                            <Select
                                size="large"
                                options={verseOptions}
                                style={{ width: 120 }}
                                value={showNVerses}
                                onSelect={onVersesSelected}
                            />
                        </Col>
                    </Row>

                    <Row align={"middle"}>
                        <Col span={12}>
                            <Space direction="vertical">
                                <Typography.Text strong={true}>
                                    {t('scoreOptions.measureNumberInterval.title')}
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }}>
                                    {t('scoreOptions.measureNumberInterval.description')}
                                </Typography.Text>
                            </Space>
                        </Col>
                        <Col span={12}>
                            <Select<number>
                                options={[
                                    { label: t('scoreOptions.measureIntervalPage'), value: 0 },
                                    { label: t('scoreOptions.measureInterval10'), value: 10 },
                                    { label: t('scoreOptions.measureInterval5'), value: 5 },
                                    { label: t('scoreOptions.measureInterval1'), value: 1 }]}
                                value={measureNumberInterval}
                                onChange={onMeasureNumberIntervalChange}
                            />
                        </Col>
                    </Row>

                </Space>
                <Divider />
                <Button danger block onClick={onReset}>
                    {t('scoreOptions.resetSettings')}
                </Button>
            </Space>
        </Drawer>
    );
}

export default ScoreOptionsPanel;
