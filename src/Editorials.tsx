import { useMemo } from "react";
import useStore from "./store";
import { useEditorialHandler } from "./hooks/useEditorialHandler";
import HoverHighlighter from "./HoverHighlighter";
import { Button, Modal, Radio } from "antd";
import { Tooltip } from "react-tooltip";
import { EditorialItem, Choice, Option, ContentDescription } from "./types";
import { useTranslation } from 'react-i18next';


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

// TODO: we might want to make this configurable globally or per score
const DISPLAY_MENSURAL_DURATIONS = true;


function Editorials() {
    const { t } = useTranslation("common");
    const score = useStore.use.score();
    const showingEditorial = useStore.use.showingEditorial();
    const setShowingEditorial = useStore.use.setShowingEditorial();
    const appOptions = useStore.use.appOptions();
    const setAppOptions = useStore.use.setAppOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const setChoiceOptions = useStore.use.setChoiceOptions();
    const renderedSvgData = useStore.use.renderedSvgData();

    const editorials = score?.editorialItems;

    const { formatType } = useEditorialHandler();

    const TOOLTIP_SELECTOR = useMemo(() =>
        ['corr', 'unclear', 'sic', 'app', 'choice', 'lem', 'reg', 'orig', 'supplied']
            .map(e => `svg .${e}:not(.content-bounding-box)`).join(", ")
        , [])

    const showingEditorialItem = showingEditorial ? editorials?.find(e => e.id == showingEditorial) : null;

    const getAnnotationText = (item: EditorialItem) => {
        if (item.annotations.size <= 0) {
            return null;
        }
        const annot = item.annotations.values().next().value;

        return annot != null ? <p>{annot.text}</p> : null;
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

    const describeContent = (content: ContentDescription[] | undefined) => {
        if (!content || content.length === 0) {
            return undefined;
        }
        return content.map(describeContentItem).join("; ");
    };

    const getAppChoiceExtraText = (sourceTitle: string | null | undefined, contentDescription: string | null | undefined) => {
        return `${sourceTitle ? sourceTitle : ''}${contentDescription ? ': ' + contentDescription : ''}`;
    }

    const getOptionDescription = (option: Option) => {
        const optionSource = option.source;
        const sourceTitle = optionSource && score?.properties.sources[optionSource]?.title;
        const contentDescription = describeContent(option.contentDescription)
        return getAppChoiceExtraText(sourceTitle, contentDescription);
    }

    const getAppChoiceText = (subtype: string, options: Option[], option: Option) => {
        const extraText = getOptionDescription(option)
        if (subtype == "lem") {
            return `${t("editorial.preferredReading")} ${extraText}`;
        }
        const rdgs = options.filter(o => o.type == "rdg");
        if (rdgs.length == 1) {
            return `${t("editorial.alternativeReading")} ${extraText}`;
        }
        return `${t("editorial.alternativeReadingNumber")}${1 + rdgs.findIndex(r => r == option)} ${extraText}`;
    }


    const getChoiceText = (type: string, subtype: string, options: Option[], index: number) => {
        if (type == "app") {
            const text = getAppChoiceText(subtype, options, options[index]);
            return text
        } else if (type == "choice") {
            const extraText = getOptionDescription(options[index]);
            let choiceText = '';
            if (subtype == "reg") {
                choiceText = t("editorial.regReading");
            } else if (subtype == "orig") {
                choiceText = t("editorial.origReading");
            } else {
                choiceText = t('editorial.optionNumber', { 'number': 1 + index });
            }
            return `${choiceText} ${extraText}`
        } else {
            return "";
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
        }
    };

    const getOptionsList = (item: EditorialItem, selectedOptionIndex: number) => {
        const type = item.type;
        const choice = item.choice!;
        const options = choice.options.map((o, index) => { return { option: o, index: index }; });

        return (
            <Radio.Group
                style={{ display: 'flex', flexDirection: 'column', gap: 8, }}
                onChange={(e) => onOptionSelected(type, choice, e.target.value)}
                value={selectedOptionIndex}
                options={options.map((o) => { return { value: o.index, label: getChoiceText(type, o.option.type, choice.options, o.index) }; })} />
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
        }

        return 0;
    };


    const getChoices = (item: EditorialItem) => {
        const type = item.type;
        const choice = item.choice;
        if (choice === undefined) {
            return null;
        }

        const selectedOptionIdx = getSelectedOption(type, choice);
        const subtype = item.choice!.options[selectedOptionIdx].type;

        const options = getOptionsList(item, selectedOptionIdx);

        return (
            <div>
                <br />
                <p>{t('editorial.currentlyShowing', { 'what': getChoiceText(type, subtype, choice.options, selectedOptionIdx) })} </p>
                <p>{t('editorial.availableOptions')}:</p>
                {options}
            </div>
        );
    };


    const getTooltipContent = (render: { content: string | null; activeAnchor: HTMLElement | null }) => {
        const cls = (render.activeAnchor?.className as SVGAnimatedString | undefined)?.baseVal;
        return cls ? <span>{formatType(cls)}</span> : null
    }

    return (
        <div>


            <Tooltip id="verovio-tooltip"
                variant="info"
                style={{ zIndex: 3 }}
                offset={20}
                delayShow={500}
                anchorSelect={TOOLTIP_SELECTOR}
                render={getTooltipContent} />

            {renderedSvgData?.id && <HoverHighlighter svgId={renderedSvgData.id} />}

            {showingEditorialItem ? (
                <Modal
                    title={formatType(showingEditorialItem!.type)}
                    open={showingEditorialItem != null && showingEditorialItem != undefined}
                    onCancel={() => setShowingEditorial(null)}
                    footer={
                        <Button type="primary" onClick={() => setShowingEditorial(null)}>{t('ok')}</Button>
                    }>

                    {showingEditorialItem!.reason != "" ? <p>{`${t('editorial.reason')}: ${showingEditorialItem!.reason}`}</p> : ""}
                    {showingEditorialItem!.resp != "" ? <p>{`${t('editorial.resp')}: ${showingEditorialItem!.resp}`}</p> : ""}
                    {getAnnotationText(showingEditorialItem!)}
                    {getChoices(showingEditorialItem!)}
                </Modal>
            ) : null}
        </div>
    );
}

export default Editorials;
