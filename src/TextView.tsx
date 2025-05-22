import { useEffect, useState } from 'react'
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from 'rehype-raw'
import { LyricItem } from './types';


const markdownTitle = (title: string) => `## ${title}\n\n`

const formatText = (text: string, initialLineNumber: number) => {
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
                    formattedText += `*${line}*<span style="float: right; margin-right: -20px;" > ${lastLineNumber}</span>\\\n`
                } else {
                    formattedText += `*${line}*\\\n`
                }
            }
        }
        return { formattedText, lastLineNumber }

}


function TextView({ title, items }: { title: string, items: LyricItem[] }) {

    const [markdownText, setMarkdownText] = useState<string>("")

    useEffect(() => {
        var newText = "";
        newText += markdownTitle(title)
        var lineNumber = 0

        for (let item of items) {
            if (items.length > 1) {
                newText += `### ${item.title}\n`
            }
            const { formattedText, lastLineNumber } = formatText(item.text, lineNumber)
            newText += formattedText
            lineNumber = lastLineNumber
        }

        setMarkdownText(newText);
    }, [title, items]);

    return (
        <div style={{ display: "flex", flexDirection: "row" }}>
        <div className="text-view" style={{ textAlign: "left" }}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{markdownText}</Markdown>
        </div>
        </div>
    )
}

export default TextView