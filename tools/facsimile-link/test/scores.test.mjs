import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openConfiguration, fileConfiguration, findScore, meiPathOf, meiInfo, assignImages, partProblems, REPO_ROOT } from '../lib/scores.mjs';

const info = (parts, staffDefs) => meiInfo(
  `<perfResList>${parts}</perfResList><scoreDef><staffGrp>${staffDefs}</staffGrp></scoreDef>`);

function configIn(settings, scores = []) {
  const dir = mkdtempSync(path.join(tmpdir(), 'facsimile-link-'));
  const file = path.join(dir, 'config.json');
  writeFileSync(file, JSON.stringify({ settings, scores }));
  return { dir, file };
}

test('relative paths of the configuration are resolved against its folder', () => {
  const { dir, file } = configIn({ basePath: './scores/', facsimileImagesPath: '../images/' });
  const c = openConfiguration({ SCORES_CONFIGURATION: file });
  assert.equal(c.scoresDir, path.join(dir, 'scores'));
  assert.equal(c.imagesDir, path.resolve(dir, '..', 'images'));
});

test('paths from the site root or URLs fall back to the folder of the configuration, or to the environment', () => {
  const { dir, file } = configIn({ basePath: 'https://example.com/scores/', facsimileImagesPath: '/facsimile/' });
  const c = openConfiguration({ SCORES_CONFIGURATION: file });
  assert.equal(c.scoresDir, dir);
  assert.equal(c.imagesDir, dir);
  const e = openConfiguration({ SCORES_CONFIGURATION: file, SCORES_DIR: '/s', IMAGES_DIR: '/i' });
  assert.equal(e.scoresDir, '/s');
  assert.equal(e.imagesDir, '/i');
});

test('a configuration is required', () => {
  assert.throws(() => openConfiguration({}), /SCORES_CONFIGURATION/);
});

test('scores are known by their MEI path, since several may share a folder', () => {
  const { dir, file } = configIn({ basePath: './' }, [
    { title: 'a', path: 'f', meiFile: 'a.mei' },
    { title: 'b', path: 'f', meiFile: 'b.mei' },
  ]);
  const c = openConfiguration({ SCORES_CONFIGURATION: file });
  const b = findScore(c.scores(), 'f/b.mei');
  assert.equal(b.title, 'b');
  assert.equal(meiPathOf(c, b), path.join(dir, 'f', 'b.mei'));
});

test('a MEI file and its images make a configuration of their own, of the full score', () => {
  const c = fileConfiguration(['/m/song.mei', '/i/a/p1.jpg', '/i/b/p2.png'], {});
  const [score] = c.scores();
  assert.equal(meiPathOf(c, score), '/m/song.mei');
  assert.equal(c.imagesDir, '/i');
  assert.deepEqual(score.facsimileItems, [{ name: 'p1', file: 'a/p1.jpg' }, { name: 'p2', file: 'b/p2.png' }]);
  assert.equal(assignImages(score, meiInfo(''))[0].full, true);
  assert.equal(fileConfiguration(['/x/a.mei', '/p.jpg'], {}).imagesDir, '/');
  assert.throws(() => fileConfiguration(['/m/song.mei'], {}), /MEI file and its facsimile images/);
  assert.throws(() => fileConfiguration(['/a.mei', '/b.mei', '/p.jpg'], {}), /MEI file and its facsimile images/);
});

test('staves are linked to parts by @decls only, not by label', () => {
  const i = info('<perfRes xml:id="perfRes-tenor">Tenor</perfRes><perfRes xml:id="perfRes-alto">Alto</perfRes>',
    '<staffDef n="1" decls="#perfRes-tenor"><label>Bajo</label></staffDef><staffDef n="2"><label>Alto</label></staffDef>');
  assert.equal(i.parts.find((p) => p.id === 'perfRes-tenor').staves, true);
  assert.equal(i.parts.find((p) => p.id === 'perfRes-alto').staves, false);
  assert.deepEqual(i.problems, ['staffDef n=2 has no @decls']);
});

test('the staffDefs of the original clefs need no @decls; a wrong @decls is reported', () => {
  const i = info('<perfRes xml:id="perfRes-tiple1">Tiple 1º</perfRes>',
    '<staffDef n="1" decls="#perfRes-tiple1"><label>Tiple 1º</label></staffDef>'
    + '<staffDef n="1"><clef shape="C" line="1"/></staffDef><staffDef n="2" decls="#nope"><label>X</label></staffDef>');
  assert.deepEqual(i.problems, ['staffDef n=2: @decls #nope is not a perfRes']);
});

test('without perfRes, labelled staves need no @decls', () => {
  assert.deepEqual(info('', '<staffDef n="1"><label>Soprano</label></staffDef>').problems, []);
});

