import { useEffect, useState } from 'react'
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from 'rehype-raw'


const markdownTitle = (title: string) => `## ${title}\n\n`


function TextView({ title, text }: { title: string, text: string }) {

    const [markdownText, setMarkdownText] = useState<string>("")

    useEffect(() => {
        var newText = "";
        var lineNumber = 0
        newText += markdownTitle(title)
        for (let line of text.split('\n')) {
            if (line == "") {
                newText = newText.slice(0, -2) + "\n\n"
            } else if (line.startsWith("[") && line.endsWith("]")) {
                newText += `### ${line.slice(1, -1)}\n`
            } else {
                lineNumber += 1
                if (lineNumber % 5 == 0) {
                    newText += `*${line}*<span style="float: right; margin-right: -20px;" > ${lineNumber}</span>\\\n`
                } else {
                    newText += `*${line}*\\\n`
                }
            }
        }
        setMarkdownText(newText);
    }, [title, text]);

    return (
        <div style={{ display: "flex", flexDirection: "row" }}>
        <div className="text-view" style={{ textAlign: "left" }}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{markdownText}</Markdown>
        </div>
        </div>
    )
}

export default TextView