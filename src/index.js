// Small helpers used by the reporting dashboard.

/** Returns the sum of a list of numbers. */
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

/** Returns a list of averages of consecutive runs of windowSize values. */
function movingAverage(numbers, windowSize) {
  // Validate inputs
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new RangeError('numbers must be a non-empty array');
  }
  if (!Number.isInteger(windowSize) || windowSize <= 0 || windowSize > numbers.length) {
    throw new RangeError('windowSize must be a positive integer no larger than the list');
  }

  // Calculate moving averages
  const result = [];
  for (let i = 0; i <= numbers.length - windowSize; i++) {
    const window = numbers.slice(i, i + windowSize);
    const average = sum(window) / windowSize;
    result.push(average);
  }

  return result;
}

/** Constrains a value within a minimum and maximum range. */
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

module.exports = { sum, movingAverage, clamp };
