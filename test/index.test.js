const test = require('node:test');
const assert = require('node:assert');
const { sum, truncate } = require('../src/index.js');

test('sum adds the numbers', () => {
  assert.strictEqual(sum([1, 2, 3]), 6);
});

test('sum of an empty list is zero', () => {
  assert.strictEqual(sum([]), 0);
});

test('truncate returns text unchanged when it fits', () => {
  assert.strictEqual(truncate('hello', 10), 'hello');
});

test('truncate returns text unchanged when it exactly fits', () => {
  assert.strictEqual(truncate('hello', 5), 'hello');
});

test('truncate shortens text with ellipsis when too long', () => {
  assert.strictEqual(truncate('hello world', 8), 'hello wo…');
});

test('truncate throws RangeError for non-integer maxLength', () => {
  assert.throws(() => truncate('hello', 5.5), RangeError);
});

test('truncate throws RangeError for zero maxLength', () => {
  assert.throws(() => truncate('hello', 0), RangeError);
});

test('truncate throws RangeError for negative maxLength', () => {
  assert.throws(() => truncate('hello', -5), RangeError);
});
