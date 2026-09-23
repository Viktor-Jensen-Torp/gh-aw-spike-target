/** Returns the smallest number in the list. Returns undefined for an empty list. */
function min(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Argument must be an array');
  }
  
  if (numbers.length === 0) {
    return undefined;
  }
  
  let minValue = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] < minValue) {
      minValue = numbers[i];
    }
  }
  
  return minValue;
}

module.exports = { min };
