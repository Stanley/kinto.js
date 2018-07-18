"use strict";

/**
 * Base db adapter.
 *
 * @abstract
 */

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var BaseAdapter = function () {
  function BaseAdapter() {
    (0, _classCallCheck3.default)(this, BaseAdapter);
  }

  (0, _createClass3.default)(BaseAdapter, [{
    key: "clear",

    /**
     * Deletes every records present in the database.
     *
     * @abstract
     * @return {Promise}
     */
    value: function clear() {
      throw new Error("Not Implemented.");
    }

    /**
     * Executes a batch of operations within a single transaction.
     *
     * @abstract
     * @param  {Function} callback The operation callback.
     * @param  {Object}   options  The options object.
     * @return {Promise}
     */

  }, {
    key: "execute",
    value: function execute(callback) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { preload: [] };

      throw new Error("Not Implemented.");
    }

    /**
     * Retrieve a record by its primary key from the database.
     *
     * @abstract
     * @param  {String} id The record id.
     * @return {Promise}
     */

  }, {
    key: "get",
    value: function get(id) {
      throw new Error("Not Implemented.");
    }

    /**
     * Lists all records from the database.
     *
     * @abstract
     * @param  {Object} params  The filters and order to apply to the results.
     * @return {Promise}
     */

  }, {
    key: "list",
    value: function list() {
      var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { filters: {}, order: "" };

      throw new Error("Not Implemented.");
    }

    /**
     * Store the lastModified value.
     *
     * @abstract
     * @param  {Number}  lastModified
     * @return {Promise}
     */

  }, {
    key: "saveLastModified",
    value: function saveLastModified(lastModified) {
      throw new Error("Not Implemented.");
    }

    /**
     * Retrieve saved lastModified value.
     *
     * @abstract
     * @return {Promise}
     */

  }, {
    key: "getLastModified",
    value: function getLastModified() {
      throw new Error("Not Implemented.");
    }

    /**
     * Load a dump of records exported from a server.
     *
     * @abstract
     * @param  {Array} records The records to load.
     * @return {Promise}
     */

  }, {
    key: "loadDump",
    value: function loadDump(records) {
      throw new Error("Not Implemented.");
    }
  }]);
  return BaseAdapter;
}();

exports.default = BaseAdapter;