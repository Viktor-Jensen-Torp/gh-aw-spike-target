const test = require('node:test');
const assert = require('node:assert');
const { median } = require('../src/median.js');

test('median([3,1,2]) returns 2', () => {
  assert.strictEqual(median([3, 1, 2]), 2);
});

test('median([4,1,3,2]) returns 2.5', () => {
  assert.strictEqual(median([4, 1, 3, 2]), 2.5);
});

test('median([10,9,1]) returns 9', () => {
  assert.strictEqual(median([10, 9, 1]), 9);
});

test('median does not modify the input array', () => {
  const a = [3, 1, 2];
  const copy = [...a];
  median(a);
  assert.deepStrictEqual(a, copy);
});

test('median([]) throws RangeError', () => {
  assert.throws(() => median([]), RangeError);
});

test("median('nope') throws TypeError", () => {
  assert.throws(() => median('nope'), TypeError);
});

test('median([1, "x"]) throws TypeError', () => {
  assert.throws(() => median([1, 'x']), TypeError);
});
