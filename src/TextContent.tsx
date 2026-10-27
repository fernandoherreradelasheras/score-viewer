import { CSSProperties, useMemo } from 'react'
import Markdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from 'rehype-raw'
import rehypeExternalLinks from 'rehype-external-links';
import sectionize from 'remark-sectionize'
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { LyricItem } from './types';
import rehypeImages from './utils/rehype-images'
import rehypePoemBlock from './utils/rehype-poem-block'
import rehypeFigure from "@microflash/rehype-figure";
import rehypeFigureParagraphs from './utils/rehype-figure-paragraphs'
import { parsePoemFromMei, XmlParser } from './utils/poem-from-mei';

const markdownTitle = (title: string) => `# ${title}\n\n`
const markdownSubtitle = (subtitle: string) => `## ${subtitle}\n\n`

const lineNumberMark = (lineNumber: number) =>
    lineNumber % 5 == 0
        ? `<span class="line-number" style="float: right; margin-right: -20px;" > ${lineNumber}</span>`
        : ""

// Assemble a block's strophes into markdown: each verse is italic, verses of a
// strophe are joined by a hard line break, strophes are separated by a blank
// line, and every 5th verse (counted continuously across blocks) shows its
// line number. `initialLineNumber` continues the count from previous blocks.
const formatStrophes = (strophes: string[][], initialLineNumber: number) => {
    let lastLineNumber = initialLineNumber

    const renderedStrophes = strophes.map((verses) =>
        verses
            .map((verse) => {
                lastLineNumber += 1
                return `*${verse}*${lineNumberMark(lastLineNumber)}`
            })
            .join("\\\n")
    )

    const formattedText = renderedStrophes.join("\n\n") + "\n\n"
    return { formattedText, lastLineNumber }
}

const introMarkdown = (t: TFunction, markdown: string, title?: string) =>
    (title ? markdownTitle(title) : "") + markdownSubtitle(t("textView.intro")) + markdown + "\n\n"

const poemMarkdown = (t: TFunction, items: LyricItem[], comments?: string | null, title?: string) => {
    let poemText = (title ? markdownTitle(title) : "") + markdownSubtitle(t("textView.poeticText"))

    let lineNumber = 0
    for (const item of items) {
        if (items.length > 1) {
            poemText += `### ${item.title}\n`
        }
        const { formattedText, lastLineNumber } = formatStrophes(item.strophes, lineNumber)
        poemText += formattedText
        lineNumber = lastLineNumber
    }

    if (comments) {
        poemText += "\n\n"
        poemText += markdownSubtitle(t("textView.notes"))
        poemText += comments + "\n\n"
    }
    return poemText
}

interface TextContentProps {
    title?: string;
    // Language of the headings the component adds; the viewer's current one if not given.
    language?: string;
    // Overrides for the elements react-markdown writes, such as `img`.
    components?: Components;
    style?: CSSProperties;
}

function MarkdownContent({ text, documentUrl, t, components, style }:
    TextContentProps & { text: string, documentUrl?: string | null, t: TFunction }) {
    const remarkRehypeOptions = useMemo(() => ({
        footnoteLabel: t("textView.footnotes"),
        footnoteBackLabel: (referenceIndex: number, rereferenceIndex: number) =>
            t("textView.backToReference", {
                reference: `${referenceIndex + 1}${rereferenceIndex > 1 ? `-${rereferenceIndex}` : ""}`
            }),
    }), [t])

    return (
        <div className="text-view" style={style}>
            <Markdown
                components={components}
                remarkPlugins={[remarkGfm, sectionize]}
                remarkRehypeOptions={remarkRehypeOptions}
                rehypePlugins={[
                    rehypeRaw,
                    rehypePoemBlock,
                    [rehypeImages, { documentUrl }],
                    rehypeFigure,
                    rehypeFigureParagraphs,
                    [rehypeExternalLinks, { target: "_blank", rel: "noopener noreferrer" }]
                ]}>{text}</Markdown>
        </div>
    )
}

export interface IntroContentProps extends TextContentProps {
    markdown: string;
    // URL the introduction was fetched from, to resolve its "./" image paths.
    documentUrl?: string | null;
}

export function IntroContent({ markdown, documentUrl, title, language, ...props }: IntroContentProps) {
    const { t } = useTranslation("common", { lng: language })
    const text = useMemo(() => introMarkdown(t, markdown, title), [t, markdown, title])
    return <MarkdownContent text={text} documentUrl={documentUrl} t={t} {...props} />
}

export interface PoemItemsContentProps extends TextContentProps {
    items: LyricItem[];
    comments?: string | null;
}

export function PoemItemsContent({ items, comments, title, language, ...props }: PoemItemsContentProps) {
    const { t } = useTranslation("common", { lng: language })
    const text = useMemo(() => poemMarkdown(t, items, comments, title), [t, items, comments, title])
    return <MarkdownContent text={text} t={t} {...props} />
}

export interface PoemContentProps extends TextContentProps {
    // The MEI file; the poem is read from `<back><div type="poem">`.
    mei: string;
    // Where there is no `DOMParser`, as in Node, one with the same interface such as
    // the one from @xmldom/xmldom.
    domParser?: XmlParser;
}

// Renders nothing when the MEI has no poem.
export function PoemContent({ mei, domParser, ...props }: PoemContentProps) {
    const { lyrics, comments } = useMemo(() => parsePoemFromMei(mei, domParser), [mei, domParser])
    return lyrics.length > 0 ? <PoemItemsContent items={lyrics} comments={comments} {...props} /> : null
}
