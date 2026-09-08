import { useContext, useMemo } from "react";
import { Modal, Descriptions, Divider, Typography, Button, List, Space, Badge } from "antd";
import { DownloadOutlined, SelectOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import useStore from "../store";
import { Context } from "../Context";
import useEditorialText from "../hooks/useEditorialText";
import { ChoiceEditorialItem, EditorialItem } from "../types";
import { EDITORIAL_COLORS } from "../types/colors";

const { Text } = Typography;

// Matches the editorial dialog, so both read as the same kind of surface.
const DIALOG_MARGIN = 16;
const DIALOG_WIDTH = 720;

// What getEditor() yields when the MEI names no transcriber.
const MISSING = "<missing>";

const SOURCES_MAX_HEIGHT = "min(200px, 25vh)";
const APPARATUS_MAX_HEIGHT = "min(380px, 45vh)";

const isChoice = (item: EditorialItem): item is ChoiceEditorialItem => 'choice' in item;


function ScoreInfo({ open, onClose, showDownload }: { open: boolean, onClose: () => void, showDownload: boolean }) {
    const { t } = useTranslation("common");
    const score = useStore.use.score();
    const resetEditorialOptions = useStore.use.resetEditorialOptions();
    const elementPages = useStore.use.elementPages();
    const goToElement = useStore.use.goToElement();
    const { verovio } = useContext(Context);

    const {
        describeItemType, describeCurrentOption, describeContentAsString, describePlaceWithStaff,
        getAnnotationText, isChanged,
    } = useEditorialText();

    const properties = score?.properties;

    // The analyzer collects the apparatus one tag at a time, so its order is by kind of
    // element rather than by place in the score.
    const editorialItems = useMemo(() => {
        const measureOf = (item: EditorialItem) => {
            const measure = Number(item.measure);
            return Number.isFinite(measure) ? measure : Number.MAX_SAFE_INTEGER;
        };
        return [...(score?.editorialItems ?? [])].sort((a, b) =>
            measureOf(a) - measureOf(b) || (a.partN ?? 0) - (b.partN ?? 0));
    }, [score?.editorialItems]);

    const decisions = editorialItems.filter(isChoice);
    const changed = decisions.filter(isChanged);


    const rows = (items: { key: string, label: string, value: React.ReactNode | null | undefined }[]) =>
        items
            .filter(row => row.value != null && row.value !== "" && row.value !== MISSING)
            .map(row => ({ key: row.key, label: row.label, children: row.value }));

    const identification = rows([
        { key: 'composer', label: t('scoreInfo.composer'), value: properties?.composer },
        { key: 'lyricist', label: t('scoreInfo.lyricist'), value: properties?.lyricist },
        { key: 'editor', label: t('scoreInfo.editor'), value: properties?.editor },
        { key: 'reconstruction', label: t('scoreInfo.reconstructionBy'), value: properties?.reconstructionBy },
        {
            key: 'responsibilities', label: t('scoreInfo.responsibilities'),
            value: Object.values(properties?.responsibilities ?? {}).join(", ")
        },
    ]);

    const scoreData = rows([
        { key: 'measures', label: t('scoreInfo.numMeasures'), value: properties?.numMeasures || null },
        { key: 'verses', label: t('scoreInfo.numVerses'), value: properties?.numVerses || null },
        { key: 'transposition', label: t('scoreInfo.transposition'), value: properties?.encodedTransposition },
        {
            key: 'sections', label: t('scoreInfo.sections'),
            value: properties?.sections.map(section => section.label).filter(Boolean).join(" · ")
        },
    ]);


    const sources = Object.entries(properties?.sources ?? {})
        .map(([id, source]) => source.title || id);

    const openThere = async (item: EditorialItem) => {
        const page = elementPages[item.id] ?? await verovio?.getPageWithElement(item.id);
        if (page && page > 0) {
            goToElement(item.id, page);
            onClose();
        }
    };

    const itemTitle = (item: EditorialItem) => {
        const place = describePlaceWithStaff(item);
        return [describeItemType(item), place && `(${place})`].filter(Boolean).join(" ");
    };

    const currentReading = (item: ChoiceEditorialItem) => (
        <>
            {t('scoreInfo.currentReadingShort')}: <Text style={{ color: !isChanged(item) ? EDITORIAL_COLORS["lem"] : EDITORIAL_COLORS["rdg"] }}>
                {describeCurrentOption(item, true)}
            </Text>
        </>
    );

    const itemDescription = (item: EditorialItem) => {
        const content = isChoice(item)
            ? currentReading(item)
            : describeContentAsString(item.contentDescription);
        const annotation = getAnnotationText(item);

        if (!content && !annotation) {
            return null;
        }
        return (
            <>
                {content}
                {annotation && <div><Text type="secondary" italic>{annotation}</Text></div>}
            </>
        );
    };

    const scrollBox = (maxHeight: string, content: React.ReactNode) => (
        <div style={{ maxHeight, overflowY: 'auto' }}>{content}</div>
    );

    const section = (title: string | null, content: React.ReactNode) => (
        <>
            {title && <Divider orientation="left" style={{ marginTop: 24 }}><Text strong>{title}</Text></Divider>}
            {content}
        </>
    );

    const title = score?.title ? `${score.title} - ${t('scoreInfo.header')}` : t('scoreInfo.header')

    return (
        <Modal
            title={<Text strong style={{ fontSize: "1.1em" }}>{title}</Text>}
            open={open}
            onCancel={onClose}
            width={`min(${DIALOG_WIDTH}px, calc(100vw - ${2 * DIALOG_MARGIN}px))`}
            centered
            styles={{
                content: {
                    maxHeight: `calc(100vh - ${2 * DIALOG_MARGIN}px)`,
                    display: 'flex',
                    flexDirection: 'column',
                },
                body: { overflowY: 'auto' }
            }}
            footer={null}
        >

            {showDownload && score?.url && (
                <Space align="start" style={{ width: "100%", justifyContent: "right" }}>
                    <Button size="small" icon={<DownloadOutlined />} download href={score.url}>
                        {t('scoreInfo.download')}
                    </Button>
                </Space>
            )}

            {identification.length > 0 && section(null,
                <Descriptions size="small" column={1} items={identification} />)}

            {scoreData.length > 0 && section(null,
                <Descriptions size="small" column={1} items={scoreData} />)}

            {sources.length > 0 && section(t('scoreInfo.sources'),
                scrollBox(SOURCES_MAX_HEIGHT,
                    <List size="small" dataSource={sources}
                        renderItem={source => <List.Item>{source}</List.Item>} />))}

            {editorialItems.length > 0 && section(t('scoreInfo.readings'),
                <>
                    {scrollBox(APPARATUS_MAX_HEIGHT, <List
                        size="small"
                        dataSource={editorialItems}
                        renderItem={item => (
                            <List.Item>
                                <List.Item.Meta
                                    title={
                                        <Space size="small">
                                            <Badge
                                                color={EDITORIAL_COLORS[item.type as keyof typeof EDITORIAL_COLORS] ?? undefined}
                                                text={<Text>{itemTitle(item)}</Text>} />
                                            <Button size="small" type="link" icon={<SelectOutlined />}
                                                onClick={() => openThere(item)}>
                                                {t('scoreInfo.open')}
                                            </Button>
                                        </Space>
                                    }
                                    description={itemDescription(item)}
                                />
                            </List.Item>
                        )} />)}
                    {decisions.length > 0 &&
                        <Button onClick={resetEditorialOptions} danger disabled={changed.length === 0} style={{ marginTop: 12 }}>{t('scoreInfo.reset')}</Button>}
                </>
            )}
        </Modal>
    );
}

export default ScoreInfo;