test('an image without part is of the full score; one with a wrong part is flagged', () => {
  const i = info('<perfRes xml:id="perfRes-tiple1">Tiple 1º</perfRes><perfRes xml:id="perfRes-alto" type="lost">Alto</perfRes>',
    '<staffDef n="1" decls="#perfRes-tiple1"><label>Tiple 1º</label></staffDef>');
  const rows = assignImages({ facsimileItems: [
    { name: 'a', file: 'S1/a.jpg' },
    { name: 'b', file: 'S1/b.jpg', part: 3 },
    { name: 'c', file: 'S1/c.jpg', part: 'perfRes-tenor' },
    { name: 'd', file: 'S1/d.jpg', part: 'perfRes-alto' },
    { name: 'e', file: 'S1/e.jpg', part: 'perfRes-tiple1' },
  ] }, i);
  assert.equal(rows[0].full, true);
  assert.deepEqual(rows.map((r) => (r.note || 'ok').split(':')[0]), ['ok', 'warn', 'warn', 'lost part', 'ok']);
});

const SOURCES = '<source xml:id="P-Ln_MM4802-1" type="principal"/><source xml:id="P-La_47-VI-11" type="complementary"/>'
  + '<source type="principal" xml:id="P-Ln_MM4803"/>';

test('witness of an image: the only one of its part, else the siglum in its name, else the principal one', () => {
  const i = meiInfo(SOURCES
    + '<perfRes xml:id="t1" source="#P-Ln_MM4802-1 #P-La_47-VI-11">Tiple 1º</perfRes>'
    + '<perfRes xml:id="g" source="#P-Ln_MM4803">Guion</perfRes>'
    + '<staffDef n="1" decls="#t1"/><staffDef n="2" decls="#g"/>');
  assert.deepEqual(i.principal, ['P-Ln_MM4802-1', 'P-Ln_MM4803']);
  const rows = assignImages({ facsimileItems: [
    { name: 'Tiple 1º página 36', file: 'S1/image-036.jpg', part: 't1' },
    { name: 'Tiple 1º P-La 47-VI-11 30v', file: 'others/30v.jpg', part: 't1' },
    { name: 'Guion página 20', file: 'G/image-020.jpg', part: 'g' },
    { name: 'Partitura', file: 'score.jpg' },
  ] }, i);
  assert.deepEqual(rows.map((r) => r.source), ['P-Ln_MM4802-1', 'P-La_47-VI-11', 'P-Ln_MM4803', null]);
});

test('an image of the full score is of the principal source, when there is only one', () => {
  const i = meiInfo('<source xml:id="A" type="principal"/><source xml:id="B" type="complementary"/>');
  assert.equal(assignImages({ facsimileItems: [{ name: 'Partitura', file: 'score.jpg' }] }, i)[0].source, 'A');
});

test('an image of unknown witness is flagged when the readings of an <app> need it', () => {
  const i = meiInfo('<perfRes xml:id="t1" source="#P-X_1 #P-Y_2">Tiple 1º</perfRes><staffDef n="1" decls="#t1"/>'
    + '<app><lem source="#P-X_1"><note/></lem><rdg source="#P-Y_2"><note/></rdg></app>');
  const [row] = assignImages({ facsimileItems: [{ name: 'Tiple 1º', file: 'S1/image-037.jpg', part: 't1' }] }, i);
  assert.ok(row.note.startsWith('warn: which witness'));
});

test('the parts of the MEI do not matter when every image is of the full score', () => {
  const i = info('<perfRes>Tiple</perfRes>', '<staffDef n="1"><label>Tiple</label></staffDef>');
  assert.equal(i.problems.length, 2);
  assert.deepEqual(partProblems({ facsimileItems: [{ name: 'a', file: 'a.jpg' }] }, i), []);
  assert.equal(partProblems({ facsimileItems: [{ name: 'a', file: 'a.jpg', part: 'x' }] }, i).length, 2);
});

test('the facsimile-link fixtures of the development configuration have their parts', () => {
  const c = openConfiguration({
    SCORES_CONFIGURATION: path.join(REPO_ROOT, 'assets', 'test.json'),
    SCORES_DIR: path.join(REPO_ROOT, 'test-fixtures'),
  });
  const scores = c.scores().filter((s) => s.path === 'facsimile-link');
  assert.ok(scores.length);
  for (const score of scores) {
    const i = meiInfo(readFileSync(meiPathOf(c, score), 'utf8'));
    for (const r of assignImages(score, i)) assert.ok(!(r.note || '').startsWith('warn'), `${score.id} ${r.file}: ${r.note}`);
  }
});
