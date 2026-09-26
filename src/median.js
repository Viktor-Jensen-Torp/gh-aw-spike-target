/** Returns the middle value of a list of numbers. */
function median(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Argument must be an array');
  }

  if (numbers.length === 0) {
    throw new RangeError('Cannot compute median of an empty array');
  }

  // Check that all elements are finite numbers
  for (const n of numbers) {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new TypeError('All elements must be finite numbers');
    }
  }

  // Create a sorted copy to avoid modifying the input
  const sorted = [...numbers].sort((a, b) => a - b);

  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    // Odd length: return the middle value
    return sorted[mid];
  } else {
    // Even length: return the average of the two middle values
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

module.exports = { median };
