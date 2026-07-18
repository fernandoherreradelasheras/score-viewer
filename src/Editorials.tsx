import useStore from "./store";
import { Button, Modal, Radio, Typography, Descriptions, Alert, Badge } from "antd";
import { Tooltip } from "react-tooltip";
import { EditorialItem, Choice, Option, ContentDescription, EDITORIAL_ALL_TAGS, EDITORIAL_SELECTION_TAGS, ChoiceEditorialItem, SimpleEditorialItem, PlayingState } from "./types";
import { EDITORIAL_COLORS } from "./types/colors";
import { useTranslation } from 'react-i18next';

const { Text, Paragraph } = Typography;


const ACCIDENTAL_SYMBOLS: Record<string, string> = {
    f: "♭",
    s: "♯",
    n: "♮",
    ff: "𝄫",
    ss: "𝄪",
};

const MEI_DURATIONS: Record<string, { mensuralKey: string; commonKey: string }> = {
    // if given CMN names:
    "long": { mensuralKey: "note.mensuralDuration.longa", commonKey: "note.commonDuration.quadruple" },
    "breve": { mensuralKey: "note.mensuralDuration.brevis", commonKey: "note.commonDuration.double" },
    "1": { mensuralKey: "note.mensuralDuration.semibrevis", commonKey: "note.commonDuration.whole" },
    "2": { mensuralKey: "note.mensuralDuration.minima", commonKey: "note.commonDuration.half" },
    "4": { mensuralKey: "note.mensuralDuration.semiminima", commonKey: "note.commonDuration.quarter" },
    "8": { mensuralKey: "note.mensuralDuration.fusa", commonKey: "note.commonDuration.8th" },
    "16": { mensuralKey: "note.mensuralDuration.semifusa", commonKey: "note.commonDuration.16th" },
    // If given mensural names:
    "maxima": { mensuralKey: "note.mensuralDuration.maxima", commonKey: "note.commonDuration.octuple" },
    "longa": { mensuralKey: "note.mensuralDuration.longa", commonKey: "note.commonDuration.quadruple" },
    "brevis": { mensuralKey: "note.mensuralDuration.brevis", commonKey: "note.commonDuration.double" },
    "semibrevis": { mensuralKey: "note.mensuralDuration.semibrevis", commonKey: "note.commonDuration.whole" },
    "minima": { mensuralKey: "note.mensuralDuration.minima", commonKey: "note.commonDuration.half" },
    "semiminima": { mensuralKey: "note.mensuralDuration.semiminima", commonKey: "note.commonDuration.quarter" },
    "fusa": { mensuralKey: "note.mensuralDuration.fusa", commonKey: "note.commonDuration.8th" },
    "semifusa": { mensuralKey: "note.mensuralDuration.semifusa", commonKey: "note.commonDuration.16th" }
};

// we might want to make this configurable globally or per score
const DISPLAY_MENSURAL_DURATIONS = true;

