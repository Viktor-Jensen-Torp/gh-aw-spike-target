const test = require('node:test');
const assert = require('node:assert');
const { sum } = require('../src/sum.js');

test('sum adds the numbers', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum of an empty list is zero', () => {
  assert.strictEqual(sum([]), 0);
});
