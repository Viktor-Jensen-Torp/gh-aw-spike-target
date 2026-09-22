// Small helpers. The spike's implementer agent adds to this file.

/** Returns the sum of a list of numbers. */
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

/** Truncates text to fit within maxLength characters, adding an ellipsis if needed. */
function truncate(text, maxLength) {
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new RangeError('maxLength must be a positive integer');
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  // Use ellipsis character (…) U+2026
  const ellipsis = '…';
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

module.exports = { sum, truncate };
