import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanEvents, parseFacsimile, writeFacsimile, allIds, LinkError,
} from '../lib/mei-facsimile.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LINKED = readFileSync(path.join(REPO, 'test-fixtures', 'facsimile-link', '02_Querido_imposible_mio.mei'), 'utf8');
const MEI = writeFacsimile(LINKED, { zones: {}, eventZone: {} }).text;
const IMAGES = [
  { file: 'S1/image-009.jpg', name: 'Tiple 1º página 9' },
  { file: 'G/image-006.jpg', name: 'Guion página 6' },
];
const DIMS = { 'S1/image-009.jpg': { w: 1702, h: 2424 }, 'G/image-006.jpg': { w: 1751, h: 2346 } };

const events = scanEvents(MEI);
const withId = events.filter((e) => e.id);
const noId = events.filter((e) => !e.id);

function sample() {
  return {
    zones: { a: { file: 'S1/image-009.jpg', x: 100, y: 200 }, b: { file: 'G/image-006.jpg', x: 300, y: 400 } },
    eventZone: {
      [withId[0].id]: 'a',
      [withId[1].id]: 'a',                 // same written figure
      [`tmp-${noId[0].ordinal}`]: 'b',
    },
  };
}

test('the links of a linked MEI are read', () => {
  const { zones, eventZone } = parseFacsimile(LINKED);
  assert.ok(Object.keys(eventZone).length > 0);
  for (const zk of Object.values(eventZone)) assert.ok(zones[zk], zk);
});

test('writing no links leaves the file untouched', () => {
  const r = writeFacsimile(MEI, { zones: {}, eventZone: {} }, { images: IMAGES, dims: DIMS });
  assert.equal(r.text, MEI);
});

test('links round-trip through the MEI, without adding ids', () => {
  const r = writeFacsimile(MEI, sample(), { images: IMAGES, dims: DIMS, eventCount: events.length });
  assert.equal(r.linked, 3);
  assert.equal(r.zoneCount, 2);
  assert.deepEqual(r.missing, []);
  assert.deepEqual([...allIds(r.text)].filter((id) => !allIds(MEI).has(id)).sort(),
    ['zone-1', 'zone-2'], 'only the zones get ids');

  const back = parseFacsimile(r.text);
  const za = back.eventZone[withId[0].id];
  assert.equal(back.eventZone[withId[1].id], za, 'shared zone is kept');
  assert.deepEqual(back.zones[za], { file: 'S1/image-009.jpg', x: 100, y: 200 });
  const tmp = `tmp-${noId[0].ordinal}`;
  assert.deepEqual(back.zones[back.eventZone[tmp]], { file: 'G/image-006.jpg', x: 300, y: 400 }, 'an event without id is found by its position');
  assert.deepEqual(back.dims['S1/image-009.jpg'], { w: 1702, h: 2424 });

  assert.ok(r.text.includes('<surface label="Tiple 1º página 9" lrx="1702" lry="2424">'));
  assert.ok(r.text.includes(`<note xml:id="${withId[0].id}" facs="#${za}"`));
  assert.equal(scanEvents(r.text).length, events.length);
});

test('saving again is idempotent, with tmp keys or parsed links', () => {
  const once = writeFacsimile(MEI, sample(), { images: IMAGES, dims: DIMS, eventCount: events.length }).text;
  const twice = writeFacsimile(once, sample(), { images: IMAGES, dims: DIMS, eventCount: events.length }).text;
  assert.equal(twice, once);
  const parsed = parseFacsimile(once);
  const again = writeFacsimile(once, parsed, { images: IMAGES, dims: parsed.dims, eventCount: events.length }).text;
  assert.equal(again, once);
});

test('zones keep their name; new ones get the first free number', () => {
  const once = writeFacsimile(MEI, sample(), { images: IMAGES, dims: DIMS, eventCount: events.length }).text;
  const parsed = parseFacsimile(once);
  // Rename a zone as an older file would have it, and add a new zone before it.
  const renamed = once.replaceAll('zone-1', 'zone-n846746');
  const p2 = parseFacsimile(renamed);
  p2.zones.fresh = { file: 'S1/image-009.jpg', x: 5, y: 6 };
  p2.eventZone[`tmp-${noId[1].ordinal}`] = 'fresh';
  const out = writeFacsimile(renamed, p2, { images: IMAGES, dims: parsed.dims, eventCount: events.length }).text;
  assert.ok(out.includes('xml:id="zone-n846746"'), 'the existing name is kept');
  assert.ok(out.includes('xml:id="zone-2"'));
  assert.ok(out.includes('xml:id="zone-1" ulx="5" uly="6"'), 'the new zone takes the free number');
});

test('removing every link gives back the original file', () => {
  const once = writeFacsimile(MEI, sample(), { images: IMAGES, dims: DIMS, eventCount: events.length });
  const cleared = writeFacsimile(once.text, { zones: {}, eventZone: {} }, { images: IMAGES });
  assert.equal(cleared.text, MEI);
});

test('a stale event count is refused when tmp keys are used', () => {
  assert.throws(
    () => writeFacsimile(MEI, sample(), { images: IMAGES, dims: DIMS, eventCount: events.length + 1 }),
    LinkError,
  );
});

test('links to unknown events are reported, not written', () => {
  const links = sample();
  links.eventZone['no-such-note'] = 'a';
  const r = writeFacsimile(MEI, links, { images: IMAGES, dims: DIMS, eventCount: events.length });
  assert.deepEqual(r.missing, ['no-such-note']);
});

test('an existing @facs keeps its place; only the linked events change', () => {
  const linked = parseFacsimile(LINKED);
  const out = writeFacsimile(LINKED, linked, { images: IMAGES, dims: linked.dims, eventCount: events.length }).text;
  const tags = (t) => [...t.matchAll(/<(note|rest|mRest)\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(tags(out), tags(LINKED));
});

test('commented-out events are not counted', () => {
  const text = MEI.replace('<music>', '<music><!-- <note xml:id="x" pname="c"/> -->');
  assert.equal(scanEvents(text).length, events.length);
});
