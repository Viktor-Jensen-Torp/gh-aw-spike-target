const test = require('node:test');
const assert = require('node:assert');
const { sum } = require('../src/sum.js');

test('sum([1, 2, 3]) returns 6', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum([]) returns 0', () => {
  assert.strictEqual(sum([]), 0);
});

test("sum('abc') throws TypeError", () => {
  assert.throws(() => sum('abc'), TypeError);
});

test("sum([1, '2']) throws TypeError", () => {
  assert.throws(() => sum([1, '2']), TypeError);
});

test('sum([1, NaN]) throws TypeError', () => {
  assert.throws(() => sum([1, NaN]), TypeError);
});
