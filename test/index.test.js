const test = require('node:test');
const assert = require('node:assert');
const { sum, mean } = require('../src/index.js');

test('sum adds the numbers', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum of an empty list is zero', () => {
  assert.strictEqual(sum([]), 0);
});

test('mean calculates the average', () => {
  assert.strictEqual(mean([1, 2, 3]), 2);
});

test('mean of an empty list is zero', () => {
  assert.strictEqual(mean([]), 0);
});

test('mean returns a non-integer result', () => {
  assert.strictEqual(mean([1, 2, 3, 4]), 2.5);
});
