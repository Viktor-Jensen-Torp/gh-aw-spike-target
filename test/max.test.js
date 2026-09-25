const test = require('node:test');
const assert = require('node:assert');
const { max } = require('../src/max.js');

test('max([3,1,2]) returns 3', () => {
  assert.strictEqual(max([3, 1, 2]), 3);
});

test('max([-5,-2]) returns -2', () => {
  assert.strictEqual(max([-5, -2]), -2);
});

test('max([7]) returns 7', () => {
  assert.strictEqual(max([7]), 7);
});

test('max([]) returns undefined', () => {
  assert.strictEqual(max([]), undefined);
});

test("max('nope') throws TypeError", () => {
  assert.throws(() => max('nope'), TypeError);
});

test('max does not modify the input array', () => {
  const original = [3, 1, 2];
  const copy = [...original];
  max(original);
  assert.deepStrictEqual(original, copy);
});
