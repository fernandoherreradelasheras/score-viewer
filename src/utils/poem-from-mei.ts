import { LyricItem } from '../types';

const MEI_NS = 'http://www.music-encoding.org/ns/mei';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

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

const xmlId = (el: Element): string | null =>
  el.getAttribute('xml:id') ?? el.getAttributeNS(XML_NS, 'id');

const normalizeText = (el: Element): string =>
  (el.textContent ?? '').replace(/\s+/g, ' ').trim();

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
        ? nestedStrophes.map((s) => childrenByLocalName(s, 'l').map(normalizeText))
        : [childrenByLocalName(block, 'l').map(normalizeText)];
    return { title: blockHeader(block), strophes };
  });
};

// Notes are `<annot type="text-note">` direct children of the poem div. Each
// references the annotated `<l>` by id via `@corresp`; the verse number shown is
// the 1-based position of that `<l>` among ALL `<l>` in the poem (or `@n` when
// present). A note without `@corresp` is a global note shown without a number.
const extractComments = (poemDiv: Element): string | null => {
  const allL = Array.from(poemDiv.getElementsByTagNameNS(MEI_NS, 'l'));
  const posOf = new Map<string, number>();
  allL.forEach((l, i) => {
    const id = xmlId(l);
    if (id) {
      posOf.set(id, i + 1);
    }
  });

  const comments = childrenByLocalName(poemDiv, 'annot')
    .filter((a) => a.getAttribute('type') === 'text-note')
    .map((a) => {
      const id = (a.getAttribute('corresp') ?? '').replace(/^#/, '');
      const pos = id && posOf.has(id) ? (posOf.get(id) as number) : null;
      const nAttr = a.getAttribute('n');
      const disp = nAttr != null ? nAttr : pos != null ? String(pos) : null;
      return { pos, disp, body: normalizeText(a) };
    })
    // Stable sort keeps notes on the same verse in document order.
    .sort((x, y) => (x.pos ?? Infinity) - (y.pos ?? Infinity));

  if (comments.length === 0) {
    return null;
  }

  return comments
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
