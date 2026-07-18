// Workaround temporal: verovio 6.0.1 añadió opciones que aún no están en
// @types/verovio (5.1.0). Al ser VerovioOptions un `interface`, TypeScript
// permite ampliarlo por declaration merging. Eliminar cuando @types/verovio
// incluya svgContentBoundingBoxes.
import 'verovio';

declare module 'verovio' {
  interface VerovioOptions {
    svgContentBoundingBoxes?: boolean;
    svgAria?: boolean;
    expandNever?: boolean;
    expandAlways?: boolean;
  }
}
