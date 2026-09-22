const test = require('node:test');
const assert = require('node:assert');
const { sum, movingAverage, unique } = require('../src/index.js');

test('sum adds the numbers', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum of an empty list is zero', () => {
  assert.strictEqual(sum([]), 0);
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

test('unique removes duplicates and preserves order', () => {
  assert.deepStrictEqual(unique([1, 2, 3, 2, 1]), [1, 2, 3]);
});

test('unique on empty list returns empty list', () => {
  assert.deepStrictEqual(unique([]), []);
});

test('unique on single element returns single element', () => {
  assert.deepStrictEqual(unique([1]), [1]);
});

test('unique on all duplicates returns one element', () => {
  assert.deepStrictEqual(unique([1, 1, 1]), [1]);
});

test('unique works with strings', () => {
  assert.deepStrictEqual(unique(['a', 'b', 'a']), ['a', 'b']);
});

test('unique uses strict equality', () => {
  assert.deepStrictEqual(unique([1, '1', 1]), [1, '1']);
});

test('unique does not modify the input array', () => {
  const original = [1, 2, 3, 2, 1];
  const copy = [...original];
  unique(original);
  assert.deepStrictEqual(original, copy);
});
