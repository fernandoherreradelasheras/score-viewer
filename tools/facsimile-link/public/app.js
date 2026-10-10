// Facsimile link tool — link every note and rest of a score to its position on
// the facsimile images.
import { invertInterval, transposePitch, ACCID_ALTER, alterSign } from '/lib/transpose.mjs';

const MEI_NS = 'http://www.music-encoding.org/ns/mei';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const SVGNS = 'http://www.w3.org/2000/svg';
const EVENT_TAGS = new Set(['note', 'rest', 'mRest']);
// How far the image may be panned past the viewport edge, as a fraction of the
// viewport: an image edge can reach the viewport centre, never leave the view.
const PAN_OVERSCROLL = 0.5;
const SCORE_KEY = 'facsimileLinkScore';      // localStorage: last opened score
const STRIP_MODE_KEY = 'facsimileLinkStripMode';

// How the score strip follows the current event:
//   ahead   the event sits at a quarter of the width, so the music to come is visible
//   center  the event is always in the middle
//   page    the strip only moves when the event leaves the visible part, then
//           jumps so the event is near the left edge (like turning a page)
//   align   the event sits right under its point on the facsimile (or under the
//           last placed point)
const STRIP_MODES = {
  ahead: 'strip: read ahead',
  center: 'strip: centred',
  page: 'strip: page turns',
  align: 'strip: under the facsimile',
};
let stripMode = STRIP_MODES[safeGet(STRIP_MODE_KEY)] ? safeGet(STRIP_MODE_KEY) : 'ahead';

// ---- DOM refs ----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const canvas = $('canvas');
const img = $('page-img');
const markers = $('markers');
const pageLabel = $('page-label');
const statusLine = $('status-line');
const zoomLabel = $('zoom-label');
const dirtyLabel = $('dirty-label');
const scoreSvg = $('score-svg');
const scoreScroll = $('score-scroll');
const autoadvEl = $('autoadv');
const loadingOverlay = $('loading-overlay');

// ---- state -------------------------------------------------------------------
let SCORE = null;
let config = null;          // /api/score/<id>/config: { images:[{file,name,part,full,source,w,h}], parts, encodedTransposition }
// A score may be encoded transposed (encodingProperties.encodedTransposition,
// e.g. "-P4"); pitches are shown, and the strip rendered, as in the source.
let displayTranspose = '';
let meiHash = null;         // hash of the MEI the links were loaded from
let eventCount = 0;         // events seen in the MEI (checked by the server on save)

const ev = {};              // eventId -> { id, ordinal, tag, part, measure, mdiv, linkable, why, editorial, sources, label }
let parts = [];             // [{ key, label, images:[file], nav:[eventId] }] (parts with images only)
const tieNext = {};         // eventId -> eventId of the note its tie continues into

let zones = {};             // zoneKey -> { file, x, y }  (image px)
let eventZone = {};         // eventId -> zoneKey
let zoneSeq = 0;
let neighbours = {};        // file -> [{ x, y, score }]  links of other scores on shared images

let cur = { v: 0, i: 0 };   // current part / index in its nav list
let curFile = null;         // image shown
let dirty = false;

let scale = 1, tx = 0, ty = 0;      // facsimile transform (img px -> screen)
let scoreScale = 1, scoreTx = 0;    // verovio strip transform
let scoreSvgH = 400;
let scoreSvgW = 0;                  // natural px width of the rendered strip
let mdivCount = 1;
const MDIV_GAP = 60;                // px between the mdivs laid out in the strip (see style.css)
let autoAdvance = true;
let verovioReady = false;
const svgEl = {};                   // eventId -> <g> in the strip
let curSvgNote = null;
let onset = {};                     // eventId -> quarter-note position (verovio timemap)
let spaceHeld = false;
let lastAnchor = null;              // { file, x, y } of the last placed/visited point

// Read-only view of the state, for debugging from the browser console.
window.facsimileLink = {
  get zones() { return zones; }, get eventZone() { return eventZone; },
  get current() { return { ...cur, id: curId(), file: curFile }; }, get events() { return ev; },
};

const imageOf = (file) => config.images.find((im) => im.file === file) || null;
const imgUrl = (file) => '/img/' + file.split('/').map(encodeURIComponent).join('/');
const staffLabels = new Map();  // part key that is not a perfRes ('staff <n>', '<perfRes> <k>') -> label
const partLabel = (id) => config.parts.find((p) => p.id === id)?.label || staffLabels.get(id) || id;

