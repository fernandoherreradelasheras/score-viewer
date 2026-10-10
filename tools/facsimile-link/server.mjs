// Facsimile link tool.
//
// Zero-dependency HTTP server: serves the editor (public/), the scores of the
// configuration named in SCORES_CONFIGURATION, their MEI files and facsimile
// images, and writes the note ↔ facsimile links back into each MEI
// (lib/mei-facsimile.mjs).
//
//   SCORES_CONFIGURATION=config.json npm run facsimile-link   → http://localhost:5178
//   npm run facsimile-link -- score.mei image.jpg…              (the images are of the full score)
//
// Every save runs MEI_SAVE_FILTER, when given, and the MEI 5.1 validation
// (lib/validate.mjs) on a temporary copy, and only then replaces the MEI. The
// previous version and the unsaved work (drafts) are kept in .state/, which
// git ignores.

import http from 'node:http';
import { readFile, writeFile, stat, mkdir, unlink, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

import {
  TOOL_DIR, REPO_ROOT, openConfiguration, fileConfiguration, findScore, meiPathOf, imagePathOf, meiInfo, assignImages, partProblems,
  allImageFiles,
} from './lib/scores.mjs';
import { parseFacsimile, writeFacsimile, scanEvents, LinkError } from './lib/mei-facsimile.mjs';
import { imageSize } from './lib/image-size.mjs';
import { checkMei } from './lib/validate.mjs';

const PUBLIC_DIR = path.join(TOOL_DIR, 'public');
const LIB_DIR = path.join(TOOL_DIR, 'lib');
const VEROVIO_DIR = path.join(REPO_ROOT, 'node_modules', 'verovio', 'dist');
const PORT = Number(process.env.PORT) || 5178;
const SAVE_FILTER = process.env.MEI_SAVE_FILTER || '';

const files = process.argv.slice(2);
let config;
try {
  const absent = files.filter((f) => !existsSync(f));
  if (absent.length) throw new Error(`not found: ${absent.join(', ')}`);
  config = files.length ? fileConfiguration(files) : openConfiguration();
} catch (err) {
  console.error(`\n  ${err.message}\n\n  SCORES_CONFIGURATION=path/to/config.json npm run facsimile-link`);
  console.error('  npm run facsimile-link -- score.mei image.jpg…\n');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mei': 'application/xml; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
};

const scores = () => config.scores();
const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const statePath = (id, suffix) => path.join(config.stateDir, `${encodeURIComponent(id)}.${suffix}`);
const meiPath = (score) => meiPathOf(config, score);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'] });

async function sendFile(res, file) {
  try {
    const data = await readFile(file);
    send(res, 200, data, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  } catch {
    send(res, 404, 'Not found');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function runFilter(file) {
  return new Promise((resolve) => {
    execFile('sh', ['-c', `${SAVE_FILTER} "$1"`, 'sh', file], { cwd: config.dir, maxBuffer: 16 << 20 }, (err, stdout, stderr) => {
      resolve({ failed: !!err, output: (stderr || stdout || err?.message || '').trim() });
    });
  });
}

const sizeCache = new Map();
async function dimsOf(file) {
  if (!sizeCache.has(file)) sizeCache.set(file, await imageSize(imagePathOf(config, file)).catch(() => null));
  return sizeCache.get(file);
}

async function scoreConfig(score) {
  const text = await readFile(meiPath(score), 'utf8');
  const info = meiInfo(text);
  const images = assignImages(score, info);
  for (const im of images) Object.assign(im, await dimsOf(im.file) || {});
  return {
    id: score.id, title: score.title, meiFile: score.meiFile,
    encodedTransposition: score.encodingProperties?.encodedTransposition || '',
    parts: info.parts, problems: partProblems(score, info), images,
  };
}

async function readDraft(id) {
  try { return JSON.parse(await readFile(statePath(id, 'draft.json'), 'utf8')); } catch { return null; }
}

// Links of the other scores drawn on the images this one shares with them (a
// page may hold the end of a score and the start of the next), to see where
// each one ends.
async function neighbourPoints(score) {
  const files = new Set((score.facsimileItems || []).map((f) => f.file));
  const out = {};
  for (const other of scores()) {
    if (other.id === score.id) continue;
    if (!(other.facsimileItems || []).some((f) => files.has(f.file))) continue;
    let text;
    try { text = await readFile(meiPath(other), 'utf8'); } catch { continue; }
    const { zones } = parseFacsimile(text);
    for (const z of Object.values(zones)) {
      if (!files.has(z.file)) continue;
      (out[z.file] ||= []).push({ x: z.x, y: z.y, score: other.id });
    }
  }
  return out;
}

async function save(score, body) {
  const file = meiPath(score);
  const text = await readFile(file, 'utf8');
  if (body.baseHash && body.baseHash !== sha1(text)) {
    return [409, { error: 'The MEI changed on disk since it was loaded. Reload the score (your work is kept as a draft).' }];
  }
  const cfg = await scoreConfig(score);
  const dims = Object.fromEntries(cfg.images.filter((im) => im.w).map((im) => [im.file, { w: im.w, h: im.h }]));
  let result;
  try {
    result = writeFacsimile(text, body, { images: score.facsimileItems, dims, eventCount: body.eventCount });
  } catch (e) {
    if (e instanceof LinkError) return [400, { error: e.message }];
    throw e;
  }

  await mkdir(config.stateDir, { recursive: true });
  const tmp = statePath(score.id, 'tmp.mei');
  await writeFile(tmp, result.text, 'utf8');
  try {
    if (SAVE_FILTER) {
      const filter = await runFilter(tmp);
      if (filter.failed) return [500, { error: `MEI_SAVE_FILTER failed: ${filter.output}` }];
    }
    const check = await checkMei(tmp, file);
    if (!check.ok) {
      return [500, { error: `The new MEI does not validate against MEI 5.1; nothing was written.\n${check.errors.join('\n')}` }];
    }
    await copyFile(file, statePath(score.id, 'prev.mei'));
    const final = await readFile(tmp, 'utf8');
    await writeFile(file, final, 'utf8');
    await rm(statePath(score.id, 'draft.json'), { force: true });
    return [200, {
      ok: true, linked: result.linked, zones: result.zoneCount,
      missing: result.missing, meiHash: sha1(final), warnings: check.errors,
    }];
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname === '/api/scores' && req.method === 'GET') {
      const list = [];
      for (const s of scores()) {
        let linked = 0;
        try {
          linked = scanEvents(await readFile(meiPath(s), 'utf8')).filter((e) => e.facs).length;
        } catch { /* missing MEI */ }
        list.push({
          id: s.id, title: s.title, images: (s.facsimileItems || []).length,
          linked, draft: existsSync(statePath(s.id, 'draft.json')),
        });
      }
      return sendJson(res, 200, list);
    }

    // The id of a score is its MEI path, slashes included, so it is matched encoded.
    const sm = /^\/api\/score\/([^/]+)\/(config|mei|state|save|draft|neighbours)$/.exec(url.pathname);
    if (sm) {
      const id = decodeURIComponent(sm[1]);
      const score = findScore(scores(), id);
      if (!score) return sendJson(res, 404, { error: `unknown score: ${id}` });
      const what = sm[2];

      if (what === 'config' && req.method === 'GET') return sendJson(res, 200, await scoreConfig(score));

      if (what === 'mei' && req.method === 'GET') return sendFile(res, meiPath(score));

      if (what === 'state' && req.method === 'GET') {
        const text = await readFile(meiPath(score), 'utf8');
        const meiHash = sha1(text);
        const draft = await readDraft(score.id);
        return sendJson(res, 200, {
          ...parseFacsimile(text), meiHash, eventCount: scanEvents(text).length,
          draft: draft ? { ...draft, stale: draft.baseHash !== meiHash } : null,
        });
      }

      if (what === 'draft' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req) || '{}');
        await mkdir(config.stateDir, { recursive: true });
        await writeFile(statePath(score.id, 'draft.json'),
          JSON.stringify({ ...body, savedAt: new Date().toISOString() }), 'utf8');
        return sendJson(res, 200, { ok: true });
      }
      if (what === 'draft' && req.method === 'DELETE') {
        await rm(statePath(score.id, 'draft.json'), { force: true });
        return sendJson(res, 200, { ok: true });
      }

      if (what === 'save' && req.method === 'POST') {
        const [status, body] = await save(score, JSON.parse(await readBody(req) || '{}'));
        return sendJson(res, status, body);
      }

      if (what === 'neighbours' && req.method === 'GET') return sendJson(res, 200, await neighbourPoints(score));
    }

    // Only the images some score references are served.
    const im = /^\/img\/(.+)$/.exec(pathname);
    if (im && req.method === 'GET') {
      const file = im[1];
      if (file.split('/').includes('..') || !allImageFiles(scores()).has(file)) return send(res, 404, 'Not found');
      return sendFile(res, imagePathOf(config, file));
    }

    if (pathname.startsWith('/vendor/verovio/')) {
      return sendFile(res, path.join(VEROVIO_DIR, path.basename(pathname)));
    }

    // Modules shared with the server.
    if (pathname.startsWith('/lib/')) {
      const file = path.normalize(path.join(LIB_DIR, pathname.slice(5)));
      if (!file.startsWith(LIB_DIR + path.sep)) return send(res, 403, 'Forbidden');
      return sendFile(res, file);
    }

    const rel = pathname === '/' ? '/index.html' : pathname;
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
    if (existsSync(file) && (await stat(file)).isFile()) return sendFile(res, file);

    send(res, 404, 'Not found');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  const list = scores();
  const imageFiles = [...allImageFiles(list)];
  const meis = list.filter((s) => !existsSync(meiPath(s))).length;
  const images = imageFiles.filter((f) => !existsSync(imagePathOf(config, f))).length;
  const missing = (n) => (n ? `, ${n} missing` : '');
  console.log(`\n  Facsimile link tool → http://localhost:${PORT}\n`);
  if (files.length) {
    console.log(`  score:  ${config.file}${missing(meis)}`);
    console.log(`  images: ${config.imagesDir}${missing(images)}`);
  } else {
    console.log(`  configuration: ${config.file} (${list.length} scores)`);
    console.log(`  scores:        ${config.scoresDir}${missing(meis)}`);
    console.log(`  images:        ${config.imagesDir}${missing(images)}`);
    if ((meis && meis === list.length) || (images && images === imageFiles.length)) {
      console.log('\n  Set SCORES_DIR and IMAGES_DIR to the folders of the MEI files and of the images.');
    }
  }
  if (!existsSync(path.join(VEROVIO_DIR, 'verovio-toolkit-wasm.js'))) {
    console.log('\n  verovio not found in node_modules (npm install): the score strip will be missing.');
  }
  console.log('');
});
