import { useEffect, useLayoutEffect, useState } from "react";
import useStore from "./store";
import { Modal, Radio, Typography, Descriptions, Alert, Badge } from "antd";
import { Tooltip } from "react-tooltip";
import { EditorialItem, Choice, ContentDescription, EDITORIAL_SELECTION_TAGS, ChoiceEditorialItem, SimpleEditorialItem, PlayingState } from "./types";
import { EDITORIAL_COLORS } from "./types/colors";
import { useTranslation } from 'react-i18next';
import { clearEditorialGroup, markEditorialGroup } from "./SvgUtils";
import useEditorialText from "./hooks/useEditorialText";

const { Text, Paragraph } = Typography;


const TOOLTIP_SELECTOR = "svg .mei-editorial";


const DIALOG_MARGIN = 16;
const DIALOG_WIDTH = 720;
const MIN_DIALOG_HEIGHT = 220;

function Editorials() {
    const { t } = useTranslation("common");
    const score = useStore.use.score();
    const showingEditorial = useStore.use.showingEditorial();
    const setShowingEditorial = useStore.use.setShowingEditorial();
    const appOptions = useStore.use.appOptions();
    const setAppOptions = useStore.use.setAppOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const setChoiceOptions = useStore.use.setChoiceOptions();
    const substOptions = useStore.use.substOptions()
    const setSubstOptions = useStore.use.setSubstOptions()
    const playingState = useStore.use.playingState();

    const {
        titleKey, getAnnotationText, describeContentItem, resolveResp,
        itemCategory, variantGroup, describeGroupScope, describeItemType, describePlace,
        describeOption, selectedOptionIndex, describeCurrentOption,
    } = useEditorialText();

    const editorials = score?.editorialItems;

    const showingEditorialItem = showingEditorial ? editorials?.find(e => e.id == showingEditorial) : null;

    // The dialog must not sit on top of the editorial item it targets.
    // Measured once, when it opens: following the element as the score
    // reflows would make the dialog jump under the reader's hand.
    const [dialogPlacement, setDialogPlacement] = useState<{ top: number; maxHeight: number } | null>(null);

    useLayoutEffect(() => {
        const element = showingEditorial ? document.getElementById(showingEditorial) : null;
        const rect = element?.getBoundingClientRect();
        if (!element || !rect || (rect.width == 0 && rect.height == 0)) {
            setDialogPlacement(null);
            return;
        }
        const frame = element.closest(".svg-container")?.getBoundingClientRect()
            ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
        const above = rect.top - frame.top - 2 * DIALOG_MARGIN;
        const below = frame.bottom - rect.bottom - 2 * DIALOG_MARGIN;
        if (Math.max(above, below) < MIN_DIALOG_HEIGHT) {
            setDialogPlacement(null);
        } else if (below >= above) {
            setDialogPlacement({ top: rect.bottom + DIALOG_MARGIN, maxHeight: below });
        } else {
            setDialogPlacement({ top: frame.top + DIALOG_MARGIN, maxHeight: above });
        }
    }, [showingEditorial]);

    // While the dialog is open, every <app> the decision reaches is marked, the clicked
    // one included: a grouped reading changes together with its siblings elsewhere in
    // the score, and the ring is what makes that reach visible before the reader takes
    // the choice. The container is reached through the element the dialog targets, the
    // same way the placement above frames it.
    useEffect(() => {
        const element = showingEditorial ? document.getElementById(showingEditorial) : null;
        const container = element?.closest(".svg-container") as HTMLElement | null;
        const group = showingEditorialItem ? variantGroup(showingEditorialItem) : null;
        if (!container || !group) {
            return;
        }
        markEditorialGroup(container, group.id);
        return () => clearEditorialGroup(container);
    }, [showingEditorial]);

    const describeContentAsList = (content: ContentDescription[] | undefined) => {
        if (!content || content.length === 0) {
            return undefined;
        }
        return (
            <ul style={{ margin: 0, paddingInlineStart: 22 }}>
                {content.map((item, index) => <li key={index}><Text>{describeContentItem(item)}</Text></li>)}
            </ul>
        )
    };

    const onOptionSelected = (type: string, choice: Choice, selectedOptionIndex: number) => {
        const removeEntries = choice.options.filter((_, index) => index != selectedOptionIndex).map(o => o.selector);
        if (type == "app") {
            const newOptions = appOptions.filter((o: any) => !removeEntries.includes(o));
            newOptions.push(choice.options[selectedOptionIndex].selector);
            setAppOptions(newOptions, true);
        } else if (type == "choice") {
            const newOptions = choiceOptions.filter((o: any) => !removeEntries.includes(o));
            newOptions.push(choice.options[selectedOptionIndex].selector);
            setChoiceOptions(newOptions, true);
        } else if (type == "subst") {
            const newOptions = substOptions.filter((o: any) => !removeEntries.includes(o));
            newOptions.push(choice.options[selectedOptionIndex].selector);
            setSubstOptions(newOptions, true);
        }
    };

    const getOptionsList = (item: ChoiceEditorialItem, selectedOptionIndex: number) => {
        const type = item.type;
        const choice = item.choice;
        const options = choice.options.map((o, index) => { return { option: o, index: index }; });

        return (
            <Radio.Group
                style={{ display: 'flex', flexDirection: 'column', gap: 8, }}
                onChange={(e) => onOptionSelected(type, choice, e.target.value)}
                value={selectedOptionIndex}
                disabled={playingState !== PlayingState.STOPPED}
                options={options.map((o) => { return { value: o.index, label: describeOption(item, o.index, true) }; })} />
        );
    };

    const getChoicesTexts = (item: ChoiceEditorialItem) =>
        item.choice ? getOptionsList(item, selectedOptionIndex(item)) : null;



    const getChoices = (item: ChoiceEditorialItem) => {
        return (
            <div>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    {t('editorial.currentlyShowing', { 'what': describeCurrentOption(item, true) })}
                </Paragraph>
                <Text strong>{t('editorial.availableOptions')}:</Text>
                <div style={{ marginTop: 8 }}>
                    {getChoicesTexts(item)}
                </div>
            </div>
        );
    };

    const getContentHeader = (item: SimpleEditorialItem, single: boolean) => {
        if (single) {
            return t("editorial.formatHeaderSingle", { type: item.type })
        } else {
            return t("editorial.formatHeaderSeveral", { type: item.type })
        }

    }


    const getSimpleEditorialContent = (item: SimpleEditorialItem) => {
        const count = item.contentDescription.length
        if (count <= 0) {
            return null
        }
        return (
            <div>
                <Text strong>{getContentHeader(item, count == 1)}</Text>
                <div style={{ marginTop: 8 }}>
                    {describeContentAsList(item.contentDescription)}
                </div>
            </div>
        )
    }

    const buildMetaItems = (item: EditorialItem) => [
        // Where it is comes first, and labelled like everything else: the dialog can be
        // opened from the score info list, without the reader having clicked the spot.
        ...(describePlace(item) ? [{ key: 'place', label: t('editorial.place'), children: describePlace(item) }] : []),
        ...(item.reason ? [{ key: 'reason', label: t('editorial.reason'), children: item.reason }] : []),
        { key: 'resp', label: t('editorial.resp'), children: resolveResp(item.resp) },
    ];


    const getContentForTooltip = (render: { content: string | null; activeAnchor: HTMLElement | null }) => {
        const id = render.activeAnchor?.id;
        if (id) {
            const editorialItem = editorials?.find((item) =>
                item.id === id ||
                item.correspIds?.includes(id) ||
                ('choice' in item && item.choice.options.some(o => o.id === id))
            )
            if (editorialItem) {
                const options = {
                    type: describeItemType(editorialItem),
                    details: ('choice' in editorialItem && editorialItem.choice) ? describeCurrentOption(editorialItem, false) : null
                }
                const content = EDITORIAL_SELECTION_TAGS.includes(editorialItem.type)
                    ? t(`editorial.tooltip.${editorialItem.type}`, options)
                    : t('editorial.tooltip.default', options)

                return <span>{content}</span>
            }
        }

        const cls = (render.activeAnchor?.className as SVGAnimatedString | undefined)?.baseVal;
        return cls ? <span>{t(titleKey(cls))}</span> : null
    }

    return (
        <div>

            <Tooltip id="verovio-tooltip"
                variant="info"
                style={{ zIndex: 3 }}
                offset={20}
                delayShow={500}
                anchorSelect={TOOLTIP_SELECTOR}
                render={getContentForTooltip} />


            {showingEditorialItem ? (
                <Modal
                    title={
                        <Badge
                            color={EDITORIAL_COLORS[showingEditorialItem.type as keyof typeof EDITORIAL_COLORS] ?? undefined}
                            text={<Text strong>{describeItemType(showingEditorialItem)}</Text>} />
                    }
                    open={showingEditorialItem != null && showingEditorialItem != undefined}
                    onCancel={() => setShowingEditorial(null)}
                    // Wider than the antd default: the readings on offer are lines of
                    // prose, and at 520px they wrapped to a column. Capped by the
                    // viewport, keeping the same margin the placement above leaves.
                    width={`min(${DIALOG_WIDTH}px, calc(100vw - ${2 * DIALOG_MARGIN}px))`}
                    style={dialogPlacement ? { top: dialogPlacement.top } : undefined}
                    styles={dialogPlacement ? {
                        content: { maxHeight: dialogPlacement.maxHeight, display: 'flex', flexDirection: 'column' },
                        body: { overflowY: 'auto' },
                    } : undefined}
                    footer={null}
                >

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
                        <Descriptions size="small" column={1} items={buildMetaItems(showingEditorialItem)} />

                        {itemCategory(showingEditorialItem)?.desc && (
                            <Alert type="info" message={itemCategory(showingEditorialItem)?.desc} />
                        )}

                        {describeGroupScope(showingEditorialItem) && (
                            <Alert type="warning" showIcon message={describeGroupScope(showingEditorialItem)} />
                        )}
                        {getAnnotationText(showingEditorialItem) && (
                            <Alert type="info" showIcon message={getAnnotationText(showingEditorialItem)} />
                        )}
                        {'choice' in showingEditorialItem ? getChoices(showingEditorialItem) : getSimpleEditorialContent(showingEditorialItem)}
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}

export default Editorials;
