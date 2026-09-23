// Small helpers used by the reporting dashboard.

const { sum } = require('./sum.js');

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

/** Returns integers from start up to but not including end. */
function range(start, end) {
  if (!Number.isInteger(start)) {
    throw new TypeError('start must be an integer');
  }
  if (!Number.isInteger(end)) {
    throw new TypeError('end must be an integer');
  }
  
  const result = [];
  if (end <= start) {
    return result;
  }
  
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  
  return result;
}

module.exports = { movingAverage, unique, first, count, range };