const TOOLTIP_SELECTOR = "svg .mei-editorial";

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

    const editorials = score?.editorialItems;

    const showingEditorialItem = showingEditorial ? editorials?.find(e => e.id == showingEditorial) : null;

    const titleKey = (type: string): string => {
        if (EDITORIAL_ALL_TAGS.includes(type)) {
            return `editorial.formatType.${type}`;
        } else if (type == "clef[data-corresp]") {
            return "editorial.formatType.clefChange"
        } else {
            return type;
        }
    }

    const getAnnotationText = (item: EditorialItem): string | null => {
        if (item.annotations.size <= 0) {
            return null;
        }
        const annot = item.annotations.values().next().value;
        return annot?.text ?? null;
    };

    const describeDuration = (dur?: string | null) => {
        if (!dur) {
            return t("note.unknownDuration", { defaultValue: "unknown duration" });
        }
        const entry = MEI_DURATIONS[dur];
        if (!entry) {
            return dur;
        }
        const key = DISPLAY_MENSURAL_DURATIONS ? entry.mensuralKey : entry.commonKey;
        return t(key, { defaultValue: key.split(".").pop() || dur });
    };

    const describeContentItem = (item: ContentDescription) => {
        const duration = describeDuration(item.dur);
        if (item.kind === "rest") {
            return t("rest.description", {
                duration,
                defaultValue: `${duration} rest`,
            });
        }
        const pitch = t(`note.pitch.${item.pname}`, { defaultValue: item.pname.toUpperCase() });
        const accidental = item.accid ? ACCIDENTAL_SYMBOLS[item.accid] ?? "" : "";
        return t("note.description", {
            pitch,
            accidental,
            octave: item.oct,
            duration,
            defaultValue: `${pitch}${accidental}${item.oct}, ${duration}`,
        });
    };

    const describeContentAsString = (content: ContentDescription[] | undefined) => {
        if (!content || content.length === 0) {
            return undefined;
        }
        return content.map(describeContentItem).join("; ");
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

    const getOptionDescription = (option: Option) => {
        const optionSource = option.source;
        const sourceTitle = optionSource && score?.properties.sources[optionSource]?.title;
        const contentDescription = describeContentAsString(option.contentDescription)
        return getAppChoiceExtraText(sourceTitle, contentDescription);
    }

    const getAppChoiceExtraText = (sourceTitle: string | null | undefined, contentDescription: string | null | undefined) => {
        return `${sourceTitle ? sourceTitle : ''}${contentDescription ? ': ' + contentDescription : ''}`;
    }

    const getAppChoiceText = (subtype: string, options: Option[], option: Option, includeDescription: boolean) => {
        const extraText = includeDescription ? getOptionDescription(option) : null;
        let text = '';
        if (subtype == "lem") {
            text = t("editorial.preferredReading")
        } else if (subtype == "rdg") {
            const rdgs = options.filter(o => o.type == "rdg");
            if (rdgs.length == 1) {
                text = t("editorial.alternativeReading")
            } else {
                text = `${t("editorial.alternativeReadingNumber")}${1 + rdgs.findIndex(r => r == option)}`;
            }
        }
        return extraText ? `${text} ${extraText}` : text;
    }

    const getSubstChoiceText = (subtype: string, options: Option[], index: number, includeDescription: boolean) => {
        const option = options[index];
        const extraText = includeDescription ? getOptionDescription(option) : null;
        let type;
        let trOptions = {};
        if (subtype == "add" || subtype == "del") {
            type = subtype
        } else if (options.length == 2) {
            type = (index == 0) ? "del" : "add"
        } else if (options.length == 1) {
            type = "del"
        } else {
            type = (index == 0) ? "editorial.substSubstFirstChild" : "editorial.substSubstOtherChild"
            trOptions = { ...trOptions, position: index + 1 }
        }

        const text = t(titleKey(type), trOptions)
        return extraText ? `${text} ${extraText}` : text;
    }


    const getChoiceText = (type: string, subtype: string, options: Option[], index: number, includeDescription: boolean) => {
        if (type == "app") {
            return getAppChoiceText(subtype, options, options[index], includeDescription);
        } else if (type == "choice") {
            const choiceText = t(titleKey(subtype), { defaultValue: t('editorial.optionNumber', { 'number': 1 + index }) });
            const extraText = includeDescription ? getOptionDescription(options[index]) : null;
            return extraText ? `${choiceText} ${extraText}` : choiceText;
        } else if (type == "subst") {
            return getSubstChoiceText(subtype, options, index, includeDescription);
        }
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
                options={options.map((o) => { return { value: o.index, label: getChoiceText(type, o.option.type, choice.options, o.index, true) }; })} />
        );
    };

    const getSelectedOption = (type: string, choice: Choice) => {
        if (type == "app") {
            const inApp = choice.options.findIndex((option) => Object.values(appOptions).includes(option.selector));
            if (inApp != -1) {
                return inApp;
            } else {
                // Default app order is: 1) lem, 2) if no lem, first rdg
                const lemIdx = choice.options.findIndex((option) => option.type == "lem");
                if (lemIdx != -1) {
                    return lemIdx;
                }
                return 0;
            }
        } else if (type == "choice") {
            const inChoices = choice.options.findIndex((option) => Object.values(choiceOptions).includes(option.selector));
            if (inChoices != -1) {
                return inChoices;
            } else {
                return 0;
            }
        } else if (type == "subst") {
            const inSubsts = choice.options.findIndex((option) => Object.values(substOptions).includes(option.selector));
            if (inSubsts != -1) {
                return inSubsts;
            } else {
                // verovio renders the first child of a <subst> (whether <add> or <del>)
                return 0
            }
        }

        return 0;
    };

    const getChoicesTexts = (item: ChoiceEditorialItem) => {
        const type = item.type;
        const choice = item.choice;
        if (choice === undefined) {
            return null;
        }

        const selectedOptionIdx = getSelectedOption(type, choice);
        return getOptionsList(item, selectedOptionIdx);
    }



    const getCurrentlyShowingChoiceText = (item: ChoiceEditorialItem, includeDescription: boolean) => {
        const type = item.type;
        const choice = item.choice;
        if (choice === undefined) {
            return null;
        }

        const selectedOptionIdx = getSelectedOption(type, choice);
        const subtype = item.choice!.options[selectedOptionIdx].type;
        return getChoiceText(type, subtype, choice.options, selectedOptionIdx, includeDescription);
    };


    const getChoices = (item: ChoiceEditorialItem) => {
        return (
            <div>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    {t('editorial.currentlyShowing', { 'what': getCurrentlyShowingChoiceText(item, true) })}
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

    const getEditorialItemTypeName = (item: EditorialItem) => {
        return t(titleKey(item.type))
    }

    // Resolve a @resp / @source pointer to a readable name/title, falling back to
    // "not specified" when empty so every dialog shows the same fields consistently.
    const notSpecified = () => t('editorial.notSpecified', { defaultValue: 'No indicado' });

    const resolveResp = (resp: string) => {
        if (!resp) return notSpecified();
        const id = resp.replace(/^#/, '');
        return score?.properties.responsibilities?.[id] ?? id;
    };

    const resolveSource = (source: string) => {
        if (!source) return notSpecified();
        const id = source.replace(/^#/, '');
        return score?.properties.sources?.[id]?.title || id;
    };

    const buildMetaItems = (item: EditorialItem) => [
        ...(item.reason ? [{ key: 'reason', label: t('editorial.reason'), children: item.reason }] : []),
        { key: 'resp', label: t('editorial.resp'), children: resolveResp(item.resp) },
        { key: 'source', label: t('editorial.source'), children: resolveSource(item.source) },
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
                    type: getEditorialItemTypeName(editorialItem),
                    details: ('choice' in editorialItem && editorialItem.choice) ? getCurrentlyShowingChoiceText(editorialItem, false) : null
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
                            text={<Text strong>{getEditorialItemTypeName(showingEditorialItem)}</Text>} />
                    }
                    open={showingEditorialItem != null && showingEditorialItem != undefined}
                    onCancel={() => setShowingEditorial(null)}
                    footer={
                        <Button type="primary" onClick={() => setShowingEditorial(null)}>{t('ok')}</Button>
                    }>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
                        <Descriptions size="small" column={1} items={buildMetaItems(showingEditorialItem)} />
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
