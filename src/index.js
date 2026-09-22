// Small helpers. The spike's implementer agent adds to this file.

/** Returns the sum of a list of numbers. */
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

module.exports = { sum };

// Experiment: does a red required check cancel a pending auto-merge, or pause it?
