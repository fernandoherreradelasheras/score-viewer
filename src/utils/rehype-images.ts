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

const hasScheme = (url: string) => /^[a-z][a-z\d+.-]*:/i.test(url)

// Without a page to resolve against (rendering in Node), a relative document URL gives
// a relative result, the same one the browser must produce for the markup to hydrate.
const resolvePath = (src: string, documentUrl: string) => {
    const path = documentUrl.split(/[?#]/)[0]
    const segments: string[] = []
    for (const segment of [...path.split('/').slice(0, -1), ...src.split('/')]) {
        const last = segments[segments.length - 1]
        if (segment === '.') continue
        if (segment !== '..' || last === undefined || last === '..') segments.push(segment)
        else if (last !== '') segments.pop()
    }
    return segments.join('/')
}

const resolve = (src: string, documentUrl: string) =>
    hasScheme(documentUrl) ? new URL(src, documentUrl).href : resolvePath(src, documentUrl)

const rehypeImages: Plugin<[RehypeImagesOptions?], Root> = (options) => {
    const documentUrl = options?.documentUrl
    return (tree: Root) => {
        visit(tree, 'element', (node: Element) => {
            if (node.tagName === 'img' && node.properties) {
                const src = node.properties.src as string;
                if (src && documentUrl && isDocumentRelative(src)) {
                    node.properties.src = resolve(src, documentUrl);
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
