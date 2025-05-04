


// @ts-ignore
const interactiveHighlightFilter = (
<filter id="interactive-highlight" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
    <feFlood floodColor="#3498db" floodOpacity="0.7" result="color"/>
    <feComposite in="color" in2="blur" operator="in" result="shadow"/>
    <feComposite in="SourceGraphic" in2="shadow" operator="over"/>
</filter>
);

// @ts-ignore
const interactiveActiveFilter = (
<filter id="interactive-active" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
    <feFlood floodColor="#e74c3c" floodOpacity="0.8" result="color"/>
    <feComposite in="color" in2="blur" operator="in" result="shadow"/>
    <feComposite in="SourceGraphic" in2="shadow" operator="over"/>
</filter>
);

export const svgFilter = (id: string, color: string, initialRadius: number) =>
    <filter id={`highlighting-${id}`} x="-100%" y="-100%" width="300%" height="300%">
        <feMorphology id={`radius-${id}`} in="SourceAlpha" operator="dilate" radius={initialRadius} result="expanded"/>

        <feFlood floodColor={color} floodOpacity="0.6" result="color"/>
        <feComposite in="color" in2="expanded" operator="in" result="colored-background"/>
        <feComposite in="SourceGraphic" in2="colored-background" operator="over"/>

    </filter>




export const SVG_EDITORIAL_FILTERS =
<svg xmlns="http://www.w3.org/2000/svg" style={{height:"0px", width:"0px"}}>
<defs>
    {interactiveHighlightFilter}
    {interactiveActiveFilter}
</defs>
</svg>

// @ts-ignore
export function expandBBsForEditorialItems() {

    const svgContainer = document.querySelector('.svg-container') as SVGSVGElement | null

    const svgElement = document.querySelector('.svg-container svg') as SVGSVGElement | null
    if (!svgElement || !svgContainer) {
        return;
    }

    ["app", "choice", "corr", "sic", "unclear", "supplied", "reg"].forEach((elem) => {
        const boundingBoxes = svgElement.querySelectorAll(`g .${elem}.bounding-box`);
        boundingBoxes.forEach(box => {
            if ((box as SVGAElement).childElementCount == 0) {
                console.log (`found empty bouding box in a ${elem}. Looking for siblings...`)
                if (box.nextSibling) {
                    const bbox = (box.nextElementSibling as SVGAElement)?.getBBox()
                    if (bbox) {
                        console.log(`Got a bb from ${box.nextElementSibling}`)
                        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        rect.setAttribute('x', bbox.x.toString());
                        rect.setAttribute('y', bbox.y.toString());
                        rect.setAttribute('width', bbox.width.toString());
                        rect.setAttribute('height', bbox.height.toString());
                        rect.setAttribute('fill', '#8fe3ff');
                        rect.setAttribute('fill-opacity', '0.2');

                        box.appendChild(rect);
                    }
                }
            }
        });
    })
}


