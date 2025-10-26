import { Drawer, Space, Row, Col, Typography, Switch, Select, Divider, SelectProps } from "antd"
import { useTranslation } from 'react-i18next';
import { isMobile } from 'react-device-detect';

import { LANGUAGE_SESSION_STORAGE_KEY, SUPPORTED_LANGUAGES } from "./types/ui";
import useStore from "./store";
import { useCallback, useMemo } from "react";


const getReverseTransposition = (transposition?: string) => {
    if (transposition?.startsWith("-")) {
        return "+" + transposition.substring(1);
    } else if (transposition?.startsWith("+") || (transposition && transposition.length > 1)) {
        return "-" + transposition.substring(1);
    }
    return "";
};


function ScoreOptionsPanel({ allowUserLanguageChange, showMusicAnalysisByDefault, onClose, open }: { allowUserLanguageChange: boolean, showMusicAnalysisByDefault: boolean, onClose: () => void, open: boolean }) {
    const { t, i18n } = useTranslation("common")

    const score = useStore.use.score();
    const showNVerses = useStore.use.showNVerses();
    const setShowNVerses = useStore.use.setShowNVerses();
    const showOriginalClefs = useStore.use.showOriginalClefs();
    const setShowOriginalClefs = useStore.use.setShowOriginalClefs();
    const showReconstructions = useStore.use.showReconstructions();
    const setShowReconstructions = useStore.use.setShowReconstructions();
    const showEditorial = useStore.use.showEditorial();
    const setShowEditorial = useStore.use.setShowEditorial();
    const normalizeFicta = useStore.use.normalizeFicta();
    const setNormalizeFicta = useStore.use.setNormalizeFicta();
    const transposition = useStore.use.transposition();
    const setTransposition = useStore.use.setTransposition();
    const showMusicAnalysis = useStore.use.showMusicAnalysis();
    const setShowMusicAnalysis = useStore.use.setShowMusicAnalysis();
    const isSplitView = useStore.use.isSplitView();
    const setIsSplitView = useStore.use.setIsSplitView();
    const splitViewOrientation = useStore.use.splitViewOrientation();
    const setSplitViewOrientation = useStore.use.setSplitViewOrientation();
    const measureNumberInterval = useStore.use.measureNumberInterval();
    const setMeasureNumberInterval = useStore.use.setMeasureNumberInterval();

    const onVersesSelected = useCallback((value: number) => {
        setShowNVerses(value);
    }, [setShowNVerses]);

    const onReconstructionSelected = useCallback((staff: string, reconstruction: string) => {
        console.log(`Selected reconstruction for staff ${staff}:  ${reconstruction}`);
        setShowReconstructions({ [staff]: reconstruction }, false);
    }, [setShowReconstructions]);

    const onShowEditorialChange = useCallback((value: boolean) => {
        setShowEditorial(value);
    }, [setShowEditorial]);

    const onNormalizeFictaChange = useCallback((value: boolean) => {
        setNormalizeFicta(value);
    }, [setNormalizeFicta]);

    const onShowOriginalClefsChange = useCallback(() => {
        console.log(`Show original clefs: ${!showOriginalClefs}`);
        setShowOriginalClefs(!showOriginalClefs);
    }, [showOriginalClefs, setShowOriginalClefs]);

    const onTranspositionChange = useCallback(() => {
        if (transposition != null) {
            setTransposition(null);
        } else {
            const reverseTransposition = getReverseTransposition(score?.properties?.encodedTransposition);
            setTransposition(reverseTransposition);
        }
    }, [transposition, score?.properties?.encodedTransposition, setTransposition]);

    const onShowMusicAnalysisChange = useCallback((value: boolean) => {
        setShowMusicAnalysis(value);
    }, [setShowMusicAnalysis]);

    const onMeasureNumberIntervalChange = useCallback((value: number | null) => {
        setMeasureNumberInterval(value);
    }, [setMeasureNumberInterval]);

    const numVersesAvailable = useMemo(() =>
        score?.properties?.numVerses || 0
        , [score?.properties?.numVerses]);

    const numReconstructionsAvailable = useMemo(() =>
        score?.properties ? Object.entries(score.properties.reconstructions).length : 0
        , [score?.properties]);

    const originalClefsAvailable = useMemo(() =>
        score?.properties?.hasOriginalClefs || false
        , [score?.properties?.hasOriginalClefs]);

    const verseOptions: SelectProps['options'] = useMemo(() =>
        Array.from({ length: numVersesAvailable }, (_, key) => 1 + key).map(i => ({
            value: i,
            label: t("scoreOptions.verseAmmount", { "count": i })
        })),
        [numVersesAvailable, t]
    )


    const voiceRecontructions: { staff: string, voiceName: string, selectOptions: SelectProps['options'] }[] = useMemo(() => {
        if (score?.properties?.reconstructions === undefined) {
            return []
        }
        const reconstructions: { staff: string, voiceName: string, selectOptions: SelectProps['options'] }[] = []
        for (const voiceRecontructed of score?.properties?.reconstructions) {
            if (voiceRecontructed.reconstructionsForVoice.length === 0) {
                continue;
            }
            const reconstructionsForVoice: SelectProps['options'] = []
            for (const reconstruction of voiceRecontructed.reconstructionsForVoice) {
                // Format is reconstruction:staff:type:name
                const name = reconstruction.label != "none" ? reconstruction.label.split(":")[3] : t("scoreOptions.reconstructionNone");
                reconstructionsForVoice.push({ value: reconstruction.label, label: name })
            }
            reconstructions.push({ staff: voiceRecontructed.staff, voiceName: voiceRecontructed.voiceName, selectOptions: reconstructionsForVoice })
        }
        return reconstructions
    }, [numReconstructionsAvailable, t])


    const editorialDisabled = useMemo(() =>
        score?.properties ? !score.properties.hasEditorial : true
        , [score?.properties]);

    const fictaSwictchDisabled = useMemo(() =>
        score?.properties ? !score.properties.hasFicta : true
        , [score?.properties]);

    const showTranspositionOption = useMemo(() =>
        score?.properties?.encodedTransposition !== undefined && score?.properties?.encodedTransposition !== ""
        , [score?.properties]);

    const showVerseOptions = useMemo(() =>
        verseOptions.length > 0
        , [score?.properties]);

    const showReconstructionOptions = useMemo(() =>
        numReconstructionsAvailable > 0
        , [score?.properties]);


    const reconstructionRows = showReconstructionOptions ? voiceRecontructions?.map(voiceReconstruction =>
        <Row align={"middle"}>
            <Col span={12}>
                <Space direction="vertical">
                    <Typography.Text strong={true} >
                        {t('scoreOptions.reconstruction', { voiceName: voiceReconstruction.voiceName })}
                    </Typography.Text>
                </Space>
            </Col>
            <Col span={10}>
                <Select
                    size="middle"
                    options={voiceReconstruction.selectOptions || []}
                    defaultValue={showReconstructions?.[voiceReconstruction.staff] ?? "none"}
                    disabled={voiceReconstruction.selectOptions ? voiceReconstruction.selectOptions.length <= 1 : true}
                    onSelect={(value) => onReconstructionSelected(voiceReconstruction.staff, value)}
                />
            </Col>
        </Row>
    ) : null

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
                            <Switch value={showEditorial || false} defaultValue={false} disabled={editorialDisabled} onChange={onShowEditorialChange} />
                        </Col>
                    </Row>
                </Space>
                <Divider />

                <Typography.Title level={5} style={{ margin: 0 }}>
                    {t('scoreOptions.scoreSettings.title')}
                </Typography.Title>
                <Space direction="vertical" size="middle">
                    {reconstructionRows}

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
                            <Switch defaultValue={normalizeFicta || false} disabled={fictaSwictchDisabled} onChange={onNormalizeFictaChange} />
                        </Col>
                    </Row>

                    {originalClefsAvailable &&
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
                                    disabled={!originalClefsAvailable}
                                    onChange={onShowOriginalClefsChange}
                                />
                            </Col>
                        </Row>}

                    {showTranspositionOption &&
                        <Row align={"middle"}>
                            <Col span={20}>
                                <Space direction="vertical">
                                    <Typography.Text strong={true} {...(!transposition ? { type: 'secondary' } : {})}>
                                        {t('scoreOptions.noTransposition.title')}
                                    </Typography.Text>
                                    <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!transposition ? { type: 'secondary' } : {})} >
                                        {t('scoreOptions.noTransposition.description', { encodedTransposition: score?.properties?.encodedTransposition })}
                                    </Typography.Text>
                                </Space>
                            </Col>
                            <Col span={4}>
                                <Switch
                                    defaultValue={transposition != null}
                                    disabled={!score?.properties?.encodedTransposition}
                                    onChange={onTranspositionChange}
                                />
                            </Col>
                        </Row>}


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
                                defaultValue={showMusicAnalysis || showMusicAnalysisByDefault}
                                onChange={onShowMusicAnalysisChange}
                            />
                        </Col>
                    </Row>


                    {showVerseOptions &&
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
                                    defaultValue={showNVerses ? showNVerses : numVersesAvailable}
                                    disabled={numVersesAvailable <= 1}
                                    onSelect={onVersesSelected}
                                />
                            </Col>
                        </Row>}

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
                                defaultValue={measureNumberInterval != null ? measureNumberInterval : 10}
                                onChange={onMeasureNumberIntervalChange}
                            />
                        </Col>
                    </Row>

                </Space>
            </Space>
        </Drawer>
    );
}

export default ScoreOptionsPanel;
