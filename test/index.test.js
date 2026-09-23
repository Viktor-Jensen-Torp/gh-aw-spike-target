const test = require('node:test');
const assert = require('node:assert');
const { movingAverage, unique, first, count, range } = require('../src/index.js');

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

test('first returns the first element', () => {
  assert.strictEqual(first([1, 2, 3]), 1);
});

test('first with single element', () => {
  assert.strictEqual(first([7]), 7);
});

test('first with empty array returns undefined', () => {
  assert.strictEqual(first([]), undefined);
});

test('first with non-array argument throws TypeError', () => {
  assert.throws(() => first('nope'), TypeError);
});

test('first does not modify the input array', () => {
  const original = [1, 2, 3];
  const copy = [...original];
  first(original);
  assert.deepStrictEqual(original, copy);
});

test('count returns number of elements satisfying predicate', () => {
  assert.strictEqual(count([1, 2, 3, 4], n => n % 2 === 0), 2);
});

test('count returns zero for empty list', () => {
  assert.strictEqual(count([], n => true), 0);
});

test('count returns zero when no elements satisfy predicate', () => {
  assert.strictEqual(count([1, 2, 3], n => false), 0);
});

test('count throws TypeError for non-array argument', () => {
  assert.throws(() => count('nope', n => true), TypeError);
});

test('count throws TypeError for non-function predicate', () => {
  assert.throws(() => count([1, 2], 'nope'), TypeError);
});

test('count does not modify the input array', () => {
  const original = [1, 2, 3, 4];
  const copy = [...original];
  count(original, n => n % 2 === 0);
  assert.deepStrictEqual(original, copy);
});

test('range(0, 4) returns [0,1,2,3]', () => {
  assert.deepStrictEqual(range(0, 4), [0, 1, 2, 3]);
});

test('range(2, 5) returns [2,3,4]', () => {
  assert.deepStrictEqual(range(2, 5), [2, 3, 4]);
});

test('range(3, 3) returns empty list', () => {
  assert.deepStrictEqual(range(3, 3), []);
});

test('range(5, 1) returns empty list', () => {
  assert.deepStrictEqual(range(5, 1), []);
});

test('range(0, 1.5) throws TypeError', () => {
  assert.throws(() => range(0, 1.5), TypeError);
});

test('range with non-integer start throws TypeError', () => {
  assert.throws(() => range(1.5, 5), TypeError);
});

test('range with non-integer end throws TypeError', () => {
  assert.throws(() => range(0, 2.5), TypeError);
});

test('range with negative start and positive end', () => {
  assert.deepStrictEqual(range(-2, 2), [-2, -1, 0, 1]);
});

test('range with both negative numbers', () => {
  assert.deepStrictEqual(range(-5, -2), [-5, -4, -3]);
});
