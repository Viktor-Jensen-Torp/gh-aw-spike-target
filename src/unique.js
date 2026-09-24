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

module.exports = { unique };
