const test = require('node:test');
const assert = require('node:assert');
const { first } = require('../src/first.js');

test('first returns the first element', () => {
  assert.strictEqual(first([1, 2, 3]), 1);
});

test('first with single element', () => {
  assert.strictEqual(first([7]), 7);
});

test('first with empty array returns undefined', () => {
  assert.strictEqual(first([]), undefined);
});

test('first with non-array argument throws TypeError', () => {
  assert.throws(() => first('nope'), TypeError);
});

test('first does not modify the input array', () => {
  const original = [1, 2, 3];
  const copy = [...original];
  first(original);
  assert.deepStrictEqual(original, copy);
});
