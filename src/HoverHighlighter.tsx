import useHoverHighlighter from "./hooks/useHoverHighlighter";

/**
 * Component that provides hover highlighting effect for SVG elements
 * @param svgId ID of the SVG element to highlight on hover
 * @returns React component with hover highlighting capabilities
 */
function HoverHighlighter({ svgId }: { svgId: string }) {
  const { hoverFilterElement } = useHoverHighlighter(svgId);

  return (
    <div style={{ height: "0px", width: "0px" }}>
      {hoverFilterElement}
    </div>
  );
}

export default HoverHighlighter;