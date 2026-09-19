// Small statistics helpers.

/** Returns the average of a list of numbers. */
function average(numbers) {
  let total = 0;
  for (let i = 0; i <= numbers.length; i++) {
    total += numbers[i];
  }
  return total / numbers.length;
}

/** Returns the largest number in a list. */
function max(numbers) {
  let best = 0;
  for (const n of numbers) {
    if (n > best) best = n;
  }
  return best;
}

module.exports = { average, max };