// ============================================================================
// Boot
// ============================================================================
(async function boot() {
  try {
    const list = await fetchJson('/api/scores');
    const wanted = new URLSearchParams(location.search).get('score') || safeGet(SCORE_KEY) || list[0]?.id;
    SCORE = list.some((s) => s.id === wanted) ? wanted : list[0]?.id;
    if (!SCORE) throw new Error('the configuration has no scores');
    safeSet(SCORE_KEY, SCORE);
    if (new URLSearchParams(location.search).get('score') !== SCORE) history.replaceState(null, '', `?score=${encodeURIComponent(SCORE)}`);
    fillScoreSelect(list);

    const base = `/api/score/${encodeURIComponent(SCORE)}`;
    const [cfg, meiText, state, nb] = await Promise.all([
      fetchJson(`${base}/config`),
      fetch(`${base}/mei`).then((r) => r.text()),
      fetchJson(`${base}/state`),
      fetchJson(`${base}/neighbours`).catch(() => ({})),
    ]);
    config = cfg;
    displayTranspose = invertInterval(cfg.encodedTransposition);
    neighbours = nb;
    meiHash = state.meiHash;
    document.title = `${cfg.title || SCORE} · facsimile`;

    const meiForVerovio = parseMei(meiText);
    if (eventCount !== state.eventCount) {
      console.warn(`event count differs: browser ${eventCount}, server ${state.eventCount}`);
    }
    loadLinks(state);

    const warn = config.images.filter((im) => im.note && im.note.startsWith('warn'));
    if (warn.length || config.problems.length) {
      toast(`${warn.length + config.problems.length} problem(s) with the parts of this score: run npm run facsimile-link:check-parts -- ${SCORE}`, 5000);
    }

    setupFacsimileInput();
    setupKeys();
    setupButtons();
    setupSplitter();
    setupStripMode();

    if (!parts.length) throw new Error('no part of this score has images assigned');
    const first = parts[0].nav.findIndex((id) => eventZone[id] == null);
    await goto(0, first < 0 ? 0 : first);
    loadingOverlay.classList.add('hidden');

    renderScoreStrip(meiForVerovio);   // in the background; the editor works without it
  } catch (err) {
    loadingOverlay.textContent = 'Error: ' + err.message;
    console.error(err);
  }
})();

