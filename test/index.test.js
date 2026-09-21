const test = require('node:test');
const assert = require('node:assert');
const { sum, median } = require('../src/index.js');

test('sum adds the numbers', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum of an empty list is zero', () => {
  assert.strictEqual(sum([]), 0);
});

test('median of an odd-length list is the middle value', () => {
  assert.strictEqual(median([1, 3, 5]), 3);
});

test('median of an even-length list is the mean of the two middle values', () => {
  assert.strictEqual(median([1, 2, 3, 4]), 2.5);
});

test('median of an empty list returns 0 (not NaN)', () => {
  assert.strictEqual(median([]), 0);
});

test('median does not mutate the input array', () => {
  const input = [5, 1, 3];
  const original = [...input];
  median(input);
  assert.deepStrictEqual(input, original);
});
