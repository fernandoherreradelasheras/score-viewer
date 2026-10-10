// The scores of a score-viewer configuration, their MEI files and their
// facsimile images.
//
// Every image of a score's `facsimileItems` names in `part` the xml:id of the
// <perfRes> whose part it shows, and every <staffDef> points at its perfRes
// with @decls: that is the whole image ↔ staff link. An image without `part`
// shows the full score.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..');

const readConfig = (file) => JSON.parse(readFileSync(file, 'utf8'));

// A relative basePath or facsimileImagesPath is resolved against the folder of
// the configuration, as the iframe page does. One from the site root or a URL
// says nothing about where the files are on disk.
function localDir(configDir, setting) {
  if (typeof setting !== 'string' || setting.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(setting)) return null;
  return path.resolve(configDir, setting);
}

export const scoreId = (score) => path.posix.join(score.path, score.meiFile);

export function openConfiguration(env = process.env) {
  const file = env.SCORES_CONFIGURATION;
  if (!file) throw new Error('SCORES_CONFIGURATION must name the score-viewer configuration file');
  const configFile = path.resolve(file);
  const configDir = path.dirname(configFile);
  const settings = readConfig(configFile).settings || {};
  return {
    file: configFile,
    dir: configDir,
    scoresDir: path.resolve(env.SCORES_DIR || localDir(configDir, settings.basePath) || configDir),
    imagesDir: path.resolve(env.IMAGES_DIR || localDir(configDir, settings.facsimileImagesPath) || configDir),
    stateDir: stateDirOf(env, configFile),
    // Re-read on every call, so edits to the configuration apply without restarting.
    scores: () => (readConfig(configFile).scores || []).map((s) => ({ ...s, id: scoreId(s) })),
  };
}

const stateDirOf = (env, file) =>
  path.resolve(env.STATE_DIR || path.join(TOOL_DIR, '.state', createHash('sha1').update(file).digest('hex').slice(0, 10)));

// The configuration of a single MEI file and its images, all of the full score,
// given on the command line: `score.mei image.jpg…`. The images are named by
// their path from the folder they all are in.
export function fileConfiguration(files, env = process.env) {
  const meis = files.filter((f) => /\.mei$/i.test(f)).map((f) => path.resolve(f));
  const images = files.filter((f) => !/\.mei$/i.test(f)).map((f) => path.resolve(f));
  if (meis.length !== 1 || !images.length) throw new Error('give one MEI file and its facsimile images: score.mei image.jpg…');
  const [mei] = meis;
  let imagesDir = path.dirname(images[0]);
  while (images.some((f) => path.relative(imagesDir, f).startsWith('..'))) imagesDir = path.dirname(imagesDir);
  const facsimileItems = images.map((f) => {
    const file = path.relative(imagesDir, f).split(path.sep).join('/');
    return { name: path.basename(f, path.extname(f)), file };
  });
  const score = { title: path.basename(mei), path: '.', meiFile: path.basename(mei), encodingProperties: {}, facsimileItems };
  return {
    file: mei,
    dir: path.dirname(mei),
    scoresDir: path.dirname(mei),
    imagesDir,
    stateDir: stateDirOf(env, mei),
    scores: () => [{ ...score, id: scoreId(score) }],
  };
}

export function findScore(scores, id) {
  return scores.find((s) => s.id === id) || null;
}

export function meiPathOf(config, score) {
  return path.join(config.scoresDir, score.path, score.meiFile);
}

export function imagePathOf(config, file) {
  return path.join(config.imagesDir, file);
}

// Every image referenced by any score (the whitelist of servable images).
export function allImageFiles(scores) {
  const set = new Set();
  for (const s of scores) for (const f of s.facsimileItems || []) set.add(f.file);
  return set;
}

