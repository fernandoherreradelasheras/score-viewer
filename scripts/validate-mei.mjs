// Validates MEI files against the vendored MEI 5.1 RelaxNG schema.
//
//   node scripts/validate-mei.mjs [--schematron] [path...]
//
// With no path it takes the fixtures, which are the development corpus: what the dev
// server serves and what this repo's encoding conventions are exercised against, so a
// mistake there is a mistake that would otherwise be found in the real corpus. Paths
// may be files or directories, and are the way to check a score outside this repo.
//
// The schema is vendored under schema/ so validation stays offline and reproducible.
// xmllint covers the grammar only; --schematron adds the rules embedded in the MEI
// schema, which catch a further class of encoding errors.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FIXTURES = join(ROOT, 'test-fixtures');
const SCHEMA = join(ROOT, 'schema', 'mei-all-5.1.rng');
const MEI_VERSION = '5.1';

const args = process.argv.slice(2);
const withSchematron = args.includes('--schematron');
const paths = args.filter((arg) => !arg.startsWith('--'));

const findMei = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return findMei(path);
        return entry.name.endsWith('.mei') ? [path] : [];
    });

// A path is taken as given: a directory is searched for .mei files, a file is
// validated whatever its extension, since the caller named it explicitly.
const expand = (path) => {
    const full = resolve(path);
    try {
        return statSync(full).isDirectory() ? findMei(full) : [full];
    } catch {
        console.error(`[validate-mei] ${path}: no such file or directory`);
        process.exit(1);
    }
};

// Paths are echoed the way the caller would recognise them, which for a score outside
// the repo is not its position relative to the repo root.
const display = (file) => {
    const fromCwd = relative(process.cwd(), file);
    return fromCwd.startsWith('..') ? file : fromCwd;
};

const files = (paths.length > 0 ? paths.flatMap(expand) : findMei(FIXTURES)).sort();
if (files.length === 0) {
    console.error(`[validate-mei] no .mei files found in ${paths.length > 0 ? paths.join(', ') : 'test-fixtures/'}`);
    process.exit(1);
}

// A file declaring another version would be validated against the wrong schema and
// pass or fail for the wrong reason, so the header is checked before the schema.
const headerErrors = files.flatMap((file) => {
    const head = readFileSync(file, 'utf8').slice(0, 2048);
    const name = display(file);
    const version = head.match(/<mei\b[^>]*\bmeiversion="([^"]*)"/)?.[1];
    const errors = [];
    if (version !== MEI_VERSION) {
        errors.push(`${name}: meiversion is ${version ? `"${version}"` : 'missing'}, expected "${MEI_VERSION}"`);
    }
    if (!head.includes(`music-encoding.org/schema/${MEI_VERSION}/mei-all.rng`)) {
        errors.push(`${name}: missing the <?xml-model?> pointing at the MEI ${MEI_VERSION} schema`);
    }
    return errors;
});

if (headerErrors.length > 0) {
    headerErrors.forEach((e) => console.error(`[validate-mei] ${e}`));
    process.exit(1);
}

try {
    // One invocation for every file: the 1.4MB schema is then parsed once.
    execFileSync('xmllint', ['--noout', '--relaxng', SCHEMA, ...files], { stdio: ['ignore', 'ignore', 'pipe'] });
} catch (error) {
    if (error.code === 'ENOENT') {
        console.error('[validate-mei] xmllint not found. Install libxml2 (Fedora/RHEL: dnf install libxml2, Debian/Ubuntu: apt install libxml2-utils, macOS: brew install libxml2).');
        process.exit(1);
    }
    // xmllint reports every valid file on stderr too; only the errors are worth showing
    String(error.stderr ?? '')
        .split('\n')
        .filter((line) => line.length > 0 && !line.endsWith(' validates'))
        .forEach((line) => console.error(`[validate-mei] ${line}`));
    process.exit(1);
}

console.log(`[validate-mei] ${files.length} MEI ${MEI_VERSION} files validate`);

// The Schematron pass is opt-in: it costs ~25s against ~1s for the grammar, because
// the reference rules (@startid, @endid, @plist...) scan the document once per
// reference. Worth it before a release, too slow for every build.
if (withSchematron) {
    const { loadPatterns, validate } = await import('./schematron.mjs');
    const patterns = loadPatterns(SCHEMA);

    let failed = 0;
    for (const file of files) {
        for (const { where, message } of validate(patterns, file)) {
            failed++;
            console.error(`[validate-mei] ${display(file)}: ${where}\n               ${message}`);
        }
    }
    if (failed > 0) {
        console.error(`[validate-mei] ${failed} Schematron violation(s)`);
        process.exit(1);
    }
    console.log(`[validate-mei] ${files.length} files pass the Schematron rules`);
}
