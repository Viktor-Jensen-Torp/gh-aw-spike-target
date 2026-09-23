const test = require('node:test');
const assert = require('node:assert');
const { min } = require('../src/min.js');

test('min([3,1,2]) returns 1', () => {
  assert.strictEqual(min([3, 1, 2]), 1);
});

test('min([-5,-2]) returns -5', () => {
  assert.strictEqual(min([-5, -2]), -5);
});

test('min([7]) returns 7', () => {
  assert.strictEqual(min([7]), 7);
});

test('min([]) returns undefined', () => {
  assert.strictEqual(min([]), undefined);
});

test('min("nope") throws TypeError', () => {
  assert.throws(() => min('nope'), TypeError);
});

test('min does not modify the input array', () => {
  const original = [3, 1, 2];
  const copy = [...original];
  min(original);
  assert.deepStrictEqual(original, copy);
});
