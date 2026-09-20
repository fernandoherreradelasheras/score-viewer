import { visit } from 'unist-util-visit';
import type { Root, Element, ElementContent } from 'hast';
import type { Plugin } from 'unified';

const POEM_BLOCK_CLASS = 'poem-block';
const LINE_NUMBER_CLASS = 'line-number';

const classNames = (node: Element): string[] => {
    const className = node.properties?.className as string | (string | number)[] | undefined;
    if (Array.isArray(className)) return className.map(String);
    return typeof className === 'string' ? className.split(/\s+/) : [];
};

const hasLineNumber = (nodes: ElementContent[]): boolean =>
    nodes.some(node =>
        node.type === 'element' &&
        (classNames(node).includes(LINE_NUMBER_CLASS) || hasLineNumber(node.children)));

// Marks the section a poem was assembled into, which the stylesheet centres on its
// longest verse. The line numbers TextView writes every fifth verse are what tells a
// poem apart from any other section, and asking for them with :has() would leave the
// poem laid out full width on Firefox before 121.
const rehypePoemBlock: Plugin<[], Root> = () => {
    return (tree: Root) => {
        visit(tree, 'element', (node: Element) => {
            if (node.tagName === 'section' && hasLineNumber(node.children)) {
                node.properties = node.properties ?? {};
                node.properties.className = [...classNames(node), POEM_BLOCK_CLASS];
            }
        });
    };
};

export default rehypePoemBlock;
