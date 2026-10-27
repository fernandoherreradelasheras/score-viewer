import { SKIP, visit } from 'unist-util-visit';
import type { Root, Element, ElementContent } from 'hast';
import type { Plugin } from 'unified';

const isFigure = (node: ElementContent) => node.type === 'element' && node.tagName === 'figure'

const isBlank = (nodes: ElementContent[]) =>
    nodes.every(node => node.type === 'text' && node.value.trim() === '')

// rehype-figure makes a figure of every image with alt text, even of one inside a
// paragraph's text. HTML cannot nest a <figure> in a <p>, so a browser parsing the markup
// rendered in Node would split the paragraph and the page would no longer hydrate. The
// paragraph is split here the same way.
const rehypeFigureParagraphs: Plugin<[], Root> = () => {
    return (tree: Root) => {
        visit(tree, 'element', (node: Element, index, parent) => {
            if (node.tagName !== 'p' || !parent || index === undefined || !node.children.some(isFigure)) return

            const split: ElementContent[] = []
            let run: ElementContent[] = []
            const closeRun = () => {
                if (!isBlank(run)) split.push({ ...node, children: run })
                run = []
            }
            for (const child of node.children) {
                if (isFigure(child)) {
                    closeRun()
                    split.push(child)
                } else {
                    run.push(child)
                }
            }
            closeRun()

            parent.children.splice(index, 1, ...split)
            return [SKIP, index + split.length]
        });
    };
};

export default rehypeFigureParagraphs;
