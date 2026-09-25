const test = require('node:test');
const assert = require('node:assert');
const { mean } = require('../src/mean.js');

test('mean([1,2,3]) returns 2', () => {
  assert.strictEqual(mean([1, 2, 3]), 2);
});

test('mean([2,4]) returns 3', () => {
  assert.strictEqual(mean([2, 4]), 3);
});

test('mean([]) returns 0', () => {
  assert.strictEqual(mean([]), 0);
});

test("mean('nope') throws TypeError", () => {
  assert.throws(() => mean('nope'), TypeError);
});

test('mean does not modify the input array', () => {
  const original = [1, 2, 3];
  const copy = [...original];
  mean(original);
  assert.deepStrictEqual(original, copy);
});

test('mean with single element', () => {
  assert.strictEqual(mean([5]), 5);
});

test('mean with negative numbers', () => {
  assert.strictEqual(mean([-1, -2, -3]), -2);
});

test('mean with decimal numbers', () => {
  assert.strictEqual(mean([1.5, 2.5, 3.5]), 2.5);
});
