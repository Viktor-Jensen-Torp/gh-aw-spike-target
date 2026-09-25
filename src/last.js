/** Returns the last element of a list, or undefined if the list is empty. */
function last(list) {
  if (!Array.isArray(list)) {
    throw new TypeError('Argument must be an array');
  }
  return list[list.length - 1];
}

module.exports = { last };
