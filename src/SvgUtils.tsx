import { LINK_HIGHLIGHT_MS } from "./types";

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

// Every <app>, <choice> or <subst> of a variant group carries the group on `data-group`,
// stamped when the page is rendered (see setSvgGroupsForEditorial): both marks below are
// that one lookup.
const groupApps = (container: HTMLElement | null, group: string) =>
    [...container?.querySelectorAll("svg [data-group]") ?? []]
        .filter(app => app.getAttribute("data-group") == group);

/**
 * Mark every container a decision reaches while its dialog is open, the clicked one
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
 * The group under the pointer, lit as a whole: hovering one member of a group is
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


const HIGHLIGHTED_CLASS = "highlighted";

// Carried by the <svg> itself while it holds a highlighted element, so the rules that
// need to know about it do not have to ask for it with :has(), which Firefox only
// understands from 121 on.
const WITH_HIGHLIGHTED_CLASS = "with-highlighted";

export const markHighlighted = (container: HTMLElement | null, elementId: string) => {
    const svg = container?.querySelector("svg");
    const element = svg?.querySelector(`[id="${CSS.escape(elementId)}"]`);
    if (element == null) {
        return false;
    }
    element.classList.add(HIGHLIGHTED_CLASS);
    svg?.classList.add(WITH_HIGHLIGHTED_CLASS);
    return true;
};

export const clearHighlighted = (container: HTMLElement | null) => {
    container?.querySelectorAll(`.${HIGHLIGHTED_CLASS}`).forEach(e => e.classList.remove(HIGHLIGHTED_CLASS));
    container?.querySelectorAll(`svg.${WITH_HIGHLIGHTED_CLASS}`).forEach(e => e.classList.remove(WITH_HIGHLIGHTED_CLASS));
};


const LINK_FRAME_CLASS = "score-link-frame";
const LINK_FRAME_PADDING = 0.3;

// A frame around an element reached from the facsimile. Placed beside the element, whose
// box is already in the coordinates of its parent: verovio puts no transform on it.
export const markLinkFrame = (container: HTMLElement | null, elementId: string) => {
    const element = container?.querySelector("svg")?.querySelector(`[id="${CSS.escape(elementId)}"]`);
    if (!(element instanceof SVGGraphicsElement) || element.parentNode == null) {
        return false;
    }
    const box = element.getBBox();
    const padding = Math.min(box.width, box.height) * LINK_FRAME_PADDING;
    const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    frame.setAttribute("class", LINK_FRAME_CLASS);
    frame.setAttribute("x", `${box.x - padding}`);
    frame.setAttribute("y", `${box.y - padding}`);
    frame.setAttribute("width", `${box.width + 2 * padding}`);
    frame.setAttribute("height", `${box.height + 2 * padding}`);
    frame.setAttribute("rx", `${padding}`);
    frame.style.animationDuration = `${LINK_HIGHLIGHT_MS}ms`;
    element.parentNode.insertBefore(frame, element.nextSibling);
    setTimeout(() => frame.remove(), LINK_HIGHLIGHT_MS);
    frame.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    return true;
};

export const clearLinkFrame = (container: HTMLElement | null) => {
    container?.querySelectorAll(`.${LINK_FRAME_CLASS}`).forEach(e => e.remove());
};
