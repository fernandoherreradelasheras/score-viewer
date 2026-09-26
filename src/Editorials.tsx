import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import useStore from "./store";
import { Modal, Radio, Typography, Descriptions, Alert, Badge, Button, Space } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { Tooltip } from "react-tooltip";
import { EditorialItem, Choice, ContentDescription, EDITORIAL_SELECTION_TAGS, ChoiceEditorialItem, SimpleEditorialItem, PlayingState } from "./types";
import { EDITORIAL_COLORS } from "./types/colors";
import { useTranslation } from 'react-i18next';
import { clearEditorialGroup, markEditorialGroup } from "./SvgUtils";
import useEditorialText from "./hooks/useEditorialText";

const { Text, Paragraph } = Typography;


// Firefox gives a <tspan> an empty client rect, which would anchor the tooltip at the
// origin of the page: an intervention within the lyrics anchors on its <text> instead.
// That half is dropped where :has() is missing, since react-tooltip hands the selector
// to querySelectorAll, which throws on a selector it cannot parse.
const supportsHas = typeof CSS !== "undefined" && CSS.supports?.("selector(:has(*))");
const TOOLTIP_SELECTOR = supportsHas
    ? "svg .mei-editorial:not(tspan), svg text:has(>.mei-editorial)"
    : "svg .mei-editorial:not(tspan)";


const DIALOG_MARGIN = 16;
const PROJECTION_PADDING = 4;

type Segment = { x1: number, y1: number, x2: number, y2: number };

// The two lines between the sides of the element and of the dialog facing each other
// across the widest gap between them, horizontal or vertical. They end on the rounded
// corners of the dialog, halfway along their arc, and not on the corners of its box,
// which fall outside it.
const projectionSegments = (source: DOMRect, dialog: DOMRect, cornerRadius: number): Segment[] => {
    const inset = cornerRadius * (1 - Math.SQRT1_2);
    const left = dialog.left + inset;
    const right = dialog.right - inset;
    const top = dialog.top + inset;
    const bottom = dialog.bottom - inset;
    const horizontal = (fromBottom: boolean): Segment[] => {
        const y1 = fromBottom ? source.bottom : source.top;
        const y2 = fromBottom ? top : bottom;
        return [
            { x1: source.left, y1, x2: left, y2 },
            { x1: source.right, y1, x2: right, y2 },
        ];
    };
    const vertical = (fromRight: boolean): Segment[] => {
        const x1 = fromRight ? source.right : source.left;
        const x2 = fromRight ? left : right;
        return [
            { x1, y1: source.top, x2, y2: top },
            { x1, y1: source.bottom, x2, y2: bottom },
        ];
    };
    const gaps = [
        { gap: dialog.top - source.bottom, segments: () => horizontal(true) },
        { gap: source.top - dialog.bottom, segments: () => horizontal(false) },
        { gap: dialog.left - source.right, segments: () => vertical(true) },
        { gap: source.left - dialog.right, segments: () => vertical(false) },
    ];
    return gaps.reduce((widest, candidate) => candidate.gap > widest.gap ? candidate : widest).segments();
};

