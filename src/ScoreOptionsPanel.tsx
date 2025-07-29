import { Drawer, Space, Row, Col, Typography, Switch, Select, Divider } from "antd"
import { useTranslation } from 'react-i18next';
import useScoreOptions from "./hooks/useScoreOptions";
import { LANGUAGE_SESSION_STORAGE_KEY, SUPPORTED_LANGUAGES } from "./types/ui";

function ScoreOptionsPanel({ allowUserLanguageChange, onClose, open }: { allowUserLanguageChange: boolean, onClose: () => void, open: boolean }) {
    const { t, i18n } = useTranslation("common")

    // Use our custom hook for all score options logic
    const {
        // State
        showNVerses,
        showEditorial,
        showOriginalClefs,
        showReconstructions,
        normalizeFicta,
        transposition,
        showMusicAnalysis,
        splitView,
        splitViewOrientation,
        score,

        // Derived state
        numVersesAvailable,
        originalClefsAvailable,
        verseOptions,
        showReconstructionOptions,
        voiceRecontructions,
        editorialDisabled,
        fictaSwictchDisabled,
        showTranspositionOption,
        showVerseOptions,

        // Actions
        onVersesSelected,
        onReconstructionSelected,
        onShowEditorialChange,
        onNormalizeFictaChange,
        onShowOriginalClefsChange,
        onTranspositionChange,
        onShowMusicAnalysisChange,
        onSplitViewChange,
        setSplitViewOrientation
    } = useScoreOptions();

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
                    value={showReconstructions?.[voiceReconstruction.staff] ?? "none"}
                    defaultValue="none"
                    disabled={voiceReconstruction.selectOptions ? voiceReconstruction.selectOptions.length <= 1 : true}
                    onSelect={(value) => onReconstructionSelected(voiceReconstruction.staff, value)}
                />
            </Col>
        </Row>
    ) : null

    const onLanguageSelected = (value: string) => {
        sessionStorage.setItem(LANGUAGE_SESSION_STORAGE_KEY, value)
        i18n.changeLanguage(value);
    }

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

    const iuLayoutRow = <Row align={"middle"}>
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
                value={splitView ? `${splitViewOrientation}-split` : "tabs"}
                defaultValue="tabs"
                options={[
                    { label: "Tabs", value: "tabs" },
                    { label: "Horizontal Split", value: "horizontal-split" },
                    { label: "Vertical Split", value: "vertical-split" }
                ]}
                onSelect={(value) => {
                    if (value === "tabs") {
                        if (splitView) {
                            onSplitViewChange(); // Turn off split view
                        }
                    } else if (value === "horizontal-split") {
                        if (!splitView) {
                            onSplitViewChange(); // Turn on split view
                        }
                        setSplitViewOrientation('horizontal');
                    } else if (value === "vertical-split") {
                        if (!splitView) {
                            onSplitViewChange(); // Turn on split view
                        }
                        setSplitViewOrientation('vertical');
                    }
                }}
            />
        </Col>
    </Row>



    return (
        <Drawer title={t('scoreOptions.title')} open={open} onClose={onClose}>
            <Space direction="vertical" size="large">

                {/* UI Settings Section */}
                {(languageRow || iuLayoutRow) && (
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
                )}

                {/* Score Options Section */}
                <Typography.Title level={5} style={{ margin: 0 }}>
                    {t('scoreOptions.scoreSettings.title')}
                </Typography.Title>
                <Space direction="vertical" size="middle">
                    {reconstructionRows}

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
                            <Switch value={normalizeFicta || false} defaultValue={false} disabled={fictaSwictchDisabled} onChange={onNormalizeFictaChange} />
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
                                    value={showOriginalClefs || false}
                                    defaultValue={false}
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
                                    value={transposition != null}
                                    defaultValue={false}
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
                                value={showMusicAnalysis}
                                defaultValue={false}
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
                                    value={showNVerses ? showNVerses : numVersesAvailable}
                                    defaultValue={numVersesAvailable}
                                    disabled={numVersesAvailable <= 1}
                                    onSelect={onVersesSelected}
                                />
                            </Col>
                        </Row>}
                </Space>
            </Space>
        </Drawer>
    );
}

export default ScoreOptionsPanel;
