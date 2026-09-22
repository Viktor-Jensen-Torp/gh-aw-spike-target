const test = require('node:test');
const assert = require('node:assert');
const { sum, last, movingAverage } = require('../src/index.js');

test('sum adds the numbers', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum of an empty list is zero', () => {
  assert.strictEqual(sum([]), 0);
});

test('last returns the final element of a list', () => {
  assert.strictEqual(last([1, 2, 3]), 3);
});

test('last returns the only element when array has one element', () => {
  assert.strictEqual(last([1]), 1);
});

test('last returns the final element with multiple elements', () => {
  assert.strictEqual(last([5, 10, 15, 20]), 20);
});

test('last throws RangeError for empty array', () => {
  assert.throws(() => last([]), RangeError);
});

test('last does not modify the input array', () => {
  const original = [1, 2, 3, 4, 5];
  const copy = [...original];
  last(original);
  assert.deepStrictEqual(original, copy);
});


test('movingAverage with window size 3 on 7 elements gives 5 results', () => {
  const result = movingAverage([1, 2, 3, 4, 5, 6, 7], 3);
  assert.deepStrictEqual(result, [2, 3, 4, 5, 6]);
});

test('movingAverage with window size 1 returns the same list', () => {
  assert.deepStrictEqual(movingAverage([1, 2, 3], 1), [1, 2, 3]);
});

test('movingAverage with window size equal to list length returns single average', () => {
  assert.deepStrictEqual(movingAverage([1, 2, 3], 3), [2]);
});

test('movingAverage with window size 2', () => {
  assert.deepStrictEqual(movingAverage([1, 2, 3, 4], 2), [1.5, 2.5, 3.5]);
});

test('movingAverage throws RangeError for empty list', () => {
  assert.throws(() => movingAverage([], 1), RangeError);
});

test('movingAverage throws RangeError for windowSize <= 0', () => {
  assert.throws(() => movingAverage([1, 2, 3], 0), RangeError);
  assert.throws(() => movingAverage([1, 2, 3], -1), RangeError);
});

test('movingAverage throws RangeError for windowSize > list length', () => {
  assert.throws(() => movingAverage([1, 2, 3], 4), RangeError);
});

test('movingAverage throws RangeError for non-integer windowSize', () => {
  assert.throws(() => movingAverage([1, 2, 3], 1.5), RangeError);
});

test('movingAverage does not modify the input array', () => {
  const original = [1, 2, 3, 4, 5];
  const copy = [...original];
  movingAverage(original, 2);
  assert.deepStrictEqual(original, copy);
});
