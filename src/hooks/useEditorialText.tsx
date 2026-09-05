import { useTranslation } from 'react-i18next';
import useStore from '../store';
import {
    ChoiceEditorialItem, ContentDescription, EDITORIAL_ALL_TAGS, EditorialItem, Option,
} from '../types';
import { getReverseTransposition, transposeNote } from '../utils/score-utils';


const ACCIDENTAL_SYMBOLS: Record<string, string> = {
    f: "♭",
    s: "♯",
    n: "♮",
    ff: "𝄫",
    ss: "𝄪",
    x: "𝄪",
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


/**
 * Naming editorial interventions and their readings: which option is on show, which one
 * the score would show untouched, and how to say either one to the reader. Shared, so
 * the dialog on a single intervention and any list of them (the score info modal) call
 * the same reading by the same name.
 */
export default function useEditorialText() {
    const { t, i18n } = useTranslation("common");
    const score = useStore.use.score();
    const appOptions = useStore.use.appOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const substOptions = useStore.use.substOptions();
    const withoutTransposition = useStore.use.withoutTransposition();

    const editorials = score?.editorialItems;

    // Content descriptions carry the pitches as encoded; when the score is shown with
    // its transposition undone, they must read as the notes the reader sees.
    const displayedTransposition = withoutTransposition
        ? getReverseTransposition(score?.properties?.encodedTransposition)
        : "";

    const titleKey = (type: string): string => {
        if (EDITORIAL_ALL_TAGS.includes(type)) {
            return `editorial.formatType.${type}`;
        } else if (type == "clef[data-corresp]") {
            return "editorial.formatType.clefChange"
        } else {
            return type;
        }
    };

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
        const note = displayedTransposition ? transposeNote(item, displayedTransposition) : item;
        const pitch = t(`note.pitch.${note.pname}`, { defaultValue: note.pname.toUpperCase() });
        const symbol = note.accid ? ACCIDENTAL_SYMBOLS[note.accid] ?? "" : "";
        const accidental = symbol && note.editorialAccid ? `(${symbol})` : symbol;
        return t("note.description", {
            pitch,
            accidental,
            octave: note.oct,
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

    const getAppChoiceExtraText = (sourceTitle: string | null | undefined, contentDescription: string | null | undefined) =>
        `${sourceTitle ? sourceTitle : ''}${contentDescription ? ': ' + contentDescription : ''}`;

    const getOptionDescription = (option: Option) => {
        const optionSource = option.source;
        const sourceTitle = optionSource && score?.properties.sources[optionSource]?.title;
        const contentDescription = describeContentAsString(option.contentDescription)
        return getAppChoiceExtraText(sourceTitle, contentDescription);
    };

    // Resolve a @resp pointer to a readable name, falling back to "not specified"
    // when empty so every dialog shows the same fields consistently.
    const notSpecified = () => t('editorial.notSpecified', { defaultValue: 'No indicado' });

    const resolveResp = (resp: string) => {
        if (!resp) return notSpecified();
        const id = resp.replace(/^#/, '');
        return score?.properties.responsibilities?.[id] ?? id;
    };



    // The variant group of an editorial item: the <classDecls> category its readings
    // point at with @class. Only when every reading on offer classifies under the same
    // one, since it names the decision as a whole, not what each option says.
    const itemGroup = (item: EditorialItem) => {
        if (!('choice' in item)) {
            return null;
        }
        const ids = new Set(item.choice.options.map(o => o.categoryId));
        const [id] = [...ids];
        const category = (ids.size == 1 && id) ? score?.properties.categories[id] : null;
        return category ? { id: id!, category } : null;
    };

    const itemCategory = (item: EditorialItem) => itemGroup(item)?.category ?? null;

    const variantGroup = (item: EditorialItem) => {
        const group = item.type == 'app' ? itemGroup(item) : null;
        return group && group.category.apps.length > 1 ? group : null;
    };

    const formatList = (values: string[]) =>
        new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(values);

    const distinct = (values: (string | null)[]): string[] =>
        [...new Set(values.filter((value): value is string => value != null))];

    const describeGroupScope = (item: EditorialItem): string | null => {
        const others = (variantGroup(item)?.category.apps ?? [])
            .filter(appId => appId != item.id)
            .map(appId => editorials?.find(e => e.id == appId))
            .filter((app): app is EditorialItem => app != null);
        const measures = distinct(others.map(app => app.measure));
        if (measures.length == 0) {
            return null;
        }
        if (measures.every(measure => measure == item.measure)) {
            const voices = distinct(others.map(app => app.voice));
            return voices.length > 0
                ? t("editorial.groupAffectsVoices", { voices: formatList(voices) })
                : t("editorial.groupAffectsSameMeasure");
        }
        return t("editorial.groupAffects", {
            count: measures.length,
            measures: formatList(measures),
        });
    };


    const describePlace = (item: EditorialItem): string | null =>
        item.measure == null ? null
            : item.voice
                ? t('editorial.placeAtVoice', { measure: item.measure, voice: item.voice })
                : t('editorial.placeAtMeasure', { measure: item.measure });

    const describePlaceWithStaff = (item: EditorialItem): string | null =>
        item.measure == null ? null
            : item.partN
                ? t('editorial.placeAtStaff', { measure: item.measure, staff: item.partN })
                : t('editorial.placeAtMeasure', { measure: item.measure });

    const describeItemType = (item: EditorialItem) => {
        const type = t(titleKey(item.type))
        const group = itemCategory(item)?.label
        return group ? t("editorial.forGroup", { type, group }) : type
    };


    const getAppChoiceText = (subtype: string, options: Option[], option: Option, includeDescription: boolean) => {
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
        const sourceTitle = option.source && score?.properties.sources[option.source]?.title;
        if (sourceTitle) {
            text = t("editorial.readingFromSource", { reading: text, source: sourceTitle });
        }
        const contentDescription = includeDescription ? describeContentAsString(option.contentDescription) : null;
        return contentDescription ? `${text}: ${contentDescription}` : text;
    };

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
    };

    /** How the reading at `index` reads for this intervention. */
    const describeOption = (item: ChoiceEditorialItem, index: number, includeDescription: boolean) => {
        const options = item.choice.options;
        const subtype = options[index].type;
        if (item.type == "app") {
            return getAppChoiceText(subtype, options, options[index], includeDescription);
        } else if (item.type == "choice") {
            const choiceText = t(titleKey(subtype), { defaultValue: t('editorial.optionNumber', { 'number': 1 + index }) });
            const extraText = includeDescription ? getOptionDescription(options[index]) : null;
            return extraText ? `${choiceText} ${extraText}` : choiceText;
        } else if (item.type == "subst") {
            return getSubstChoiceText(subtype, options, index, includeDescription);
        }
    };

    /** The reading verovio shows when the reader has not chosen: the lem, else the first. */
    const defaultOptionIndex = (item: ChoiceEditorialItem) => {
        if (item.type == "app") {
            // Default app order is: 1) lem, 2) if no lem, first rdg
            const lemIdx = item.choice.options.findIndex(option => option.type == "lem");
            return lemIdx != -1 ? lemIdx : 0;
        }
        // A <choice> shows its first option; verovio renders the first child of a
        // <subst> too, whether that is <add> or <del>.
        return 0;
    };

    const chosenOptions = (type: EditorialItem["type"]) =>
        type == "app" ? appOptions : type == "choice" ? choiceOptions : substOptions;

    /** The reading on show: the reader's pick where there is one, the default otherwise. */
    const selectedOptionIndex = (item: ChoiceEditorialItem) => {
        const chosen = chosenOptions(item.type);
        const picked = item.choice.options.findIndex(option => chosen.includes(option.selector));
        return picked != -1 ? picked : defaultOptionIndex(item);
    };

    /** Whether the reader moved this intervention away from what the score shows itself. */
    const isChanged = (item: ChoiceEditorialItem) =>
        selectedOptionIndex(item) != defaultOptionIndex(item);

    const describeCurrentOption = (item: ChoiceEditorialItem, includeDescription: boolean) =>
        item.choice ? describeOption(item, selectedOptionIndex(item), includeDescription) : null;


    return {
        titleKey,
        getAnnotationText,
        describeContentItem,
        describeContentAsString,
        resolveResp,
        itemGroup,
        itemCategory,
        variantGroup,
        describeGroupScope,
        describePlace,
        describePlaceWithStaff,
        describeItemType,
        describeOption,
        defaultOptionIndex,
        selectedOptionIndex,
        isChanged,
        describeCurrentOption,
    };
}
