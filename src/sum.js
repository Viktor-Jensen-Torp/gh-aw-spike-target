/** Returns the sum of a list of numbers. */
function sum(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Argument must be an array');
  }

  for (const n of numbers) {
    if (typeof n !== 'number' || !isFinite(n)) {
      throw new TypeError('All elements must be finite numbers');
    }
  }

  return numbers.reduce((total, n) => total + n, 0);
}

module.exports = { sum };
