const test = require('node:test');
const assert = require('node:assert');
const { last } = require('../src/last.js');

test('last returns the last element', () => {
  assert.strictEqual(last([1, 2, 3]), 3);
});

test('last with single element', () => {
  assert.strictEqual(last([7]), 7);
});

test('last with empty array returns undefined', () => {
  assert.strictEqual(last([]), undefined);
});

test('last with non-array argument throws TypeError', () => {
  assert.throws(() => last('nope'), TypeError);
});

test('last does not modify the input array', () => {
  const original = [1, 2, 3];
  const copy = [...original];
  last(original);
  assert.deepStrictEqual(original, copy);
});
