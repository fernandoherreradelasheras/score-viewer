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


const markdownTitle = (title: string) => `# ${title}\n\n`
const markdownSubtitle = (subtitle: string) => `## ${subtitle}\n\n`

const formatPoemText = (text: string, initialLineNumber: number) => {
    var formattedText = "";
    var lastLineNumber = initialLineNumber

    for (let line of text.split('\n')) {

        if (line == "") {
            formattedText = formattedText.slice(0, -2) + "\n\n"
        } else if (line.startsWith("[") && line.endsWith("]")) {
            formattedText += `### ${line.slice(1, -1)}\n`
        } else {
            lastLineNumber += 1
            if (lastLineNumber % 5 == 0) {
                formattedText += `*${line}*<span class="line-number" style="float: right; margin-right: -20px;" > ${lastLineNumber}</span>\\\n`
            } else {
                formattedText += `*${line}*\\\n`
            }
        }
    }
    return { formattedText, lastLineNumber }

}


export interface TextViewProps {
    title?: string;
    intro?: string | FetchError | null;
    items?: LyricItem[] | null;
    comments?: string | FetchError | null;
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

    const renderPoem = (items: LyricItem[], comments?: string | FetchError | null) => {
        var poemText = markdownSubtitle(t("textView.poeticText"))

        var lineNumber = 0
        for (let item of items) {
            if (items.length > 1) {
                poemText += `### ${item.title}\n`
            }
            if (item.text instanceof FetchError) {
                poemText += `**${t("error.fetchTextSeeErrorAbove")}**\n\n`
            } else {
                const { formattedText, lastLineNumber } = formatPoemText(item.text, lineNumber)
                poemText += formattedText
                lineNumber = lastLineNumber
            }
        }

        if (comments) {
            poemText += "\n\n"
            poemText += markdownSubtitle(t("textView.notes"))
            if (comments instanceof FetchError) {
                poemText += `**${t("error.fetchTextSeeErrorAbove")}**\n\n`
            } else {
                poemText += comments + "\n\n"
            }
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
    const itemsErrors = items ? items.filter(item => item.text instanceof FetchError) : []
    const commentsError = comments instanceof FetchError ? comments : null

    const fetchErrors = [intro, ...items ? items.map(item => item.text) : [], comments]
        .filter(e => e instanceof FetchError)
    const errorView = fetchErrors.length > 0 ?
        <ErrorView message={t('error.fetchErrorDescription')} description={
            <div>
                <ul>
                    {introError ?<li key="intro">
                        <strong>{t('error.fetchIntroError')}:</strong> {introError.message}
                    </li> : null}
                    {itemsErrors.map((item, index) => (
                        <li key={index}>
                            <strong>{t('error.fetchLyricsItemErrorWithSection', { section: item.title })}:</strong>
                            {(item.text as FetchError).message}
                        </li>
                    ))}
                    {commentsError ?<li key="comments">
                        <strong>{t('error.fetchTextCommentsError')}:</strong> {commentsError.message}
                    </li> : null}
                </ul>
            </div>
        } /> : null


    return (
        <div>
            { splitView ?
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button icon={<CloseOutlined />} onClick={() => close()}/>
            </div>
            : null }

            {errorView ? errorView : null}
            <div style={{ display: "flex", flexDirection: "row" }}>

                <div className="text-view" style={{ textAlign: "left" }}>
                    <Markdown
                        remarkPlugins={[remarkGfm, sectionize]}
                        rehypePlugins={[
                            rehypeRaw,
                            [rehypeExternalLinks, { target: "_blank", rel: "noopener noreferrer" }]
                        ]}>{markdownText}</Markdown>
                </div>
            </div>
        </div>
    )
}

export default TextView
