const test = require('node:test');
const assert = require('node:assert');
const { unique } = require('../src/unique.js');

test('unique removes duplicates and preserves order', () => {
  assert.deepStrictEqual(unique([1, 2, 3, 2, 1]), [1, 2, 3]);
});

test('unique on empty list returns empty list', () => {
  assert.deepStrictEqual(unique([]), []);
});

test('unique on single element returns single element', () => {
  assert.deepStrictEqual(unique([1]), [1]);
});

test('unique on all duplicates returns one element', () => {
  assert.deepStrictEqual(unique([1, 1, 1]), [1]);
});

test('unique works with strings', () => {
  assert.deepStrictEqual(unique(['a', 'b', 'a']), ['a', 'b']);
});

test('unique uses strict equality', () => {
  assert.deepStrictEqual(unique([1, '1', 1]), [1, '1']);
});

test('unique does not modify the input array', () => {
  const original = [1, 2, 3, 2, 1];
  const copy = [...original];
  unique(original);
  assert.deepStrictEqual(original, copy);
});

test("unique('nope') throws TypeError", () => {
  assert.throws(() => unique('nope'), TypeError);
});

test('unique(null) throws TypeError', () => {
  assert.throws(() => unique(null), TypeError);
});
