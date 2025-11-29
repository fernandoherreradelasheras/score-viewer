


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


//TODO: This won't be needed once we get a verovio release with this fix:
//      https://github.com/rism-digital/verovio/commit/08fc8db30d4a70b311f6aa1d7681bab0e95c8b5f
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
                if (box.nextSibling) {
                    var bbox = (box.nextElementSibling as SVGAElement)?.getBBox()
                    if (bbox) {
                        if (bbox.width == 0 && bbox.height == 0 && elem == "app" && box.nextElementSibling?.nextElementSibling) {
                            bbox = (box.nextElementSibling.nextElementSibling as SVGAElement)?.getBBox()
                        }
                        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        rect.setAttribute('x', bbox.x.toString());
                        rect.setAttribute('y', bbox.y.toString());
                        rect.setAttribute('width', bbox.width.toString());
                        rect.setAttribute('height', bbox.height.toString());
                        rect.setAttribute('fill', '#8fe3ff');
                        rect.setAttribute('fill-opacity', '0');
                        box.appendChild(rect);
                    }
                }
            }
        });
    })
}

export function expandBBsForRdgs(labels: string[]) {

    const svgContainer = document.querySelector('.svg-container') as SVGSVGElement | null
    const svgElement = document.querySelector('.svg-container svg') as SVGSVGElement | null
    if (!svgElement || !svgContainer) {
        return;
    }

    labels.forEach(label => {
        const escapedLabel = CSS.escape(label);
        const staffs = svgElement.querySelectorAll(`g.staff:has(g.rdg.bounding-box[data-label="${escapedLabel}"])`);
        staffs.forEach(staff => {
            const bbox = (staff as SVGAElement).getBBox()
            const g = staff.querySelector(`g.rdg.bounding-box[data-label="${escapedLabel}"`)
            if (!bbox || !g) {
                return
            }
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute('x', bbox.x.toString());
            rect.setAttribute('y', bbox.y.toString());
            rect.setAttribute('width', bbox.width.toString());
            rect.setAttribute('height', bbox.height.toString());
            rect.classList.add('rdg-recontruction-highlight');
            g.appendChild(rect);
        })
    })
}





