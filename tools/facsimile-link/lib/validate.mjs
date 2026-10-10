// The check every save goes through before the MEI is replaced: the new file
// is well-formed and valid against the MEI 5.1 schema of the repository, with
// xmllint, as `npm run validate:mei` does.

import { execFile } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from './scores.mjs';

const SCHEMA = process.env.MEI_RNG || path.join(REPO_ROOT, 'schema', 'mei-all-5.1.rng');
const MAX_ERRORS = 10;

function xmllint(args) {
  return new Promise((resolve) => {
    execFile('xmllint', ['--noout', ...args], { maxBuffer: 16 << 20 }, (err, _stdout, stderr) => {
      resolve({ missing: err?.code === 'ENOENT', failed: !!err, stderr: String(stderr || '') });
    });
  });
}

// xmllint also reports on stderr the files that validate.
const errorsOf = (stderr) => stderr.split('\n')
  .filter((l) => l && !/ (validates|fails to validate)$/.test(l))
  .slice(0, MAX_ERRORS);

// { ok, valid, errors }. A new MEI that does not validate is only refused when
// the original did: the tool must not break a valid file, nor get stuck on
// errors that were already there.
export async function checkMei(file, baseline) {
  const wellFormed = await xmllint([file]);
  if (wellFormed.missing) {
    return { ok: false, valid: false, errors: ['xmllint not found: install libxml2 (dnf install libxml2, apt install libxml2-utils, brew install libxml2)'] };
  }
  if (wellFormed.failed) return { ok: false, valid: false, errors: errorsOf(wellFormed.stderr) };
  const check = await xmllint(['--relaxng', SCHEMA, file]);
  if (!check.failed) return { ok: true, valid: true, errors: [] };
  const errors = errorsOf(check.stderr);
  if (baseline && (await xmllint(['--relaxng', SCHEMA, baseline])).failed) {
    return { ok: true, valid: false, errors: ['the original MEI did not validate either', ...errors] };
  }
  return { ok: false, valid: false, errors };
}
