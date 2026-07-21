const svgFilter = (id: string, color: string, initialRadius: number) =>
  <filter id={`highlighting-${id}`} x="-100%" y="-100%" width="300%" height="300%">
    <feMorphology id={`radius-${id}`} in="SourceAlpha" operator="dilate" radius={initialRadius} result="expanded" />

    <feFlood floodColor={color} floodOpacity="0.6" result="color" />
    <feComposite in="color" in2="expanded" operator="in" result="colored-background" />
    <feComposite in="SourceGraphic" in2="colored-background" operator="over" />

  </filter>

/**
 * Custom hook to create SVG-based hover highlighting effects
 * @param svgId ID of the SVG element to apply hovering effects to
 * @param color Optional highlight color (defaults to #fe3b20)
 * @param radius Optional initial radius value (defaults to 0)
 * @returns JSX element containing the SVG filter for hover highlighting
 */
export default function useHoverHighlighter(svgId: string, color: string = "#fe3b20", radius: number = 0) {
  // Create the SVG hover filter element
  const hoverFilterElement = (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "0px", width: "0px" }}>
      <defs>
        {svgFilter("hover", color, radius)}
      </defs>
      <animate
        id="radius-hover-animation"
        xlinkHref="#radius-hover"
        attributeName="radius"
        begin={`${svgId}.mouseover`}
        from="0"
        to="50"
        dur="0.1s"
        fill="freeze"
        repeatCount="1"
        restart="whenNotActive"
      />
    </svg>
  );

  return {
    hoverFilterElement
  };
}