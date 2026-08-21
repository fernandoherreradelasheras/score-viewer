
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

export const SVG_EDITORIAL_FILTERS =
    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: "0px", width: "0px" }}>
        <defs>
            {interactiveHighlightFilter}
            {interactiveActiveFilter}
        </defs>
    </svg>






const PENDING_CLASS = "editorial-pending";


export const EDITORIAL_PENDING_MAX_FADE_MS = 500;
export const EDITORIAL_PENDING_MIN_FADE_MS = 200;

export const markEditorialPending = (id: string, duration: number) => {
    const element = document.getElementById(id);
    if (!element) {
        return;
    }
    console.log(`Marking editorial element ${id} as pending for ${duration}ms`);
    // Set before the class, so the transition starts with the duration it is meant to
    // have rather than with the fallback.
    element.style.setProperty("--editorial-pending-fade", `${Math.round(duration)}ms`);
    element.classList.add(PENDING_CLASS);
};

export const clearEditorialPending = (container: HTMLElement | null) => {
    container?.querySelectorAll(`.${PENDING_CLASS}`).forEach(e => e.classList.remove(PENDING_CLASS));
};
