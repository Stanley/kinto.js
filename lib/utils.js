"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RE_RECORD_ID = undefined;

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

exports.sortObjects = sortObjects;
exports.filterObject = filterObject;
exports.filterObjects = filterObjects;
exports.waterfall = waterfall;
exports.deepEqual = deepEqual;
exports.omitKeys = omitKeys;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var RE_RECORD_ID = exports.RE_RECORD_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/**
 * Checks if a value is undefined.
 * @param  {Any}  value
 * @return {Boolean}
 */
function _isUndefined(value) {
  return typeof value === "undefined";
}

/**
 * Sorts records in a list according to a given ordering.
 *
 * @param  {String} order The ordering, eg. `-last_modified`.
 * @param  {Array}  list  The collection to order.
 * @return {Array}
 */
function sortObjects(order, list) {
  var hasDash = order[0] === "-";
  var field = hasDash ? order.slice(1) : order;
  var direction = hasDash ? -1 : 1;
  return list.slice().sort(function (a, b) {
    if (a[field] && _isUndefined(b[field])) {
      return direction;
    }
    if (b[field] && _isUndefined(a[field])) {
      return -direction;
    }
    if (_isUndefined(a[field]) && _isUndefined(b[field])) {
      return 0;
    }
    return a[field] > b[field] ? direction : -direction;
  });
}

/**
 * Test if a single object matches all given filters.
 *
 * @param  {Object} filters  The filters object.
 * @param  {Object} entry    The object to filter.
 * @return {Boolean}
 */
function filterObject(filters, entry) {
  return (0, _keys2.default)(filters).every(function (filter) {
    var value = filters[filter];
    if (Array.isArray(value)) {
      return value.some(function (candidate) {
        return candidate === entry[filter];
      });
    }
    return entry[filter] === value;
  });
}

/**
 * Filters records in a list matching all given filters.
 *
 * @param  {Object} filters  The filters object.
 * @param  {Array}  list     The collection to filter.
 * @return {Array}
 */
function filterObjects(filters, list) {
  return list.filter(function (entry) {
    return filterObject(filters, entry);
  });
}

/**
 * Resolves a list of functions sequentially, which can be sync or async; in
 * case of async, functions must return a promise.
 *
 * @param  {Array} fns  The list of functions.
 * @param  {Any}   init The initial value.
 * @return {Promise}
 */
function waterfall(fns, init) {
  if (!fns.length) {
    return _promise2.default.resolve(init);
  }
  return fns.reduce(function (promise, nextFn) {
    return promise.then(nextFn);
  }, _promise2.default.resolve(init));
}

/**
 * Simple deep object comparison function. This only supports comparison of
 * serializable JavaScript objects.
 *
 * @param  {Object} a The source object.
 * @param  {Object} b The compared object.
 * @return {Boolean}
 */
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if ((typeof a === "undefined" ? "undefined" : (0, _typeof3.default)(a)) !== (typeof b === "undefined" ? "undefined" : (0, _typeof3.default)(b))) {
    return false;
  }
  if (!(a && (typeof a === "undefined" ? "undefined" : (0, _typeof3.default)(a)) == "object") || !(b && (typeof b === "undefined" ? "undefined" : (0, _typeof3.default)(b)) == "object")) {
    return false;
  }
  if ((0, _keys2.default)(a).length !== (0, _keys2.default)(b).length) {
    return false;
  }
  for (var k in a) {
    if (!deepEqual(a[k], b[k])) {
      return false;
    }
  }
  return true;
}

/**
 * Return an object without the specified keys.
 *
 * @param  {Object} obj        The original object.
 * @param  {Array}  keys       The list of keys to exclude.
 * @return {Object}            A copy without the specified keys.
 */
function omitKeys(obj) {
  var keys = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  return (0, _keys2.default)(obj).reduce(function (acc, key) {
    if (!keys.includes(key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}