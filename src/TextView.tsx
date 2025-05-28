import { useEffect, useState } from 'react'
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from 'rehype-raw'
import sectionize from 'remark-sectionize'
import { LyricItem } from './types';



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

const renderIntro = (intro: string) => {
    var introText = markdownSubtitle("Introducción")
    introText += intro
    introText += "\n\n"

    return introText
}

const renderPoem = (items: LyricItem[], comments?: string | null) => {
    var poemText = markdownSubtitle("Texto poético")

    var lineNumber = 0
    for (let item of items) {
        if (items.length > 1) {
            poemText += `### ${item.title}\n`
        }
        const { formattedText, lastLineNumber } = formatPoemText(item.text, lineNumber)
        poemText += formattedText
        lineNumber = lastLineNumber
    }

    if (comments) {
        poemText += "\n\n"
        poemText += markdownSubtitle("Notas al texto")
        poemText += comments + "\n\n"
    }
    return poemText
}

export interface TextViewProps {
    title?: string;
    intro?: string;
    items?: LyricItem[];
    comments?: string | null;
}

function TextView(props : TextViewProps) {
    const { title, intro, items, comments } = props
    const [markdownText, setMarkdownText] = useState<string>("")

    useEffect(() => {

        var text = title ? markdownTitle(title) : ""
        if (intro) {
            text += renderIntro(intro)
        } else if (items && items.length > 0) {
          text += renderPoem(items, comments)
        }

        setMarkdownText(text);
    }, [intro, title, items, comments])

    return (
        <div style={{ display: "flex", flexDirection: "row" }}>
        <div className="text-view" style={{ textAlign: "left" }}>
            <Markdown remarkPlugins={[remarkGfm, sectionize]} rehypePlugins={[rehypeRaw]}>{markdownText}</Markdown>
        </div>
        </div>
    )
}

export default TextView