async function fetchJson(url, opts) {
  const r = await fetch(url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${url}: ${r.status}`);
  return data;
}
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

function fillScoreSelect(list) {
  const sel = $('score-select');
  sel.innerHTML = list.map((s) =>
    `<option value="${escAttr(s.id)}">${escHtml(s.title || s.id)}` +
    `${s.linked ? ` (${s.linked})` : ''}${s.draft ? ' ✎' : ''}</option>`).join('');
  sel.value = SCORE;
  sel.addEventListener('change', () => {
    if (dirty && !confirm('There are unsaved changes (kept in the draft). Switch score?')) {
      sel.value = SCORE;
      return;
    }
    dirty = false;
    location.search = `?score=${encodeURIComponent(sel.value)}`;
  });
  sel.addEventListener('keydown', (e) => e.stopPropagation());
}

// ============================================================================
// MEI parsing: events, parts, what can be linked
// ============================================================================
function xmlId(el) { return el.getAttributeNS(XML_NS, 'id') || el.getAttribute('xml:id'); }

function closest(el, names) {
  for (let p = el.parentElement; p; p = p.parentElement) if (names.includes(p.localName)) return p;
  return null;
}

// Why an event can or cannot be linked, from the editorial markup around it.
// Returns { linkable, why, editorial, sources }.
function editorialContext(el) {
  let editorial = null;
  let sources = null;
  for (let p = el.parentElement; p && p.localName !== 'layer'; p = p.parentElement) {
    const name = p.localName;
    if (name === 'supplied') return { linkable: false, why: 'added by the editor (supplied)' };
    if ((name === 'corr' || name === 'reg') && p.parentElement?.localName === 'choice') {
      const hasSource = [...p.parentElement.children].some((c) => c.localName === 'sic' || c.localName === 'orig');
      if (hasSource) return { linkable: false, why: `${name} in a choice: the source reading is linked instead` };
    }
    if (['sic', 'orig', 'unclear', 'corr', 'reg'].includes(name)) editorial ||= name;
    if ((name === 'lem' || name === 'rdg') && p.getAttribute('source')) {
      sources ||= p.getAttribute('source').split(/\s+/).map((s) => s.replace(/^#/, ''));
      editorial ||= name;
    }
  }
  return { linkable: true, why: null, editorial, sources };
}

// Parse the MEI into events and parts. Events without xml:id get a temporary
// `tmp-<ordinal>` id, the same name the server gives them (no id is ever
// added to the MEI: the link is @facs on the event).
// Returns the MEI text for Verovio, with those temporary ids in place.
function parseMei(meiText) {
  const doc = new DOMParser().parseFromString(meiText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('the MEI is not well-formed XML');

  // All events in document order: the ordinal matches the server's scanEvents().
  const all = [...doc.getElementsByTagNameNS(MEI_NS, '*')].filter((e) => EVENT_TAGS.has(e.localName));
  eventCount = all.length;
  mdivCount = Math.max(1, doc.getElementsByTagNameNS(MEI_NS, 'mdiv').length);

  // staff @n → part (the perfRes xml:id in staffDef/@decls), per mdiv: the
  // numbering of the staves changes between mdivs. The first staffDef of each
  // @n in the mdiv decides. A perfRes on several staves (a piano) is a part
  // for each staff, `<perfRes> <k>`, so that each staff is gone through on its own.
  const staffPart = new Map();    // mdiv element -> Map(n -> part key)
  const keyPerfRes = new Map();   // part key -> perfRes id
  const partOrder = [];
  for (const mdiv of doc.getElementsByTagNameNS(MEI_NS, 'mdiv')) {
    const decl = new Map();
    for (const sd of mdiv.getElementsByTagNameNS(MEI_NS, 'staffDef')) {
      const n = sd.getAttribute('n');
      const decls = (sd.getAttribute('decls') || '').trim().split(/\s+/)[0]?.replace(/^#/, '');
      if (n && !decls && !staffLabels.has(`staff ${n}`)) {
        const label = sd.getAttribute('label') || [...sd.children].find((c) => c.localName === 'label')?.textContent.trim();
        if (label) staffLabels.set(`staff ${n}`, label);
      }
      if (!n || !decls || decl.has(n)) continue;
      decl.set(n, decls);
    }
    const staves = new Map();     // perfRes id -> [n]
    for (const [n, pr] of decl) staves.set(pr, [...(staves.get(pr) || []), n]);
    const m = new Map();
    for (const [pr, ns] of staves) {
      ns.forEach((n, k) => {
        const key = ns.length > 1 ? `${pr} ${k + 1}` : pr;
        m.set(n, key);
        keyPerfRes.set(key, pr);
        if (ns.length > 1) staffLabels.set(key, `${partLabel(pr)} ${k + 1}`);
      });
    }
    staffPart.set(mdiv, m);
  }

  const byPart = new Map();      // key -> [eventId]
  const measureIndex = new Map([...doc.getElementsByTagNameNS(MEI_NS, 'measure')].map((m, i) => [m, i]));
  all.forEach((el, ordinal) => {
    let id = xmlId(el);
    if (!id) { id = `tmp-${ordinal}`; el.setAttributeNS(XML_NS, 'xml:id', id); }
    const staff = closest(el, ['staff']);
    const mdiv = closest(el, ['mdiv']);
    const measure = closest(el, ['measure']);
    const n = staff?.getAttribute('n');
    const key = (mdiv && staffPart.get(mdiv)?.get(n)) || `staff ${n}`;
    if (!byPart.has(key)) { byPart.set(key, []); partOrder.push(key); }
    byPart.get(key).push(id);
    const ctx = editorialContext(el);
    ev[id] = {
      id, ordinal, tag: el.localName, part: key,
      measure: measure?.getAttribute('n') || '?',
      mkey: measure ? measureIndex.get(measure) : -1,
      mdiv: mdiv ? [...doc.getElementsByTagNameNS(MEI_NS, 'mdiv')].indexOf(mdiv) + 1 : 1,
      label: describe(el),
      ...ctx,
    };
  });

  // Ties: <tie startid endid> and @tie="i|m" on notes.
  for (const t of doc.getElementsByTagNameNS(MEI_NS, 'tie')) {
    const s = (t.getAttribute('startid') || '').replace(/^#/, '');
    const e = (t.getAttribute('endid') || '').replace(/^#/, '');
    if (ev[s] && ev[e]) tieNext[s] = e;
  }
  for (const [, ids] of byPart) {
    ids.forEach((id, i) => {
      const el = all[ev[id].ordinal];
      if (/^[im]$/.test(el.getAttribute('tie') || '') && ids[i + 1] && !tieNext[id]) tieNext[id] = ids[i + 1];
    });
  }

  // Parts that have images are the ones worked on; the others (reconstructed
  // or lost parts) are not in the facsimile. An image of the full score is in
  // the images of every part.
  parts = [];
  for (const key of partOrder) {
    const perfRes = keyPerfRes.get(key) || null;
    const images = config.images.filter((im) => im.full || (perfRes && im.part === perfRes)).map((im) => im.file);
    const ids = byPart.get(key);
    if (!images.length) {
      for (const id of ids) if (ev[id].linkable) Object.assign(ev[id], { linkable: false, why: 'part without images' });
      continue;
    }
    // A reading of an <app> is only in the images of its own witnesses.
    for (const id of ids) {
      const e = ev[id];
      if (e.linkable && e.sources && !images.some((f) => imageMatches(f, e.sources))) {
        Object.assign(e, { linkable: false, why: `reading of ${e.sources.join(' ')}, which has no images in this score` });
      }
    }
    parts.push({ key, perfRes, label: partLabel(key), images, nav: ids.filter((id) => ev[id].linkable) });
  }
  parts = parts.filter((v) => v.nav.length);
  console.log(`parsed ${eventCount} events, ${parts.length} parts with images`);
  return new XMLSerializer().serializeToString(doc);
}

// Pitch as in the source (the encoded transposition undone), with the
// alteration that sounds: written @accid, else @accid.ges, else a child <accid>.
function describe(el) {
  if (el.localName === 'rest') return 'rest';
  if (el.localName === 'mRest') return 'measure rest';
  const child = [...el.children].find((c) => c.localName === 'accid');
  const accid = el.getAttribute('accid') || el.getAttribute('accid.ges')
    || child?.getAttribute('accid') || child?.getAttribute('accid.ges') || '';
  const pname = el.getAttribute('pname');
  const oct = Number(el.getAttribute('oct'));
  if (!pname || !Number.isFinite(oct)) return '?';
  const p = displayTranspose
    ? transposePitch(pname, ACCID_ALTER[accid] ?? 0, oct, displayTranspose)
    : { pname, alter: ACCID_ALTER[accid] ?? 0, oct };
  return `${p.pname.toUpperCase()}${alterSign(p.alter)}${p.oct}`;
}

// Images an event can be placed on: those of its part, narrowed to the
// witnesses of its reading when it sits in an <app>.
function imagesFor(id) {
  const e = ev[id];
  const part = parts.find((p) => p.key === e.part);
  const imgs = part ? part.images : [];
  return e.sources ? imgs.filter((f) => imageMatches(f, e.sources)) : imgs;
}

// An image of unknown witness is accepted for any reading.
function imageMatches(file, sources) {
  const s = imageOf(file)?.source;
  return !s || sources.includes(s);
}

// ============================================================================
// Links (zones shared by several events)
// ============================================================================
function loadLinks(state) {
  zones = {};
  eventZone = {};
  for (const [zk, z] of Object.entries(state.zones || {})) zones[zk] = z;
  for (const [id, zk] of Object.entries(state.eventZone || {})) if (ev[id]) eventZone[id] = zk;

  const d = state.draft;
  if (d) {
    const when = new Date(d.savedAt).toLocaleString();
    const msg = d.stale
      ? `There is an unsaved draft (${when}), but the MEI has changed since then. ` +
        'Restore the links of the events that have an xml:id? (those without one are dropped)'
      : `There is an unsaved draft (${when}). Restore it?`;
    if (confirm(msg)) {
      zones = { ...d.zones };
      eventZone = {};
      // A tmp-<ordinal> key may name an event that got its xml:id in a later
      // save: the ordinal still finds it, as long as the MEI is the same.
      const byOrdinal = new Map(Object.values(ev).map((e) => [e.ordinal, e.id]));
      for (const [key, zk] of Object.entries(d.eventZone || {})) {
        let id = key;
        if (key.startsWith('tmp-')) {
          if (d.stale) continue;
          id = byOrdinal.get(Number(key.slice(4)));
        }
        if (id && ev[id] && zones[zk]) eventZone[id] = zk;
      }
      setDirty(true, false);
    } else {
      fetch(`/api/score/${encodeURIComponent(SCORE)}/draft`, { method: 'DELETE' });
    }
  }
  pruneZones();
  zoneSeq = Object.keys(zones).length;
}

function newZoneKey() {
  let k;
  do { k = `z${++zoneSeq}`; } while (zones[k]);
  return k;
}

function pruneZones() {
  const used = new Set(Object.values(eventZone));
  for (const zk of Object.keys(zones)) if (!used.has(zk)) delete zones[zk];
}

let draftTimer = null;
function setDirty(v = true, schedule = true) {
  dirty = v;
  dirtyLabel.textContent = v ? '● unsaved' : '';
  if (v && schedule) {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 1500);
  }
}

function saveDraft() {
  if (!dirty) return;
  fetch(`/api/score/${encodeURIComponent(SCORE)}/draft`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseHash: meiHash, eventCount, zones, eventZone }),
  }).catch(() => {});
}

window.addEventListener('beforeunload', (e) => {
  if (!dirty) return;
  saveDraft();
  e.preventDefault();
  e.returnValue = '';
});

// ============================================================================
// Navigation
// ============================================================================
function curId() { return parts[cur.v]?.nav[cur.i]; }

async function goto(v, i) {
  v = Math.max(0, Math.min(parts.length - 1, v));
  const nav = parts[v].nav;
  i = Math.max(0, Math.min(nav.length - 1, i));
  cur = { v, i };
  const id = nav[i];

  const z = zones[eventZone[id]];
  if (z) {
    lastAnchor = { file: z.file, x: z.x, y: z.y };
    if (z.file !== curFile) {
      await loadImage(z.file, true);
      centerOnImage(z.x, z.y);
    }
  } else {
    const allowed = imagesFor(id);
    if (!allowed.includes(curFile)) {
      const file = bestImageFor(v, i, allowed);
      await loadImage(file, false);
      const prev = previousLinked(v, i);
      if (prev && prev.file === file) centerOnImage(prev.x, prev.y);
    }
  }
  updateStatus();
  drawMarkers();
  highlightInStrip(id);
}

// The image of the nearest linked event before this one in the part, if it
// is allowed; else the first allowed image.
function previousLinked(v, i) {
  const nav = parts[v].nav;
  for (let k = i - 1; k >= 0; k--) {
    const z = zones[eventZone[nav[k]]];
    if (z) return z;
  }
  return null;
}
function bestImageFor(v, i, allowed) {
  const prev = previousLinked(v, i);
  if (prev && allowed.includes(prev.file)) return prev.file;
  return allowed[0] || config.images[0].file;
}

function nextEvent(d) { goto(cur.v, cur.i + d); }

function nextUnlinked() {
  const nav = parts[cur.v].nav;
  for (let k = cur.i + 1; k < nav.length; k++) if (eventZone[nav[k]] == null) return goto(cur.v, k);
  for (let vi = cur.v + 1; vi < parts.length; vi++) {
    const k = parts[vi].nav.findIndex((id) => eventZone[id] == null);
    if (k >= 0) return goto(vi, k);
  }
  toast('no unlinked events left after this one');
}

// Change part, landing on the event that sounds at the same time.
function changePart(d) {
  const v2 = Math.max(0, Math.min(parts.length - 1, cur.v + d));
  if (v2 === cur.v) return;
  const id = curId();
  const nav2 = parts[v2].nav;
  let best = 0;
  const o = onset[id];
  if (o != null) {
    let bestDiff = Infinity;
    nav2.forEach((id2, k) => {
      const o2 = onset[id2];
      if (o2 == null) return;
      const diff = Math.abs(o2 - o);
      if (diff < bestDiff) { bestDiff = diff; best = k; }
    });
  } else {
    // Without verovio: first event of the same mdiv and measure.
    const k = nav2.findIndex((id2) => ev[id2].mdiv === ev[id].mdiv && ev[id2].measure === ev[id].measure);
    best = k >= 0 ? k : Math.min(cur.i, nav2.length - 1);
  }
  goto(v2, best);
}

function updateStatus() {
  const id = curId();
  const e = ev[id];
  const part = parts[cur.v];
  const zk = eventZone[id];
  const z = zones[zk];
  const prev = part.nav[cur.i - 1];
  let link = '<span class="muted">unlinked</span>';
  if (z) {
    const shared = prev && eventZone[prev] === zk ? ' · same figure as the previous one' : '';
    const onOther = !imagesFor(id).includes(z.file) ? ' ⚠ image of another part' : '';
    link = `<span class="placed">● ${escHtml(imageOf(z.file)?.name || z.file)}${shared}${onOther}</span>`;
  }
  const linkedPart = part.nav.filter((i) => eventZone[i] != null).length;
  const linkable = Object.values(ev).filter((x) => x.linkable);
  const linkedAll = linkable.filter((x) => eventZone[x.id] != null).length;
  const editorial = e.editorial ? ` · <span class="editorial">${e.editorial}${e.sources ? ' ' + e.sources.join(' ') : ''}</span>` : '';
  const tie = tieNext[id] ? ' · tied ⁀' : '';
  statusLine.innerHTML =
    `<b>${escHtml(part.label)}</b> · ${e.label} · m.${escHtml(e.measure)}` +
    `${ev[id].mdiv > 1 ? ` (mdiv ${ev[id].mdiv})` : ''}${editorial}${tie} · ${link} · ` +
    `part <span class="placed">${linkedPart}</span>/${part.nav.length} · ` +
    `total <span class="placed">${linkedAll}</span>/${linkable.length}`;
}

// ============================================================================
// Facsimile viewer: pan / zoom / click to place
// ============================================================================
async function loadImage(file, keepView) {
  curFile = file;
  await new Promise((resolve) => {
    img.onload = () => {
      canvas.style.width = img.naturalWidth + 'px';
      canvas.style.height = img.naturalHeight + 'px';
      resolve();
    };
    img.onerror = resolve;
    img.src = imgUrl(file);
  });
  const im = imageOf(file);
  const all = config.images.findIndex((x) => x.file === file) + 1;
  // Name the image's part only when it is not the one being worked on.
  const owner = im?.full ? '' : !im?.part ? ' · no part' : im.part !== parts[cur.v]?.perfRes ? ` · part ${partLabel(im.part)}` : '';
  pageLabel.textContent = `${im?.name || file}${owner} · ${all}/${config.images.length}`;
  pageLabel.title = file;
  if (!keepView) fitPage();
  drawMarkers();
}

// Step through images: of the current event's part, or all of them.
function stepImage(d, all) {
  const list = all ? config.images.map((im) => im.file) : imagesFor(curId());
  if (!list.length) return;
  let k = list.indexOf(curFile);
  k = k < 0 ? 0 : Math.max(0, Math.min(list.length - 1, k + d));
  if (list[k] !== curFile) loadImage(list[k], false);
}

function fitPage() {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
  scale = Math.min(vw / iw, vh / ih) * 0.98;
  tx = (vw - iw * scale) / 2;
  ty = (vh - ih * scale) / 2;
  applyTransform();
}

function centerOnImage(x, y) {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  if (scale < 0.25) scale = 0.5;             // zoom in a bit if currently fit-out
  tx = vw / 2 - x * scale;
  ty = vh / 2 - y * scale;
  applyTransform();
}

function applyTransform() {
  clampPan();
  canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  zoomLabel.textContent = Math.round(scale * 100) + '%';
  drawMarkers();
}

function clampPan() {
  tx = clampAxis(tx, viewport.clientWidth, (img.naturalWidth || 1) * scale);
  ty = clampAxis(ty, viewport.clientHeight, (img.naturalHeight || 1) * scale);
}
function clampAxis(t, view, len) {
  const m = view * PAN_OVERSCROLL;
  const lo = view - len - m, hi = m;
  if (lo > hi) return (view - len) / 2;
  return Math.max(lo, Math.min(hi, t));
}

function screenToImage(sx, sy) {
  return { x: (sx - tx) / scale, y: (sy - ty) / scale };
}

function circle(cx, cy, r, fill, stroke, width) {
  const c = document.createElementNS(SVGNS, 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
  c.setAttribute('fill', fill);
  if (stroke) { c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', width); }
  markers.appendChild(c);
}

function drawMarkers() {
  while (markers.firstChild) markers.removeChild(markers.firstChild);
  if (!config) return;
  // Other scores' links on this same image, faint.
  for (const p of neighbours[curFile] || []) {
    circle(tx + p.x * scale, ty + p.y * scale, 4, 'rgba(160,160,160,0.35)', 'rgba(120,120,120,0.6)', 1);
  }
  const id = curId();
  const curZone = eventZone[id];
  for (const [zk, z] of Object.entries(zones)) {
    if (z.file !== curFile) continue;
    const sx = tx + z.x * scale, sy = ty + z.y * scale;
    const isCur = zk === curZone;
    circle(sx, sy, isCur ? 11 : 7, isCur ? 'rgba(255,92,138,0.25)' : 'rgba(70,192,255,0.18)',
      isCur ? '#ff5c8a' : '#46c0ff', isCur ? 2.5 : 1.5);
    circle(sx, sy, 1.6, isCur ? '#ff5c8a' : '#46c0ff');
  }
}

function placeCurrent(imgX, imgY) {
  const id = curId();
  if (!id) return;
  if (!imagesFor(id).includes(curFile)) {
    const owner = imageOf(curFile)?.part;
    const what = owner ? `belongs to ${partLabel(owner)}` : 'has no part assigned';
    if (!confirm(`This image ${what}. Place the ${parts[cur.v].label} event here anyway?`)) return;
  }
  const x = Math.round(imgX), y = Math.round(imgY);
  let zk = eventZone[id];
  if (zk && zones[zk]) {
    zones[zk] = { file: curFile, x, y };      // move the figure (every event sharing it moves)
  } else {
    zk = newZoneKey();
    zones[zk] = { file: curFile, x, y };
    eventZone[id] = zk;
  }
  // A tied note continues the same written figure.
  for (let t = tieNext[id], guard = 0; t && guard < 64; t = tieNext[t], guard++) {
    if (!ev[t]?.linkable) break;
    if (eventZone[t] != null && eventZone[t] !== zk) break;
    eventZone[t] = zk;
  }
  pruneZones();
  lastAnchor = { file: curFile, x, y };
  setDirty();
  updateStatus();
  drawMarkers();
  refreshStrip();
  toast(`${ev[id].label} → ${imageOf(curFile)?.name || curFile} (${x}, ${y})`);
  if (autoAdvance) {
    const nav = parts[cur.v].nav;
    let k = cur.i + 1;
    while (k < nav.length && eventZone[nav[k]] === zk) k++;
    if (k < nav.length) goto(cur.v, k);
    else toast('part done: ↓ for the next one');
  }
}

// t: the current event is the same written figure as the previous one (or not).
function toggleShare() {
  const id = curId();
  const prev = parts[cur.v].nav[cur.i - 1];
  if (!prev) return toast('no previous event');
  if (eventZone[id] != null && eventZone[id] === eventZone[prev]) {
    delete eventZone[id];
    toast('own figure: click to place it');
  } else if (eventZone[prev] != null) {
    eventZone[id] = eventZone[prev];
    toast('same figure as the previous event');
    if (autoAdvance && cur.i + 1 < parts[cur.v].nav.length) {
      pruneZones(); setDirty(); refreshStrip();
      return goto(cur.v, cur.i + 1);
    }
  } else {
    return toast('the previous event is not linked');
  }
  pruneZones();
  setDirty();
  updateStatus();
  drawMarkers();
  refreshStrip();
}

// r: unlink the current event (and the tied notes that share its figure).
function removeCurrent() {
  const id = curId();
  const zk = eventZone[id];
  if (zk == null) return toast('the event is not linked');
  delete eventZone[id];
  for (let t = tieNext[id], guard = 0; t && guard < 64 && eventZone[t] === zk; t = tieNext[t], guard++) delete eventZone[t];
  pruneZones();
  setDirty();
  updateStatus();
  drawMarkers();
  refreshStrip();
  toast(`${ev[id].label} unlinked`);
}

function setupFacsimileInput() {
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const before = screenToImage(cx, cy);
    scale = Math.max(0.05, Math.min(12, scale * Math.exp(-e.deltaY * 0.0016)));
    tx = cx - before.x * scale;
    ty = cy - before.y * scale;
    applyTransform();
  }, { passive: false });

  // Left click always places; panning is middle button, or left with Space/Ctrl held.
  let down = null, panning = false;
  viewport.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button === 1 || (e.button === 0 && (spaceHeld || e.ctrlKey))) {
      panning = true;
      down = { x: e.clientX, y: e.clientY, tx, ty };
      viewport.classList.add('panning');
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if (e.button === 0) {
      down = { x: e.clientX, y: e.clientY, tx, ty };
      panning = false;
      viewport.setPointerCapture(e.pointerId);
    }
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!down || !panning) return;
    tx = down.tx + (e.clientX - down.x);
    ty = down.ty + (e.clientY - down.y);
    applyTransform();
  });
  viewport.addEventListener('pointerup', (e) => {
    if (!down) return;
    const wasPanning = panning;
    panning = false;
    viewport.classList.remove('panning');
    down = null;
    if (!wasPanning && e.button === 0) {
      const r = viewport.getBoundingClientRect();
      const { x, y } = screenToImage(e.clientX - r.left, e.clientY - r.top);
      if (x >= 0 && y >= 0 && x <= img.naturalWidth && y <= img.naturalHeight) placeCurrent(x, y);
    }
  });

  window.addEventListener('resize', () => { drawMarkers(); alignStripOnCurrent(); });
}

// ============================================================================
// Verovio position strip
// ============================================================================
async function renderScoreStrip(meiText) {
  let tk;
  try {
    tk = await initVerovio();
  } catch (e) {
    scoreSvg.innerHTML = '<div style="padding:14px;color:#888;font:13px sans-serif">' +
      'verovio unavailable: linking still works, without the reference score.</div>';
    console.warn('verovio init failed', e);
    return;
  }
  const options = {
    breaks: 'none',          // one continuous system
    pageWidth: 100000,
    pageHeight: 8000,
    adjustPageHeight: true,
    scale: 35,
    footer: 'none', header: 'none',
    pageMarginTop: 10, pageMarginBottom: 10, pageMarginLeft: 10, pageMarginRight: 10,
    // As in the source: original clefs (the <rdg> of <app type="app_clefs">;
    // any other <app> falls back to its <lem>) and the encoded transposition undone.
    appXPathQuery: ["./rdg[@type='app_clefs']"],
    ...(displayTranspose ? { transpose: displayTranspose } : {}),
  };
  // Verovio puts every mdiv on a system of its own, one under the other, even
  // with breaks:none. Render them one at a time and lay them out in a row, so
  // the strip stays a single line. Onsets restart at every mdiv: offset them.
  const parts = [];
  let offset = 0;
  for (let i = 1; i <= mdivCount; i++) {
    tk.setOptions({ ...options, mdivAll: false, mdivXPathQuery: mdivCount > 1 ? `./mdiv[${i}]` : '' });
    tk.loadData(meiText);
    parts.push(tk.renderToSVG(1));
    let last = 0;
    try {
      for (const entry of tk.renderToTimemap({ includeRests: true })) {
        for (const id of entry.on || []) if (onset[id] == null) onset[id] = entry.qstamp + offset;
        last = Math.max(last, entry.qstamp);
      }
    } catch (e) { console.warn('timemap failed', e); }
    offset += last + 1000;
  }
  scoreSvg.innerHTML = parts.join('');
  // Verovio's timemap leaves out some events (whole-bar rests): they start with
  // their bar, i.e. at the earliest onset of any event of that bar.
  const barStart = {};
  for (const [id, o] of Object.entries(onset)) {
    const k = ev[id]?.mkey;
    if (k != null && k >= 0 && (barStart[k] == null || o < barStart[k])) barStart[k] = o;
  }
  for (const e of Object.values(ev)) if (onset[e.id] == null && barStart[e.mkey] != null) onset[e.id] = barStart[e.mkey];
  for (const id of Object.keys(ev)) {
    const el = scoreSvg.querySelector(`#${CSS.escape(id)}`);
    if (el) svgEl[id] = el;
  }
  const svgs = [...scoreSvg.children].filter((c) => c.localName === 'svg');
  if (svgs.length) {
    const size = (svg, attr) => parseFloat(svg.getAttribute(attr)) || svg.getBoundingClientRect()[attr] || 0;
    scoreSvgH = Math.max(...svgs.map((svg) => size(svg, 'height'))) || 400;
    scoreSvgW = svgs.reduce((w, svg) => w + size(svg, 'width'), 0) + MDIV_GAP * (svgs.length - 1);
    scoreScale = (scoreScroll.clientHeight || 180) / scoreSvgH;
    scoreSvg.style.transformOrigin = '0 0';
    applyScoreTransform();
  }
  verovioReady = true;
  refreshStrip();
  highlightInStrip(curId());
}

