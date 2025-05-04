import { useEffect, useMemo } from "react";
import useStore from "./store";
import { useEditorialHandler } from "./hooks/useEditorialHandler";
import HoverHighlighter from "./HoverHighlighter";
import { Button, Modal, Radio } from "antd";
import { Tooltip } from "react-tooltip";
import { EditorialItem, Choice, Option } from "./types";
import { expandBBsForEditorialItems } from "./SvgUtils";

function Editorials() {
    const score = useStore.use.score();
    const showingEditorial = useStore.use.showingEditorial();
    const setShowingEditorial = useStore.use.setShowingEditorial();
    const appOptions = useStore.use.appOptions();
    const setAppOptions = useStore.use.setAppOptions();
    const choiceOptions = useStore.use.choiceOptions();
    const setChoiceOptions = useStore.use.setChoiceOptions();
    const renderedSvgData = useStore.use.renderedSvgData();

    const editorials = score?.editorialItems;

    //custom hook for editorial handling
    const { formatType } = useEditorialHandler();

    const TOOLTIP_SELECTOR = useMemo(() =>
        ['corr', 'unclear', 'sic', 'app', 'choice', 'lem', 'reg', 'orig', 'supplied', 'clef[data-corresp]']
        .map(e => `svg .${e}:not(.bounding-box)`).join(", ")
    ,[])

    const showingEditorialItem = showingEditorial ? editorials?.find(e => e.id == showingEditorial) : null;

    const getAnnotationText = (item: EditorialItem) => {
        if (item.annotations.size <= 0) {
            return null;
        }
        const annot = item.annotations.values().next().value;

        return annot != null ? <p>{annot.text}</p> : null;
    };


    const getChoiceText = (type: string, subtype: string, options: Option[], index: number) => {
        if (type == "app") {
            if (subtype == "lem") {
                return "lectura preferida";
            }
            const rdgs = options.filter(o => o.type == "rdg");
            if (rdgs.length == 1) {
                return "lectura alternativa";
            }
            return `lectura alternativa nº${1 + rdgs.findIndex(r => r == options[index])}`;
        } else if (type == "choice") {
            if (subtype == "reg") {
                return "lectura regularizada";
            } else if (subtype == "orig") {
                return "lectura original";
            } else {
                return `opción ${1 + index}`;
            }
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

    useEffect(() => {
        if (showingEditorial) {
            expandBBsForEditorialItems();
        }
    }
    , [showingEditorial]);


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
                <p>Actualmente se muestra la {getChoiceText(type, subtype, choice.options, selectedOptionIdx)} </p>
                <p>Opciones disponibles:</p>
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
                            render={getTooltipContent}/>

            {renderedSvgData?.id && <HoverHighlighter svgId={renderedSvgData.id} />}

            {showingEditorialItem ? (
                <Modal
                    title={formatType(showingEditorialItem!.type)}
                    open={showingEditorialItem != null && showingEditorialItem != undefined}
                    onCancel={() => setShowingEditorial(null)}
                    footer={
                        <Button type="primary" onClick={() => setShowingEditorial(null)}>Ok</Button>
                    }>

                    {showingEditorialItem!.reason != "" ? <p>{`Razon: ${showingEditorialItem!.reason}`}</p> : ""}
                    {showingEditorialItem!.resp != "" ? <p>{`Responsable: ${showingEditorialItem!.resp}`}</p> : ""}
                    {getAnnotationText(showingEditorialItem!)}
                    {getChoices(showingEditorialItem!)}
                </Modal>
            ) : null}
        </div>
    );
}

export default Editorials;