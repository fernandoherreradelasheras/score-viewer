// Read and write the note ↔ facsimile links of an MEI file.
//
// The links live in the MEI itself:
//
//   <music>
//      <facsimile>
//         <surface label="Tiple 1º página 8" lrx="1702" lry="2424">
//            <graphic target="S1/image-008.jpg" width="1702px" height="2424px"/>
//            <zone xml:id="zone-n1r0mwzo" ulx="812" uly="640" lrx="813" lry="641"/>
//         </surface>
//      </facsimile>
//      <body> … <note xml:id="n1r0mwzo" facs="#zone-n1r0mwzo" …/> …
//
// One <surface> per image, with no xml:id since nothing points at it
// (graphic/@target is the image's `file` in the configuration, relative to
// facsimileImagesPath), one point <zone> per written figure, and
// @facs on every <note>, <rest> or <mRest> linked to it. Several events may
// share a zone (a note tied across a barline is one figure in the source).
//
// Events need no xml:id to be linked: one without it is named by its position
// among all the events of the file (`tmp-<ordinal>`, see scanEvents). No id is
// ever added, so that the MEI does not fill up with ids nobody reads.
//
// The file is edited textually, never re-serialised, so a save only changes the
// <facsimile> block and the @facs attributes. Everything here is a pure
// function over strings.

const EVENT_TAGS = ['note', 'rest', 'mRest'];

// Start tags of the linkable events, in document order, skipping comments.
const EVENT_RE = /<!--[\s\S]*?-->|<(note|rest|mRest)\b([^>]*?)(\/?)>/g;

const ID_RE = /\bxml:id\s*=\s*"([^"]*)"/;
const FACS_RE = /\s+facs\s*=\s*"[^"]*"/;