// The box of the ring the editorial layer draws around an element: an outline set off
// from its content box, in the units of the score, which is scaled to the page. Null
// where there is no ring, and the element itself has to be framed.
const editorialRing = (element: Element): DOMRect | null => {
    const box = element.querySelector(":scope > .content-bounding-box > rect");
    if (!(box instanceof SVGRectElement)) {
        return null;
    }
    const style = getComputedStyle(box);
    if (style.outlineStyle === "none") {
        return null;
    }
    const rect = box.getBoundingClientRect();
    const scale = box.width.baseVal.value > 0 ? rect.width / box.width.baseVal.value : 1;
    const extent = (parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth)) * scale;
    return new DOMRect(rect.x - extent, rect.y - extent, rect.width + 2 * extent, rect.height + 2 * extent);
};
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
    const renderedSvgData = useStore.use.renderedSvgData();
    const isFacsimileLinked = useStore.use.isFacsimileLinked();
    const focusFacsimileElements = useStore.use.focusFacsimileElements();

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
            // The placement is measured from the laid-out score, which cannot be read
            // while rendering, so it is settled here and applied on the next paint.
            // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // While the dialog is open, every <app>, <choice> or <subst> the decision reaches is
    // marked, the clicked one included: a grouped reading changes together with its
    // siblings elsewhere in the score, and the ring is what makes that reach visible
    // before the reader takes the choice. The container is reached through the element the dialog targets, the
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
        // Keyed on the open dialog and on the SVG, which a reading picked in it replaces
        // without the ring: the item and the group reader it resolves with are rebuilt on
        // every render, and marking them again would only redraw the ring.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showingEditorial, renderedSvgData]);

    // The element and the dialog, for the lines between them. Drawn as the dialog opens,
    // towards where it ends up rather than where its opening animation has it, and
    // measured again whenever either of them may have moved.
    const [dialogPanel, setDialogPanel] = useState<HTMLDivElement | null>(null);
    const [projection, setProjection] = useState<{
        source: DOMRect, ringed: boolean, dialog: DOMRect, cornerRadius: number, wrap: HTMLElement
    } | null>(null);

    useEffect(() => {
        const container = dialogPanel?.querySelector(".ant-modal-container");
        const wrap = dialogPanel?.closest(".ant-modal-wrap");
        if (!dialogPanel || !showingEditorial || !(container instanceof HTMLElement) || !(wrap instanceof HTMLElement)) {
            return;
        }
        const measure = () => {
            const element = document.getElementById(showingEditorial);
            // Of a choice, the ring of the reading on show inside the ring of the choice.
            const reading = element?.querySelector(":scope > .mei-editorial");
            const ring = (reading && editorialRing(reading)) ?? (element && editorialRing(element));
            const bounds = element?.getBoundingClientRect();
            const source = ring ?? (bounds && new DOMRect(bounds.x - PROJECTION_PADDING, bounds.y - PROJECTION_PADDING,
                bounds.width + 2 * PROJECTION_PADDING, bounds.height + 2 * PROJECTION_PADDING));

            // The offsets leave out the transform the opening animation applies.
            let left = 0;
            let top = 0;
            for (let node: Element | null = container; node instanceof HTMLElement && node !== wrap; node = node.offsetParent) {
                left += node.offsetLeft;
                top += node.offsetTop;
            }
            const frame = wrap.getBoundingClientRect();
            const dialog = new DOMRect(frame.left + left - wrap.scrollLeft, frame.top + top - wrap.scrollTop,
                container.offsetWidth, container.offsetHeight);

            const cornerRadius = parseFloat(getComputedStyle(container).borderTopLeftRadius) || 0;

            setProjection(source && (source.width > 0 || source.height > 0)
                ? { source, ringed: ring != null, dialog, cornerRadius, wrap } : null);
        };
        const request = requestAnimationFrame(measure);
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        window.addEventListener("resize", measure);
        wrap.addEventListener("scroll", measure);
        return () => {
            cancelAnimationFrame(request);
            observer.disconnect();
            window.removeEventListener("resize", measure);
            wrap.removeEventListener("scroll", measure);
            setProjection(null);
        };
    }, [dialogPanel, showingEditorial, renderedSvgData]);

    // Two lines, between the facing sides of the element and the dialog, as if the
    // dialog had grown out of it. Placed in the wrap of the dialog rather than in the
    // dialog, which its opening animation moves and scales, and behind it, for it to hide
    // whatever part of the lines falls on it.
    const projectionLines = () => {
        if (!projection) {
            return null;
        }
        const { source, ringed, dialog, cornerRadius, wrap } = projection;
        return createPortal(
            <svg className="editorial-projection" style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: -1, pointerEvents: "none" }}>
                {projectionSegments(source, dialog, cornerRadius).map((segment, i) => <line key={i} {...segment} />)}
                {!ringed && <rect x={source.x} y={source.y} width={source.width} height={source.height} />}
            </svg>,
            wrap);
    };

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
            const newOptions = appOptions.filter((o) => !removeEntries.includes(o));
            newOptions.push(choice.options[selectedOptionIndex].selector);
            setAppOptions(newOptions, true);
        } else if (type == "choice") {
            const newOptions = choiceOptions.filter((o) => !removeEntries.includes(o));
            newOptions.push(choice.options[selectedOptionIndex].selector);
            setChoiceOptions(newOptions, true);
        } else if (type == "subst") {
            const newOptions = substOptions.filter((o) => !removeEntries.includes(o));
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


    const getFacsimileLink = (item: EditorialItem) => {
        const zones = score?.properties.facsimileLinks?.zones;
        const linkedIds = item.noteIds.filter(id => zones?.[id]);
        if (linkedIds.length == 0) {
            return null;
        }

        // Of a choice, the reading on show: the others are not drawn, and may well be
        // linked to the same place, or to another source altogether.
        const showInFacsimile = () => {
            const shownIds = linkedIds.filter(id => document.getElementById(id));
            focusFacsimileElements(shownIds.length > 0 ? shownIds : linkedIds);
        };

        return (
            <Space orientation="vertical" size={4}>
                <Button icon={<PictureOutlined />} onClick={showInFacsimile}
                    disabled={!isFacsimileLinked || playingState === PlayingState.PLAYING}>
                    {t('editorial.showInFacsimile')}
                </Button>
                {!isFacsimileLinked && (
                    <Text type="secondary" style={{ fontSize: "0.85em" }}>
                        {t('editorial.showInFacsimileUnavailable')}
                    </Text>
                )}
            </Space>
        );
    };

    const getContentForTooltip = (render: { activeAnchor: Element | null }) => {
        const anchor = render.activeAnchor instanceof SVGTextElement
            ? render.activeAnchor.querySelector(":scope > .mei-editorial")
            : render.activeAnchor;
        const id = anchor?.id;
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

        const cls = (anchor?.className as SVGAnimatedString | undefined)?.baseVal;
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
                        container: { maxHeight: dialogPlacement.maxHeight, display: 'flex', flexDirection: 'column' },
                        body: { overflowY: 'auto' },
                    } : undefined}
                    footer={null}
                    modalRender={node => <div ref={setDialogPanel}>
                        {projectionLines()}
                        {node}
                    </div>}
                >

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
                        <Descriptions size="small" column={1} items={buildMetaItems(showingEditorialItem)} />

                        {itemCategory(showingEditorialItem)?.desc && (
                            <Alert type="info" title={itemCategory(showingEditorialItem)?.desc} />
                        )}

                        {describeGroupScope(showingEditorialItem) && (
                            <Alert type="warning" showIcon title={describeGroupScope(showingEditorialItem)} />
                        )}
                        {getAnnotationText(showingEditorialItem) && (
                            <Alert type="info" showIcon title={getAnnotationText(showingEditorialItem)} />
                        )}
                        {'choice' in showingEditorialItem ? getChoices(showingEditorialItem) : getSimpleEditorialContent(showingEditorialItem)}
                        {getFacsimileLink(showingEditorialItem)}
                    </div>
                </Modal>
            ) : null}
        </div>
    );
}

export default Editorials;