async function initVerovio() {
  if (!await window.__verovioReady) throw new Error('verovio not found: run npm install in the repository');
  return new window.verovio.toolkit();
}

// Linked events in blue, events that cannot be linked in grey.
function refreshStrip() {
  if (!verovioReady) return;
  for (const [id, el] of Object.entries(svgEl)) {
    el.classList.toggle('linked', eventZone[id] != null);
    el.classList.toggle('unlinkable', !ev[id].linkable);
  }
}

function highlightInStrip(id) {
  if (!verovioReady) return;
  if (curSvgNote) curSvgNote.classList.remove('cur');
  const el = id && svgEl[id];
  if (el) { el.classList.add('cur'); curSvgNote = el; alignStripOnCurrent(); }
  else curSvgNote = null;
}

function applyScoreTransform() {
  scoreSvg.style.transform = `translateX(${scoreTx}px) scale(${scoreScale})`;
}

function currentAnchorScreenX() {
  const z = zones[eventZone[curId()]];
  const a = (z && z.file === curFile) ? z : (lastAnchor && lastAnchor.file === curFile) ? lastAnchor : null;
  if (!a) return null;
  return viewport.getBoundingClientRect().left + tx + a.x * scale;
}

// Scroll the strip to show the current event, as the strip mode says.
function alignStripOnCurrent() {
  if (!curSvgNote) return;
  requestAnimationFrame(() => {
    const r = curSvgNote.getBoundingClientRect();
    const s = scoreScroll.getBoundingClientRect();
    const noteX = r.left + r.width / 2;
    let target;
    if (stripMode === 'align') {
      target = currentAnchorScreenX() ?? s.left + s.width / 2;
    } else if (stripMode === 'center') {
      target = s.left + s.width / 2;
    } else if (stripMode === 'page') {
      const inside = noteX > s.left + s.width * 0.08 && noteX < s.left + s.width * 0.92;
      target = inside ? noteX : s.left + s.width * 0.12;
    } else {
      target = s.left + s.width * 0.25;
    }
    scoreTx += target - noteX;
    // Except when lining up with the facsimile, never scroll past the ends of
    // the score (no empty strip before the first bar or after the last one).
    if (stripMode !== 'align' && scoreSvgW) {
      const min = Math.min(0, s.width - scoreSvgW * scoreScale);
      scoreTx = Math.max(min, Math.min(0, scoreTx));
    }
    applyScoreTransform();
  });
}