function attrOf(attrs, name) {
  const m = new RegExp(`\\b${name.replace(':', '\\:')}\\s*=\\s*"([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
}

function numAttr(attrs, name) {
  const v = attrOf(attrs, name);
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

const escXml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescXml = (s) => String(s)
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

// Every linkable event: { ordinal, tag, id, facs }. The ordinal is the event's
// position among all <note>/<rest>/<mRest> of the file, which is also the
// document order a DOM gives, so both sides name an event without xml:id
// `tmp-<ordinal>` (see eventKey).
export function scanEvents(text) {
  const out = [];
  let ordinal = 0;
  for (const m of text.matchAll(EVENT_RE)) {
    if (!m[1]) continue;
    out.push({
      ordinal: ordinal++,
      tag: m[1],
      id: attrOf(m[2], 'xml:id'),
      facs: (attrOf(m[2], 'facs') || '').replace(/^#/, '') || null,
    });
  }
  return out;
}

// The key an event is known by in the links: its xml:id, else tmp-<ordinal>.
export const eventKey = (ev) => ev.id || `tmp-${ev.ordinal}`;

export function allIds(text) {
  const ids = new Set();
  for (const m of text.matchAll(/\bxml:id\s*=\s*"([^"]*)"/g)) ids.add(m[1]);
  return ids;
}

// Parse the links of an MEI file.
// Returns { zones: { zoneId: { file, x, y } }, eventZone: { eventKey: zoneId }, dims: { file: { w, h } } }.
// Only zones some event points at are returned; the link is @facs, never a
// naming convention.
export function parseFacsimile(text) {
  const zones = {};
  const dims = {};
  const block = /<facsimile\b[\s\S]*?<\/facsimile>/.exec(text);
  if (block) {
    for (const sm of block[0].matchAll(/<surface\b([^>]*)>([\s\S]*?)<\/surface>/g)) {
      const gm = /<graphic\b([^>]*)>/.exec(sm[2]);
      const file = gm ? unescXml(attrOf(gm[1], 'target') || '') : '';
      if (!file) continue;
      const w = numAttr(sm[1], 'lrx') ?? (gm && numAttr(gm[1], 'width'));
      const h = numAttr(sm[1], 'lry') ?? (gm && numAttr(gm[1], 'height'));
      if (w && h) dims[file] = { w, h };
      for (const zm of sm[2].matchAll(/<zone\b([^>]*?)\/?>/g)) {
        const id = attrOf(zm[1], 'xml:id');
        const ulx = numAttr(zm[1], 'ulx'), uly = numAttr(zm[1], 'uly');
        const lrx = numAttr(zm[1], 'lrx') ?? ulx, lry = numAttr(zm[1], 'lry') ?? uly;
        if (!id || ulx == null || uly == null) continue;
        // A point is stored as a 1 px box; a larger box is read as its centre.
        const x = lrx - ulx <= 1 ? ulx : Math.round((ulx + lrx) / 2);
        const y = lry - uly <= 1 ? uly : Math.round((uly + lry) / 2);
        zones[id] = { file, x, y };
      }
    }
  }
  const eventZone = {};
  const used = {};
  for (const ev of scanEvents(text)) {
    if (ev.facs && zones[ev.facs]) {
      eventZone[eventKey(ev)] = ev.facs;
      used[ev.facs] = zones[ev.facs];
    }
  }
  return { zones: used, eventZone, dims };
}

// Indentation of the <music> line and the file's indentation unit.
function indentation(text) {
  const mm = /^([ \t]*)<music\b/m.exec(text);
  const base = mm ? mm[1] : '   ';
  const bm = /^([ \t]*)<body\b/m.exec(text);
  let unit = '   ';
  if (bm && bm[1].length > base.length && bm[1].startsWith(base)) unit = bm[1].slice(base.length);
  return { base, unit };
}

export class LinkError extends Error {}

// Write the links into an MEI file.
//
//   links:  { zones: { key: { file, x, y } }, eventZone: { eventKey: zoneKey } }
//           eventKey is the event's xml:id or, for an event without one,
//           `tmp-<ordinal>` (see scanEvents). A zone key of the form zone-…
//           (as parseFacsimile returns them) is kept as the zone's xml:id, so
//           zones keep their name from one save to the next; any other key is
//           a new zone and gets the first free zone-<n>.
//   opts:   { images: [{ file, name }]   the score's facsimileItems, for surface order and labels
//             dims: { file: { w, h } }    image size in px
//             eventCount                  number of events the client saw; checked
//                                         whenever a tmp- key is used }
//
// Returns { text, linked, zoneCount, missing: [eventKey…] }.
export function writeFacsimile(text, links, opts = {}) {
  const images = opts.images || [];
  const dims = opts.dims || {};
  const eventZone = links.eventZone || {};
  const zones = links.zones || {};

  const events = scanEvents(text);
  const usesTmp = Object.keys(eventZone).some((k) => k.startsWith('tmp-'));
  if (usesTmp && opts.eventCount != null && opts.eventCount !== events.length) {
    throw new LinkError(`the MEI has ${events.length} events but the editor counted ${opts.eventCount}: reload the score`);
  }

  // Resolve every event to its zone key.
  const resolved = new Map();   // ordinal → { id, zoneKey }
  const seenKeys = new Set();
  for (const ev of events) {
    let key = null;
    if (ev.id && eventZone[ev.id] != null) key = ev.id;
    else if (eventZone[`tmp-${ev.ordinal}`] != null) key = `tmp-${ev.ordinal}`;
    if (!key || !zones[eventZone[key]]) continue;
    seenKeys.add(key);
    resolved.set(ev.ordinal, { id: ev.id, zoneKey: eventZone[key] });
  }
  const missing = Object.keys(eventZone).filter((k) => !seenKeys.has(k));

  // Zone ids: keep the zone-… keys, number the new zones. The ids of the
  // <facsimile> block being replaced are free to be reused.
  const taken = allIds(text.replace(/<facsimile\b[\s\S]*?<\/facsimile>/, ''));
  const zoneOrder = [];         // zone keys in the document order of their first event
  const inOrder = new Set();
  for (const [, r] of [...resolved].sort((a, b) => a[0] - b[0])) {
    if (!inOrder.has(r.zoneKey)) { inOrder.add(r.zoneKey); zoneOrder.push(r.zoneKey); }
  }
  const zoneId = new Map();     // zoneKey → xml:id
  for (const zk of zoneOrder) {
    if (/^zone-[A-Za-z0-9_.-]+$/.test(zk) && !taken.has(zk)) { zoneId.set(zk, zk); taken.add(zk); }
  }
  let counter = 1;
  for (const zk of zoneOrder) {
    if (zoneId.has(zk)) continue;
    let zid;
    do { zid = `zone-${counter++}`; } while (taken.has(zid));
    taken.add(zid);
    zoneId.set(zk, zid);
  }

  // 1. Drop the previous <facsimile> block.
  let out = text.replace(/^[ \t]*<facsimile\b[\s\S]*?<\/facsimile>[ \t]*\r?\n/m, '');
  out = out.replace(/<facsimile\b[\s\S]*?<\/facsimile>/, '');

  // 2. Rewrite the event start tags: an existing @facs keeps its place, a new
  //    one goes right after xml:id, or first when there is no id.
  let ordinal = 0;
  out = out.replace(EVENT_RE, (full, tag, attrs, slash) => {
    if (!tag) return full;
    const r = resolved.get(ordinal++);
    if (!r) return `<${tag}${attrs.replace(FACS_RE, '')}${slash}>`;
    const facs = `facs="#${zoneId.get(r.zoneKey)}"`;
    let a;
    if (FACS_RE.test(attrs)) a = attrs.replace(FACS_RE, (m) => m.replace(/facs[\s\S]*/, facs));
    else a = ID_RE.test(attrs) ? attrs.replace(ID_RE, (m) => `${m} ${facs}`) : ` ${facs}${attrs}`;
    return `<${tag}${a}${slash}>`;
  });

  // 3. Insert the new block right after <music>.
  if (zoneOrder.length) {
    const { base, unit } = indentation(text);
    const i1 = base + unit, i2 = i1 + unit, i3 = i2 + unit;
    const byFile = new Map();
    for (const zk of zoneOrder) {
      const z = zones[zk];
      if (!byFile.has(z.file)) byFile.set(z.file, []);
      byFile.get(z.file).push(zk);
    }
    const rank = (f) => { const i = images.findIndex((im) => im.file === f); return i < 0 ? Infinity : i; };
    const files = [...byFile.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    let xml = `${i1}<facsimile>\n`;
    for (const file of files) {
      const d = dims[file] || {};
      const name = images.find((im) => im.file === file)?.name;
      const label = name ? ` label="${escXml(name)}"` : '';
      const size = d.w && d.h ? ` lrx="${d.w}" lry="${d.h}"` : '';
      const gsize = d.w && d.h ? ` width="${d.w}px" height="${d.h}px"` : '';
      xml += `${i2}<surface${label}${size}>\n`;
      xml += `${i3}<graphic target="${escXml(file)}"${gsize}/>\n`;
      for (const zk of byFile.get(file)) {
        const z = zones[zk];
        const x = Math.round(z.x), y = Math.round(z.y);
        xml += `${i3}<zone xml:id="${zoneId.get(zk)}" ulx="${x}" uly="${y}" lrx="${x + 1}" lry="${y + 1}"/>\n`;
      }
      xml += `${i2}</surface>\n`;
    }
    xml += `${i1}</facsimile>\n`;
    const before = out;
    out = out.replace(/(<music\b[^>]*>[ \t]*\r?\n)/, (m) => m + xml);
    if (out === before) throw new LinkError('no <music> element found');
  }

  return { text: out, linked: resolved.size, zoneCount: zoneOrder.length, missing };
}

export { EVENT_TAGS };
