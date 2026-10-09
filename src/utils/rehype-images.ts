import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import type { Plugin } from 'unified';

export interface RehypeImagesOptions {
    // URL of the markdown document. Paths starting with "./" or "../" are resolved
    // against it, so a text and its images can live in the same folder wherever the
    // site is deployed.
    documentUrl?: string | null;
}

const isDocumentRelative = (src: string) => src.startsWith('./') || src.startsWith('../')

const rehypeImages: Plugin<[RehypeImagesOptions?], Root> = (options) => {
    const documentUrl = options?.documentUrl
    return (tree: Root) => {
        visit(tree, 'element', (node: Element) => {
            if (node.tagName === 'img' && node.properties) {
                const src = node.properties.src as string;
                if (src && documentUrl && isDocumentRelative(src)) {
                    node.properties.src = new URL(src, new URL(documentUrl, document.baseURI)).href;
                } else if (src && !src.startsWith('/') && !src.startsWith('http')) {
                    // Other relative paths are taken from the site root
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
