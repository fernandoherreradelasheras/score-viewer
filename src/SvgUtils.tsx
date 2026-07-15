
// @ts-ignore
const interactiveHighlightFilter = (
    <filter id="interactive-highlight" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
        <feFlood floodColor="#3498db" floodOpacity="0.7" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="shadow" />
        <feComposite in="SourceGraphic" in2="shadow" operator="over" />
    </filter>
);

// @ts-ignore
const interactiveActiveFilter = (
    <filter id="interactive-active" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
        <feFlood floodColor="#e74c3c" floodOpacity="0.8" result="color" />
        <feComposite in="color" in2="blur" operator="in" result="shadow" />
        <feComposite in="SourceGraphic" in2="shadow" operator="over" />
    </filter>
);

export const svgFilter = (id: string, color: string, initialRadius: number) =>
    <filter id={`highlighting-${id}`} x="-100%" y="-100%" width="300%" height="300%">
        <feMorphology id={`radius-${id}`} in="SourceAlpha" operator="dilate" radius={initialRadius} result="expanded" />

        <feFlood floodColor={color} floodOpacity="0.6" result="color" />
        <feComposite in="color" in2="expanded" operator="in" result="colored-background" />
        <feComposite in="SourceGraphic" in2="colored-background" operator="over" />

    </filter>




export const SVG_EDITORIAL_FILTERS =
    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "0px", width: "0px" }}>
        <defs>
            {interactiveHighlightFilter}
            {interactiveActiveFilter}
        </defs>
    </svg>