const attr = (attrs, name) => {
  const m = new RegExp(`\\b${name.replace(':', '\\:')}\\s*=\\s*"([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
};
const text_ = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

// What the image → part link needs from the MEI: the parts (perfRes, in score
// order) and which of them have staves (staffDef/@decls).
//   parts: [{ id, label, type, sources:[siglum], staves:bool }]
//   problems: staffDefs with a label and no @decls, @decls to an unknown part
//   principal: the xml:ids of the <source type="principal">
//   readings: whether some <lem>/<rdg> names its witness in @source
export function meiInfo(text) {
  const parts = [];
  for (const m of text.matchAll(/<perfRes\b([^>]*)>([\s\S]*?)<\/perfRes>/g)) {
    parts.push({
      id: attr(m[1], 'xml:id'),
      label: text_(m[2]),
      type: attr(m[1], 'type'),
      sources: (attr(m[1], 'source') || '').split(/\s+/).filter(Boolean).map((s) => s.replace(/^#/, '')),
      staves: false,
    });
  }
  const problems = [];
  for (const p of parts) if (!p.id) problems.push(`perfRes "${p.label}" has no xml:id`);
  for (const m of text.matchAll(/<staffDef\b([^>]*?)(\/>|>([\s\S]*?)<\/staffDef>)/g)) {
    const decls = attr(m[1], 'decls');
    const n = attr(m[1], 'n');
    if (!decls) {
      // The staffDefs of an original-clefs <app> carry no label and no @decls,
      // and without perfRes there is nothing to point at.
      if (parts.length && m[3] && /<label\b/.test(m[3])) problems.push(`staffDef n=${n} has no @decls`);
      continue;
    }
    for (const ref of decls.split(/\s+/)) {
      const p = parts.find((x) => x.id && x.id === ref.replace(/^#/, ''));
      if (p) p.staves = true;
      else problems.push(`staffDef n=${n}: @decls ${ref} is not a perfRes`);
    }
  }
  const principal = [...text.matchAll(/<source\b([^>]*)>/g)]
    .filter((m) => attr(m[1], 'type') === 'principal' && attr(m[1], 'xml:id'))
    .map((m) => attr(m[1], 'xml:id'));
  return {
    parts, problems: [...new Set(problems)], principal,
    readings: /<(lem|rdg)\b[^>]*\ssource\s*=/.test(text),
  };
}

// The problems of the MEI that matter to the images: none when every image
// shows the full score.
export function partProblems(score, info) {
  return (score.facsimileItems || []).some((item) => item.part != null) ? info.problems : [];
}

// The facsimile images of a score with their part. Returns, per image:
//   { file, name, part, full, source, note }
// `part` is the perfRes xml:id (or null), `full` says the image shows the full
// score, `source` is the siglum of the witness when it can be told (only
// needed for the readings of an <app>: those of another witness are not
// linked), and `note` explains a problem ("warn: …") or a part without staves.
export function assignImages(score, info) {
  return (score.facsimileItems || []).map((item) => {
    const out = { file: item.file, name: item.name, part: null, full: false, source: null, note: null };
    if (item.part == null) {
      return { ...out, full: true, source: info.principal.length === 1 ? info.principal[0] : null };
    }
    if (typeof item.part !== 'string') return { ...out, note: 'warn: "part" is not a string' };
    const p = info.parts.find((x) => x.id === item.part);
    if (!p) return { ...out, note: `warn: part "${item.part}" is not a perfRes xml:id of this score` };
    out.part = p.id;
    out.source = witnessOf(item, p, info.principal);
    if (out.source == null && p.sources.length > 1 && info.readings) {
      out.note = `warn: which witness of ${p.id} the image is cannot be told: mark one as type="principal"`;
    } else if (!p.staves) {
      out.note = p.type === 'lost' ? 'lost part: nothing to link' : 'warn: no staffDef points at this part';
    }
    return out;
  });
}

// Letters and digits only, for matching sigla written in different ways
// ("P-La 47-VI-12" in an image name, "P-La_47-VI-12" as a source xml:id).
const alnum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Which of the part's witnesses the image is: the part's only one, else the
// one whose siglum is in the image name or file, else its principal one.
function witnessOf(item, part, principal) {
  const s = part.sources;
  if (s.length <= 1) return s[0] || null;
  const named = s.filter((x) => alnum(item.name).includes(alnum(x)) || alnum(item.file).includes(alnum(x)));
  if (named.length === 1) return named[0];
  const main = s.filter((x) => principal.includes(x));
  return main.length === 1 ? main[0] : null;
}
