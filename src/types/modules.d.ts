declare module '@microflash/rehype-figure' {
    import type { Plugin } from 'unified';
    import type { Root } from 'hast';

    const rehypeFigure: Plugin<[], Root>;
    export default rehypeFigure;
}

declare module '*?asset' {
    const url: string;
    export default url;
}
