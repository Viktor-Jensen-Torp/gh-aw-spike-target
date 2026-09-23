/** Returns the arithmetic mean of a list of numbers. */
function mean(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Argument must be an array');
  }

  // An empty list has no mean: return 0.
  if (numbers.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const n of numbers) {
    sum += n;
  }
  return sum / numbers.length;
}

module.exports = { mean };
