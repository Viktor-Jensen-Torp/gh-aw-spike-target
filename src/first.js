/** Returns the first element of a list, or undefined if the list is empty. */
function first(list) {
  if (!Array.isArray(list)) {
    throw new TypeError('Argument must be an array');
  }
  return list[0];
}

module.exports = { first };
