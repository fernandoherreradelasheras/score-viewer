// Print the part of every facsimile image of every score of SCORES_CONFIGURATION
// (or of the scores given as arguments, by their MEI path or their `path`) and
// flag what the tool cannot use: a `part` that is not a perfRes xml:id of the
// MEI, a part no staffDef points at with @decls, a labelled staffDef without
// @decls, an image whose witness cannot be told when the readings of an <app>
// need it.
//
//   SCORES_CONFIGURATION=config.json npm run facsimile-link:check-parts -- [--all] [score…]
//
// Without --all only the scores with something to report are printed.
// Exit status 1 when something needs attention.

import { readFileSync } from 'node:fs';
import { openConfiguration, meiPathOf, meiInfo, assignImages, partProblems } from './lib/scores.mjs';

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const wanted = args.filter((a) => !a.startsWith('--'));

let config;
try {
  config = openConfiguration();
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

let problems = 0;
let images = 0;
for (const score of config.scores()) {
  if (wanted.length && !wanted.includes(score.id) && !wanted.includes(score.path)) continue;
  let text;
  try {
    text = readFileSync(meiPathOf(config, score), 'utf8');
  } catch {
    console.log(`${score.id}\n  ! MEI not found: ${meiPathOf(config, score)}`);
    problems++;
    continue;
  }
  const info = meiInfo(text);
  const rows = assignImages(score, info);
  const meiProblems = partProblems(score, info);
  images += rows.length;
  const warn = (note) => note && note.startsWith('warn');
  const bad = meiProblems.length + rows.filter((r) => warn(r.note)).length;
  problems += bad;
  if (!showAll && !bad && !rows.some((r) => r.note)) continue;
  console.log(score.id);
  for (const p of meiProblems) console.log(`  ! ${p}`);
  for (const r of rows) {
    if (!showAll && !r.note) continue;
    const what = r.full ? '→ full score' : r.part ? `→ ${r.part}` : '→ –';
    const source = r.source ? ` (${r.source})` : '';
    console.log(`  ${warn(r.note) ? '!' : ' '} ${r.file}  "${r.name}"  ${what}${source}${r.note ? `  ${r.note}` : ''}`);
  }
}
console.log(`\n${images} image(s), ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
