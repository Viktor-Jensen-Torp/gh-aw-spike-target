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

/** Returns a new list with only the first occurrence of each element. */
function unique(array) {
  const seen = new Set();
  const result = [];
  for (const item of array) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

/** Returns the first element of a list, or undefined if the list is empty. */
function first(list) {
  if (!Array.isArray(list)) {
    throw new TypeError('Argument must be an array');
  }
  return list[0];
}

/** Returns the count of elements that satisfy the predicate. */
function count(list, predicate) {
  if (!Array.isArray(list)) {
    throw new TypeError('Argument must be an array');
  }
  if (typeof predicate !== 'function') {
    throw new TypeError('Predicate must be a function');
  }
  
  let counter = 0;
  for (const item of list) {
    if (predicate(item)) {
      counter++;
    }
  }
  return counter;
}

/** Returns the sum of each number squared. */
function sumOfSquares(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Argument must be an array');
  }
  return numbers.reduce((total, n) => total + (n * n), 0);
}

module.exports = { sum, movingAverage, unique, first, count, sumOfSquares };
