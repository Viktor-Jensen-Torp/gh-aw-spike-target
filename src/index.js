// Small helpers. The spike's implementer agent adds to this file.

/** Returns the sum of a list of numbers. */
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

/** Returns the arithmetic mean of a list of numbers. */
function mean(numbers) {
  // Return 0 for an empty list to avoid returning NaN.
  if (numbers.length === 0) {
    return 0;
  }
  return sum(numbers) / numbers.length;
}

module.exports = { sum, mean };