function setupStripMode() {
  const sel = $('strip-mode');
  sel.innerHTML = Object.entries(STRIP_MODES)
    .map(([k, label]) => `<option value="${k}">${label}</option>`).join('');
  sel.value = stripMode;
  sel.addEventListener('change', () => setStripMode(sel.value));
  sel.addEventListener('keydown', (e) => e.stopPropagation());
}

function setStripMode(mode) {
  stripMode = mode;
  $('strip-mode').value = mode;
  safeSet(STRIP_MODE_KEY, mode);
  alignStripOnCurrent();
}

function cycleStripMode() {
  const modes = Object.keys(STRIP_MODES);
  setStripMode(modes[(modes.indexOf(stripMode) + 1) % modes.length]);
  toast(STRIP_MODES[stripMode]);
}

// ============================================================================
// Keys & buttons
// ============================================================================
function setupKeys() {
  window.addEventListener('keyup', (e) => { if (e.key === ' ') spaceHeld = false; });
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === ' ') { spaceHeld = true; e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
      return;
    }
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); nextEvent(1); break;
      case 'ArrowLeft': e.preventDefault(); nextEvent(-1); break;
      case 'ArrowUp': e.preventDefault(); changePart(-1); break;
      case 'ArrowDown': e.preventDefault(); changePart(1); break;
      case 'z': stepImage(-1, false); break;
      case 'x': stepImage(1, false); break;
      case 'Z': stepImage(-1, true); break;
      case 'X': stepImage(1, true); break;
      case 'n': case 'N': nextUnlinked(); break;
      case 'm': case 'M': cycleStripMode(); break;
      case 't': case 'T': toggleShare(); break;
      case 'r': case 'R': removeCurrent(); break;
      case '0': fitPage(); break;
      case 's': case 'S': e.preventDefault(); save(); break;
      case 'a': case 'A':
        autoAdvance = !autoAdvance;
        autoadvEl.textContent = autoAdvance ? 'on' : 'off';
        break;
    }
  });
}

