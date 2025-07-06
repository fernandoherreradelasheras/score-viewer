import { Drawer, Space, Row, Col, Typography, Switch, Select } from "antd"
import useScoreOptions from "./hooks/useScoreOptions";

function ScoreOptionsPanel({onClose, open} : {onClose: () => void, open: boolean} ) {
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
        onShowMusicAnalysisChange
    } = useScoreOptions();

    const reconstructionRows = showReconstructionOptions ? voiceRecontructions?.map(voiceReconstruction =>
            <Row align={"middle"}>
            <Col span={12}>
            <Space direction="vertical">
                <Typography.Text strong={true} >
                    { `Reconstrucción ${voiceReconstruction.voiceName}` }
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

    return (
        <Drawer title="Opciones de visualizacion" open={open} onClose={onClose}>
            <Space direction="vertical" size="large">

                {reconstructionRows}

                <Row align={"middle"}>
                    <Col span={20}>
                        <Space direction="vertical">
                            <Typography.Text strong={true}  {...(!showEditorial ? {type: 'secondary'} :{} )}>
                                Notas editoriales
                            </Typography.Text>
                            <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }}  {...(!showEditorial ? {type: 'secondary'} :{} )}>
                                Muestra una capa con las notas críticas y elección de variantes variantes
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
                            <Typography.Text strong={true}  {...(!normalizeFicta ? {type: 'secondary'} :{} )}>
                                Normalizar musica ficta
                            </Typography.Text>
                            <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!normalizeFicta ? {type: 'secondary'} :{} )}>
                                Mostrar las alteraciones subintelectas de como las normales prececiendo a la nota
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
                                <Typography.Text strong={true} {...(!showOriginalClefs ? {type: 'secondary'} :{} )}>
                                    Claves originales
                                </Typography.Text>
                                <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!showOriginalClefs ? {type: 'secondary'} :{} )} >
                                    Muestra las claves originales del manuscrito sin modernizar
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
                            <Typography.Text strong={true} {...(!transposition ? {type: 'secondary'} :{} )}>
                                Sin transposición
                            </Typography.Text>
                            <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!transposition ? {type: 'secondary'} :{} )} >
                                Muestra la partitura deshaciendo la transposición desde claves altas ({score?.properties?.encodedTransposition})
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
                            <Typography.Text strong={true} {...(!transposition ? {type: 'secondary'} :{} )}>
                                Análisis armónico
                            </Typography.Text>
                            <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!transposition ? {type: 'secondary'} :{} )} >
                                Muestra quintas y octavas paralelas y clasificación de las disonancias de la partitura
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
                            <Typography.Text strong={true} {...(!showNVerses ? {type: 'secondary'} :{} )}>
                                Limitar versos
                            </Typography.Text>
                            <Typography.Text style={{ fontWeight: "lighter", fontSize: "0.8em" }} {...(!showNVerses ? {type: 'secondary'} :{} )} >
                                Elige la cantidad de versos a mostrar en las coplas
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
        </Drawer>
    );
}

export default ScoreOptionsPanel;