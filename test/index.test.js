const test = require('node:test');
const assert = require('node:assert');
const { sum, mean, median } = require('../src/index.js');

test('sum adds the numbers', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum of an empty list is zero', () => {
  assert.strictEqual(sum([]), 0);
});

test('mean calculates the arithmetic mean', () => {
  assert.strictEqual(mean([2, 4, 6]), 4);
});

test('mean of an empty list is zero', () => {
  assert.strictEqual(mean([]), 0);
});

test('mean with non-integer result', () => {
  assert.strictEqual(mean([1, 2, 3, 4]), 2.5);
});

test('median of an odd-length list', () => {
  assert.strictEqual(median([3, 1, 2]), 2);
});

test('median of an even-length list', () => {
  assert.strictEqual(median([4, 1, 3, 2]), 2.5);
});

test('median of an empty list is zero', () => {
  assert.strictEqual(median([]), 0);
});

test('median with multi-digit numbers', () => {
  assert.strictEqual(median([100, 5, 50]), 50);
});
