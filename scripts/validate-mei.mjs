// Validates the MEI fixtures against the vendored MEI 5.1 RelaxNG schema.
//
// The fixtures are the development corpus: they are what the dev server serves and
// what this repo's encoding conventions are exercised against, so a mistake here is
// a mistake that would otherwise be found in the real corpus. The schema is vendored
// under schema/ so the build stays offline and reproducible.
//
// Structural validation only: xmllint ignores the Schematron rules embedded in the
// MEI schema, which catch a further class of encoding errors.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FIXTURES = join(ROOT, 'test-fixtures');
const SCHEMA = join(ROOT, 'schema', 'mei-all-5.1.rng');
const MEI_VERSION = '5.1';

const findMei = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return findMei(path);
        return entry.name.endsWith('.mei') ? [path] : [];
    });

const files = findMei(FIXTURES).sort();
if (files.length === 0) {
    console.error('[validate-mei] no .mei files found under test-fixtures/');
    process.exit(1);
}

// A file declaring another version would be validated against the wrong schema and
// pass or fail for the wrong reason, so the header is checked before the schema.
const headerErrors = files.flatMap((file) => {
    const head = readFileSync(file, 'utf8').slice(0, 2048);
    const name = relative(ROOT, file);
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
