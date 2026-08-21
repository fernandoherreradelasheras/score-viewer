
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


const GROUP_CLASS = "editorial-group-member";
const GROUP_HOVER_CLASS = "editorial-group-hover";

// Every <app> of a variant group carries the group on `data-group`, stamped when the
// page is rendered (see setSvgGroupsForEditorial): both marks below are that one lookup.
const groupApps = (container: HTMLElement | null, group: string) =>
    [...container?.querySelectorAll("svg [data-group]") ?? []]
        .filter(app => app.getAttribute("data-group") == group);

/**
 * Mark every <app> a decision reaches while its dialog is open, the clicked one
 * included, so the reader sees the whole of what the choice moves before taking it.
 */
export const markEditorialGroup = (container: HTMLElement | null, group: string) => {
    const apps = groupApps(container, group);
    apps.forEach(app => app.classList.add(GROUP_CLASS));
    return apps.length;
};

export const clearEditorialGroup = (container: HTMLElement | null) => {
    container?.querySelectorAll(`.${GROUP_CLASS}`).forEach(e => e.classList.remove(GROUP_CLASS));
};

/**
 * The group under the pointer, lit as a whole: hovering one <app> of a group is
 * hovering the decision, and the reader should see its reach before clicking rather
 * than only once the dialog is up. Returns the group now marked, so a caller that
 * tracks it can skip the work while the pointer stays within the same one.
 */
export const markEditorialGroupHover = (container: HTMLElement | null, target: EventTarget | null) => {
    const group = (target instanceof Element ? target.closest("[data-group]") : null)
        ?.getAttribute("data-group") ?? null;
    clearEditorialGroupHover(container);
    if (group) {
        groupApps(container, group).forEach(app => app.classList.add(GROUP_HOVER_CLASS));
    }
    return group;
};

export const clearEditorialGroupHover = (container: HTMLElement | null) => {
    container?.querySelectorAll(`.${GROUP_HOVER_CLASS}`).forEach(e => e.classList.remove(GROUP_HOVER_CLASS));
};
