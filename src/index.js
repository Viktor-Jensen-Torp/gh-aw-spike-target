// Small helpers. The spike's implementer agent adds to this file.

/** Returns the sum of a list of numbers. */
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

/** Returns the arithmetic mean of a list of numbers. */
function mean(numbers) {
  // Return 0 for an empty list to avoid NaN
  if (numbers.length === 0) {
    return 0;
  }
  return sum(numbers) / numbers.length;
}

/** Returns the median of a list of numbers. */
function median(numbers) {
  // Return 0 for an empty list to avoid NaN
  if (numbers.length === 0) {
    return 0;
  }
  const sorted = numbers.sort();
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return mean([sorted[middle - 1], sorted[middle]]);
  }
  return sorted[middle];
}

module.exports = { sum, mean, median };
