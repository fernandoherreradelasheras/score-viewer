import { useCallback, useEffect, useState } from 'react'
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from 'rehype-raw'
import rehypeExternalLinks from 'rehype-external-links';
import sectionize from 'remark-sectionize'
import { FetchError, LyricItem } from './types';
import ErrorView from './ErrorView';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import useStore from './store';
import { CloseOutlined } from '@ant-design/icons';
import rehypeImages from './utils/rehype-images'
import rehypeFigure from "@microflash/rehype-figure";

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
    var lastLineNumber = initialLineNumber

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


export interface TextViewProps {
    title?: string;
    intro?: string | FetchError | null;
    items?: LyricItem[] | null;
    comments?: string | null;
}

function TextView(props: TextViewProps) {
    const { t } = useTranslation("common");
    const splitView = useStore.use.isSplitView();
    const setSplitView = useStore.use.setIsSplitView();
    const { title, intro, items, comments } = props
    const [markdownText, setMarkdownText] = useState<string>("")

    const renderIntro = (intro: string | FetchError) => {
        var introText = markdownSubtitle(t("textView.intro"))
        if (intro instanceof FetchError) {
            introText += `**${t("error.fetchTextSeeErrorAbove")}**\n\n`
        } else {
            introText += intro
        }
        introText += "\n\n"

        return introText
    }

    const renderPoem = (items: LyricItem[], comments?: string | null) => {
        var poemText = markdownSubtitle(t("textView.poeticText"))

        var lineNumber = 0
        for (let item of items) {
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

    const close = useCallback(() => {
        setSplitView(false);
    }, [splitView, setSplitView]);

    useEffect(() => {
        var text = title ? markdownTitle(title) : ""
        if (intro) {
            text += renderIntro(intro)
        } else if (items && items.length > 0) {
            text += renderPoem(items, comments)
        }

        setMarkdownText(text);
    }, [intro, title, items, comments])


    const introError = intro instanceof FetchError ? intro : null
    const errorView = introError ?
        <ErrorView message={t('error.fetchErrorDescription')} description={
            <div>
                <ul>
                    <li key="intro">
                        <strong>{t('error.fetchIntroError')}:</strong> {introError.message}
                    </li>
                </ul>
            </div>
        } /> : null

    return (
        <div>
            {splitView ?
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button icon={<CloseOutlined />} onClick={() => close()} />
                </div>
                : null}

            {errorView ? errorView : null}
            <div style={{ display: "flex", flexDirection: "row" }}>

                <div className="text-view" style={{ textAlign: "left", maxWidth: "1000px" }}>
                    <Markdown
                        remarkPlugins={[remarkGfm, sectionize]}
                        rehypePlugins={[
                            rehypeRaw,
                            rehypeImages,
                            rehypeFigure,
                            [rehypeExternalLinks, { target: "_blank", rel: "noopener noreferrer" }]
                        ]}>{markdownText}</Markdown>
                </div>
            </div>
        </div>
    )
}

export default TextView
