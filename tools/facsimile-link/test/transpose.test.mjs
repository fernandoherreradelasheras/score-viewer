import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInterval, invertInterval, transposePitch } from '../lib/transpose.mjs';

test('intervals are parsed', () => {
  assert.deepEqual(parseInterval('-P4'), { dir: -1, steps: 3, semitones: 5 });
  assert.deepEqual(parseInterval('P4'), { dir: 1, steps: 3, semitones: 5 });
  assert.deepEqual(parseInterval('+m3'), { dir: 1, steps: 2, semitones: 3 });
  assert.deepEqual(parseInterval('A4'), { dir: 1, steps: 3, semitones: 6 });
  assert.deepEqual(parseInterval('P8'), { dir: 1, steps: 7, semitones: 12 });
  assert.equal(parseInterval(''), null);
  assert.equal(parseInterval('P3'), null);
});

test('the encoded transposition is undone', () => {
  assert.equal(invertInterval('-P4'), 'P4');
  assert.equal(invertInterval('P4'), '-P4');
  assert.equal(invertInterval('+P4'), '-P4');
  assert.equal(invertInterval(''), '');
});

test('pitches are transposed with the right spelling', () => {
  assert.deepEqual(transposePitch('a', 0, 4, 'P4'), { pname: 'd', alter: 0, oct: 5 });
  assert.deepEqual(transposePitch('f', 1, 3, 'P4'), { pname: 'b', alter: 0, oct: 3 });   // F♯ → B
  assert.deepEqual(transposePitch('f', 0, 4, 'P4'), { pname: 'b', alter: -1, oct: 4 });  // F → B♭
  assert.deepEqual(transposePitch('d', 0, 5, '-P4'), { pname: 'a', alter: 0, oct: 4 });
  assert.deepEqual(transposePitch('b', -1, 3, '-M2'), { pname: 'a', alter: -1, oct: 3 });
});
