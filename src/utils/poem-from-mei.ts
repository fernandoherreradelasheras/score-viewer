import { LyricItem } from '../types';

const MEI_NS = 'http://www.music-encoding.org/ns/mei';

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export interface PoemFromMei {
  // One entry per text block (`<lg>`) under the poem, in document order. Each
  // carries its strophes (and their verses) as structured data; TextView turns
  // them into markdown and adds the line numbers.
  lyrics: LyricItem[];
  // Markdown for the notes section
  comments: string | null;
}

const capitalize = (s: string) => (s.length ? s[0].toUpperCase() + s.slice(1) : s);

const childrenByLocalName = (parent: Element, name: string): Element[] =>
  Array.from(parent.children).filter((c) => c.localName === name);

const normalizeText = (el: Element): string =>
  (el.textContent ?? '').replace(/\s+/g, ' ').trim();

// Direct `<annot type="text-note">` children of an element.
const directTextNotes = (parent: Element): Element[] =>
  childrenByLocalName(parent, 'annot').filter((a) => a.getAttribute('type') === 'text-note');

// Text of a verse `<l>`, excluding any nested `<annot type="text-note">` (the
// text note) together with the whitespace/newline that precedes it inside the
// `<l>`. Only direct child text and non-annot elements contribute.
const verseText = (l: Element): string => {
  let text = '';
  for (const node of Array.from(l.childNodes)) {
    if (node.nodeType === TEXT_NODE) {
      text += node.textContent ?? '';
    } else if (node.nodeType === ELEMENT_NODE && (node as Element).localName !== 'annot') {
      text += (node as Element).textContent ?? '';
    }
  }
  return text.replace(/\s+/g, ' ').trim();
};

const findPoemDiv = (doc: Document): Element | null => {
  const divs = Array.from(doc.getElementsByTagNameNS(MEI_NS, 'div'));
  return (
    divs.find(
      (d) => d.getAttribute('type') === 'poem' && d.parentElement?.localName === 'back'
    ) ?? null
  );
};

// Header shown for a block: the `<label>` text if present, otherwise the
// capitalized `@type` ("coplas" -> "Coplas").
const blockHeader = (block: Element): string => {
  const label = childrenByLocalName(block, 'label')[0];
  const labelText = label ? normalizeText(label) : '';
  if (labelText.length > 0) {
    return labelText;
  }
  return capitalize(block.getAttribute('type') ?? '');
};

const extractBlocks = (poemDiv: Element): LyricItem[] => {
  return childrenByLocalName(poemDiv, 'lg').map((block) => {
    const nestedStrophes = childrenByLocalName(block, 'lg');
    const strophes =
      nestedStrophes.length > 0
        ? nestedStrophes.map((s) => childrenByLocalName(s, 'l').map(verseText))
        : [childrenByLocalName(block, 'l').map(verseText)];
    return { title: blockHeader(block), strophes };
  });
};

// Text notes are `<annot type="text-note">`. Each note is a child of the `<l>`
// it annotates, so the verse number is that `<l>`'s 1-based position among ALL
// `<l>` in the poem (or `@n` when present). Notes placed directly under the poem
// div are global notes shown without a number.
const extractComments = (poemDiv: Element): string | null => {
  const allL = Array.from(poemDiv.getElementsByTagNameNS(MEI_NS, 'l'));

  const notes: { pos: number | null; disp: string | null; body: string }[] = [];

  const pushNote = (a: Element, pos: number | null) => {
    const nAttr = a.getAttribute('n');
    const disp = nAttr != null ? nAttr : pos != null ? String(pos) : null;
    notes.push({ pos, disp, body: normalizeText(a) });
  };

  // The note lives inside the `<l>` it annotates.
  allL.forEach((l, i) => directTextNotes(l).forEach((a) => pushNote(a, i + 1)));

  // Notes directly under the poem div are global notes shown without a number.
  directTextNotes(poemDiv).forEach((a) => pushNote(a, null));

  if (notes.length === 0) {
    return null;
  }

  // Order by verse; global notes (no verse) go last. Stable sort keeps notes on
  // the same verse in document order.
  notes.sort((x, y) => (x.pos ?? Infinity) - (y.pos ?? Infinity));

  return notes
    .map((n) =>
      n.disp == null
        ? n.body // global note, no number
        : `**${n.disp}**${n.body.startsWith(':') ? '' : ' '}${n.body}`
    )
    .join('\\\n'); // hard line break between each comment
};

export const parsePoemFromMei = (meiContent: string): PoemFromMei => {
  const doc = new DOMParser().parseFromString(meiContent, 'text/xml');
  const poemDiv = findPoemDiv(doc);
  if (!poemDiv) {
    return { lyrics: [], comments: null };
  }
  return { lyrics: extractBlocks(poemDiv), comments: extractComments(poemDiv) };
};
