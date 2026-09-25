/** Returns the largest number in the list, or undefined if the list is empty. */
function max(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Argument must be an array');
  }

  if (numbers.length === 0) {
    return undefined;
  }

  let maxValue = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] > maxValue) {
      maxValue = numbers[i];
    }
  }

  return maxValue;
}

module.exports = { max };
