// Small helpers. The spike's implementer agent adds to this file.

/** Returns the sum of a list of numbers. */
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

/** Returns the arithmetic mean of a list of numbers. */
function mean(numbers) {
  return numbers.length === 0 ? 0 : sum(numbers) / numbers.length;
}

/** Returns the median of a list of numbers.
 * For an even-length list, returns the mean of the two middle values.
 * For an empty list, returns 0 (not NaN).
 * Does not mutate the input array.
 */
function median(numbers) {
  // Return 0 for empty list to avoid NaN
  if (numbers.length === 0) return 0;
  
  // Sort a copy to avoid mutating the input
  const sorted = [...numbers].sort((a, b) => a - b);
  const len = sorted.length;
  const mid = Math.floor(len / 2);
  
  // Odd length: return middle value
  if (len % 2 !== 0) {
    return sorted[mid];
  }
  
  // Even length: return mean of two middle values
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

module.exports = { sum, mean, median };
