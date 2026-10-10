import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkMei } from '../lib/validate.mjs';
import { REPO_ROOT } from '../lib/scores.mjs';

const FIXTURE = path.join(REPO_ROOT, 'test-fixtures', 'facsimile-link', '02_Querido_imposible_mio.mei');
const dir = mkdtempSync(path.join(tmpdir(), 'facsimile-link-'));
const copy = (name, text) => { const f = path.join(dir, name); writeFileSync(f, text); return f; };
const MEI = readFileSync(FIXTURE, 'utf8');

test('a valid MEI can be saved', async () => {
  assert.deepEqual(await checkMei(copy('valid.mei', MEI), FIXTURE), { ok: true, valid: true, errors: [] });
});

test('an MEI that is not well-formed is refused', async () => {
  const r = await checkMei(copy('broken.mei', MEI.replace('</music>', '')), FIXTURE);
  assert.equal(r.ok, false);
});

test('an invalid MEI is refused, unless the original was invalid too', async () => {
  const invalid = MEI.replace('<body>', '<body><nonsense/>');
  assert.equal((await checkMei(copy('invalid.mei', invalid), FIXTURE)).ok, false);
  const r = await checkMei(copy('invalid2.mei', invalid), copy('original.mei', invalid));
  assert.equal(r.ok, true);
  assert.equal(r.valid, false);
});