function setupButtons() {
  $('save-btn').addEventListener('click', save);
  $('fit-btn').addEventListener('click', fitPage);
}

function onStripResize() {
  if (scoreSvg.querySelector('svg')) {
    scoreScale = (scoreScroll.clientHeight || 180) / scoreSvgH;
    applyScoreTransform();
    alignStripOnCurrent();
  }
  drawMarkers();
}

function setupSplitter() {
  const sp = $('splitter');
  const app = $('app');
  const LEGEND_H = 24;
  let dragging = false;
  sp.addEventListener('pointerdown', (e) => {
    dragging = true;
    scoreSvg.classList.add('no-transition');
    sp.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  sp.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const appRect = app.getBoundingClientRect();
    const h = Math.max(80, Math.min(appRect.height - 160, appRect.bottom - LEGEND_H - e.clientY));
    document.documentElement.style.setProperty('--score-h', h + 'px');
    onStripResize();
  });
  sp.addEventListener('pointerup', () => {
    dragging = false;
    scoreSvg.classList.remove('no-transition');
    onStripResize();
  });
}

// ============================================================================
// Save
// ============================================================================
let saving = false;
async function save() {
  if (saving) return;
  saving = true;
  toast('saving…');
  try {
    const res = await fetch(`/api/score/${encodeURIComponent(SCORE)}/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseHash: meiHash, eventCount, zones, eventZone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      saveDraft();
      alert(`Not saved:\n\n${data.error || res.status}`);
      return;
    }
    meiHash = data.meiHash;
    clearTimeout(draftTimer);
    setDirty(false);
    const notes = [];
    if (data.warnings?.length) {
      notes.push('does not validate against MEI 5.1, nor did the original');
      console.warn(data.warnings.join('\n'));
    }
    if (data.missing?.length) notes.push(`${data.missing.length} links without an event`);
    toast(`saved: ${data.linked} events, ${data.zones} figures${notes.length ? ' · ' + notes.join(' · ') : ''}`, 3500);
  } catch (e) {
    saveDraft();
    alert('Save error: ' + e.message);
  } finally {
    saving = false;
  }
}

// ============================================================================
// Helpers
// ============================================================================
const escHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escAttr = (s) => escHtml(s).replace(/"/g, '&quot;');

const TOAST_MARGIN = 12;
let toastTimer = null;
function toast(msg, ms = 1800) {
  const t = $('toast');
  t.textContent = msg;
  // Over the facsimile, never over the score strip, in the half opposite the
  // current (or last placed) point so it never covers it.
  const r = viewport.getBoundingClientRect();
  const z = zones[eventZone[curId()]];
  const p = z && z.file === curFile ? z : lastAnchor?.file === curFile ? lastAnchor : null;
  const low = !!p && ty + p.y * scale > r.height / 2;
  t.classList.toggle('top', low);
  t.style.top = `${low ? r.top + TOAST_MARGIN : r.bottom - t.offsetHeight - TOAST_MARGIN}px`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
