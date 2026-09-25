import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import type { Plugin } from 'unified';

const rehypeImages: Plugin<[], Root> = () => {
    return (tree: Root) => {
        visit(tree, 'element', (node: Element) => {
            if (node.tagName === 'img' && node.properties) {
                // Make relative paths absolute
                const src = node.properties.src as string;
                if (src && !src.startsWith('/') && !src.startsWith('http')) {
                    node.properties.src = '/' + src;
                }

                const className = node.properties.className
                node.properties.className = [
                    ...(Array.isArray(className) ? className : className ? [className] : []),
                    'text-image'
                ]
            }
        });
    };
};

export default rehypeImages;
