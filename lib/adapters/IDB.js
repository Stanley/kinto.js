"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require("babel-runtime/helpers/toConsumableArray");

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _regenerator = require("babel-runtime/regenerator");

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require("babel-runtime/helpers/asyncToGenerator");

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

var _getPrototypeOf = require("babel-runtime/core-js/object/get-prototype-of");

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

var _keys = require("babel-runtime/core-js/object/keys");

var _keys2 = _interopRequireDefault(_keys);

var _base = require("./base.js");

var _base2 = _interopRequireDefault(_base);

var _utils = require("../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var INDEXED_FIELDS = ["id", "_status", "last_modified"];

/**
 * IDB cursor handlers.
 * @type {Object}
 */
var cursorHandlers = {
  all: function all(filters, done) {
    var results = [];
    return function (event) {
      var cursor = event.target.result;
      if (cursor) {
        if ((0, _utils.filterObject)(filters, cursor.value)) {
          results.push(cursor.value);
        }
        cursor.continue();
      } else {
        done(results);
      }
    };
  },
  in: function _in(values, done) {
    if (values.length === 0) {
      return done([]);
    }
    var sortedValues = [].slice.call(values).sort();
    var results = [];
    return function (event) {
      var cursor = event.target.result;
      if (!cursor) {
        done(results);
        return;
      }
      var key = cursor.key,
          value = cursor.value;

      var i = 0;
      while (key > sortedValues[i]) {
        // The cursor has passed beyond this key. Check next.
        ++i;
        if (i === sortedValues.length) {
          done(results); // There is no next. Stop searching.
          return;
        }
      }
      if (key === sortedValues[i]) {
        results.push(value);
        cursor.continue();
      } else {
        cursor.continue(sortedValues[i]);
      }
    };
  }
};

/**
 * Extract from filters definition the first indexed field. Since indexes were
 * created on single-columns, extracting a single one makes sense.
 *
 * @param  {Object} filters The filters object.
 * @return {String|undefined}
 */
function findIndexedField(filters) {
  var filteredFields = (0, _keys2.default)(filters);
  var indexedFields = filteredFields.filter(function (field) {
    return INDEXED_FIELDS.includes(field);
  });
  return indexedFields[0];
}

/**
 * Creates an IDB request and attach it the appropriate cursor event handler to
 * perform a list query.
 *
 * Multiple matching values are handled by passing an array.
 *
 * @param  {IDBStore}         store      The IDB store.
 * @param  {String|undefined} indexField The indexed field to query, if any.
 * @param  {Any}              value      The value to filter, if any.
 * @param  {Object}           filters    More filters.
 * @param  {Function}         done       The operation completion handler.
 * @return {IDBRequest}
 */
function createListRequest(store, indexField, value, filters, done) {
  if (!indexField) {
    // Get all records.
    var _request = store.openCursor();
    _request.onsuccess = cursorHandlers.all(filters, done);
    return _request;
  }

  // WHERE IN equivalent clause
  if (Array.isArray(value)) {
    var _request2 = store.index(indexField).openCursor();
    _request2.onsuccess = cursorHandlers.in(value, done);
    return _request2;
  }

  // WHERE field = value clause
  var request = store.index(indexField).openCursor(IDBKeyRange.only(value));
  request.onsuccess = cursorHandlers.all(filters, done);
  return request;
}

/**
 * IndexedDB adapter.
 *
 * This adapter doesn't support any options.
 */

var IDB = function (_BaseAdapter) {
  (0, _inherits3.default)(IDB, _BaseAdapter);

  /**
   * Constructor.
   *
   * @param  {String} store The store name.
   * @param  {Object} options Adapter options.
   * @param  {String} options.dbname The IndexedDB name (default: same as store).
   */
  function IDB(storeName) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    (0, _classCallCheck3.default)(this, IDB);

    var _this = (0, _possibleConstructorReturn3.default)(this, (IDB.__proto__ || (0, _getPrototypeOf2.default)(IDB)).call(this));

    _this._db = null;
    // public properties
    /**
     * The database name.
     * @type {String}
     */
    _this.storeName = storeName;
    var _options$dbname = options.dbname,
        dbname = _options$dbname === undefined ? storeName : _options$dbname;

    _this.dbname = dbname;
    return _this;
  }

  (0, _createClass3.default)(IDB, [{
    key: "_handleError",
    value: function _handleError(method, err) {
      var error = new Error(method + "() " + err.message);
      error.stack = err.stack;
      throw error;
    }

    /**
     * Ensures a connection to the IndexedDB database has been opened.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "open",
    value: function open() {
      var _this2 = this;

      if (this._db) {
        return _promise2.default.resolve(this);
      }
      return new _promise2.default(function (resolve, reject) {
        var request = indexedDB.open(_this2.dbname, 1);
        request.onupgradeneeded = function (event) {
          // DB object
          var db = event.target.result;
          // Main collection store
          var collStore = db.createObjectStore(_this2.storeName, {
            keyPath: "id"
          });
          // Primary key (generated by IdSchema, UUID by default)
          collStore.createIndex("id", "id", { unique: true });
          // Local record status ("synced", "created", "updated", "deleted")
          collStore.createIndex("_status", "_status");
          // Last modified field
          collStore.createIndex("last_modified", "last_modified");

          // Metadata store
          var metaStore = db.createObjectStore("__meta__", {
            keyPath: "name"
          });
          metaStore.createIndex("name", "name", { unique: true });
        };
        request.onerror = function (event) {
          return reject(event.target.error);
        };
        request.onsuccess = function (event) {
          _this2._db = event.target.result;
          resolve(_this2);
        };
      });
    }

    /**
     * Closes current connection to the database.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "close",
    value: function close() {
      if (this._db) {
        this._db.close(); // indexedDB.close is synchronous
        this._db = null;
      }
      return _promise2.default.resolve();
    }

    /**
     * Returns a transaction and an object store for this collection.
     *
     * To determine if a transaction has completed successfully, we should rather
     * listen to the transaction’s complete event rather than the IDBObjectStore
     * request’s success event, because the transaction may still fail after the
     * success event fires.
     *
     * @param  {String}      mode  Transaction mode ("readwrite" or undefined)
     * @param  {String|null} name  Store name (defaults to coll name)
     * @return {Object}
     */

  }, {
    key: "prepare",
    value: function prepare() {
      var mode = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;
      var name = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      var storeName = name || this.storeName;
      // On Safari, calling IDBDatabase.transaction with mode == undefined raises
      // a TypeError.
      var transaction = mode ? this._db.transaction([storeName], mode) : this._db.transaction([storeName]);
      var store = transaction.objectStore(storeName);
      return { transaction: transaction, store: store };
    }

    /**
     * Deletes every records in the current collection.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "clear",
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
        var _this3 = this;

        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.prev = 0;
                _context.next = 3;
                return this.open();

              case 3:
                return _context.abrupt("return", new _promise2.default(function (resolve, reject) {
                  var _prepare = _this3.prepare("readwrite"),
                      transaction = _prepare.transaction,
                      store = _prepare.store;

                  store.clear();
                  transaction.onerror = function (event) {
                    return reject(new Error(event.target.error));
                  };
                  transaction.oncomplete = function () {
                    return resolve();
                  };
                }));

              case 6:
                _context.prev = 6;
                _context.t0 = _context["catch"](0);

                this._handleError("clear", _context.t0);

              case 9:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this, [[0, 6]]);
      }));

      function clear() {
        return _ref.apply(this, arguments);
      }

      return clear;
    }()

    /**
     * Executes the set of synchronous CRUD operations described in the provided
     * callback within an IndexedDB transaction, for current db store.
     *
     * The callback will be provided an object exposing the following synchronous
     * CRUD operation methods: get, create, update, delete.
     *
     * Important note: because limitations in IndexedDB implementations, no
     * asynchronous code should be performed within the provided callback; the
     * promise will therefore be rejected if the callback returns a Promise.
     *
     * Options:
     * - {Array} preload: The list of record IDs to fetch and make available to
     *   the transaction object get() method (default: [])
     *
     * @example
     * const db = new IDB("example");
     * db.execute(transaction => {
     *   transaction.create({id: 1, title: "foo"});
     *   transaction.update({id: 2, title: "bar"});
     *   transaction.delete(3);
     *   return "foo";
     * })
     *   .catch(console.error.bind(console));
     *   .then(console.log.bind(console)); // => "foo"
     *
     * @override
     * @param  {Function} callback The operation description callback.
     * @param  {Object}   options  The options object.
     * @return {Promise}
     */

  }, {
    key: "execute",
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(callback) {
        var _this4 = this;

        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { preload: [] };
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.open();

              case 2:
                return _context2.abrupt("return", new _promise2.default(function (resolve, reject) {
                  // Start transaction.
                  var _prepare2 = _this4.prepare("readwrite"),
                      transaction = _prepare2.transaction,
                      store = _prepare2.store;
                  // Preload specified records using index.


                  var ids = options.preload;
                  store.index("id").openCursor().onsuccess = cursorHandlers.in(ids, function (records) {
                    // Store obtained records by id.
                    var preloaded = records.reduce(function (acc, record) {
                      acc[record.id] = record;
                      return acc;
                    }, {});
                    // Expose a consistent API for every adapter instead of raw store methods.
                    var proxy = transactionProxy(store, preloaded);
                    // The callback is executed synchronously within the same transaction.
                    var result = void 0;
                    try {
                      result = callback(proxy);
                    } catch (e) {
                      transaction.abort();
                      reject(e);
                    }
                    if (result instanceof _promise2.default) {
                      // XXX: investigate how to provide documentation details in error.
                      reject(new Error("execute() callback should not return a Promise."));
                    }
                    // XXX unsure if we should manually abort the transaction on error
                    transaction.onerror = function (event) {
                      return reject(new Error(event.target.error));
                    };
                    transaction.oncomplete = function (event) {
                      return resolve(result);
                    };
                  });
                }));

              case 3:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function execute(_x4) {
        return _ref2.apply(this, arguments);
      }

      return execute;
    }()

    /**
     * Retrieve a record by its primary key from the IndexedDB database.
     *
     * @override
     * @param  {String} id The record id.
     * @return {Promise}
     */

  }, {
    key: "get",
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(id) {
        var _this5 = this;

        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.prev = 0;
                _context3.next = 3;
                return this.open();

              case 3:
                return _context3.abrupt("return", new _promise2.default(function (resolve, reject) {
                  var _prepare3 = _this5.prepare(),
                      transaction = _prepare3.transaction,
                      store = _prepare3.store;

                  var request = store.get(id);
                  transaction.onerror = function (event) {
                    return reject(new Error(event.target.error));
                  };
                  transaction.oncomplete = function () {
                    return resolve(request.result);
                  };
                }));

              case 6:
                _context3.prev = 6;
                _context3.t0 = _context3["catch"](0);

                this._handleError("get", _context3.t0);

              case 9:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this, [[0, 6]]);
      }));

      function get(_x6) {
        return _ref3.apply(this, arguments);
      }

      return get;
    }()

    /**
     * Lists all records from the IndexedDB database.
     *
     * @override
     * @param  {Object} params  The filters and order to apply to the results.
     * @return {Promise}
     */

  }, {
    key: "list",
    value: function () {
      var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
        var _this6 = this;

        var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { filters: {} };
        var filters, indexField, value, results;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                filters = params.filters;
                indexField = findIndexedField(filters);
                value = filters[indexField];
                _context4.prev = 3;
                _context4.next = 6;
                return this.open();

              case 6:
                _context4.next = 8;
                return new _promise2.default(function (resolve, reject) {
                  var results = [];
                  // If `indexField` was used already, don't filter again.
                  var remainingFilters = (0, _utils.omitKeys)(filters, indexField);

                  var _prepare4 = _this6.prepare(),
                      transaction = _prepare4.transaction,
                      store = _prepare4.store;

                  createListRequest(store, indexField, value, remainingFilters, function (_results) {
                    // we have received all requested records, parking them within
                    // current scope
                    results = _results;
                  });
                  transaction.onerror = function (event) {
                    return reject(new Error(event.target.error));
                  };
                  transaction.oncomplete = function (event) {
                    return resolve(results);
                  };
                });

              case 8:
                results = _context4.sent;
                return _context4.abrupt("return", params.order ? (0, _utils.sortObjects)(params.order, results) : results);

              case 12:
                _context4.prev = 12;
                _context4.t0 = _context4["catch"](3);

                this._handleError("list", _context4.t0);

              case 15:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[3, 12]]);
      }));

      function list() {
        return _ref4.apply(this, arguments);
      }

      return list;
    }()

    /**
     * Store the lastModified value into metadata store.
     *
     * @override
     * @param  {Number}  lastModified
     * @return {Promise}
     */

  }, {
    key: "saveLastModified",
    value: function () {
      var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(lastModified) {
        var _this7 = this;

        var value;
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                value = parseInt(lastModified, 10) || null;
                _context5.next = 3;
                return this.open();

              case 3:
                return _context5.abrupt("return", new _promise2.default(function (resolve, reject) {
                  var _prepare5 = _this7.prepare("readwrite", "__meta__"),
                      transaction = _prepare5.transaction,
                      store = _prepare5.store;

                  store.put({ name: _this7.storeName + "-lastModified", value: value });
                  transaction.onerror = function (event) {
                    return reject(event.target.error);
                  };
                  transaction.oncomplete = function (event) {
                    return resolve(value);
                  };
                }));

              case 4:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function saveLastModified(_x8) {
        return _ref5.apply(this, arguments);
      }

      return saveLastModified;
    }()

    /**
     * Retrieve saved lastModified value.
     *
     * @override
     * @return {Promise}
     */

  }, {
    key: "getLastModified",
    value: function () {
      var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6() {
        var _this8 = this;

        return _regenerator2.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this.open();

              case 2:
                return _context6.abrupt("return", new _promise2.default(function (resolve, reject) {
                  var _prepare6 = _this8.prepare(undefined, "__meta__"),
                      transaction = _prepare6.transaction,
                      store = _prepare6.store;

                  var request = store.get(_this8.storeName + "-lastModified");
                  transaction.onerror = function (event) {
                    return reject(event.target.error);
                  };
                  transaction.oncomplete = function (event) {
                    resolve(request.result && request.result.value || null);
                  };
                }));

              case 3:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function getLastModified() {
        return _ref6.apply(this, arguments);
      }

      return getLastModified;
    }()

    /**
     * Load a dump of records exported from a server.
     *
     * @abstract
     * @param  {Array} records The records to load.
     * @return {Promise}
     */

  }, {
    key: "loadDump",
    value: function () {
      var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(records) {
        var previousLastModified, lastModified;
        return _regenerator2.default.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.prev = 0;
                _context7.next = 3;
                return this.execute(function (transaction) {
                  records.forEach(function (record) {
                    return transaction.update(record);
                  });
                });

              case 3:
                _context7.next = 5;
                return this.getLastModified();

              case 5:
                previousLastModified = _context7.sent;
                lastModified = Math.max.apply(Math, (0, _toConsumableArray3.default)(records.map(function (record) {
                  return record.last_modified;
                })));

                if (!(lastModified > previousLastModified)) {
                  _context7.next = 10;
                  break;
                }

                _context7.next = 10;
                return this.saveLastModified(lastModified);

              case 10:
                return _context7.abrupt("return", records);

              case 13:
                _context7.prev = 13;
                _context7.t0 = _context7["catch"](0);

                this._handleError("loadDump", _context7.t0);

              case 16:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this, [[0, 13]]);
      }));

      function loadDump(_x9) {
        return _ref7.apply(this, arguments);
      }

      return loadDump;
    }()
  }]);
  return IDB;
}(_base2.default);

/**
 * IDB transaction proxy.
 *
 * @param  {IDBStore} store     The IndexedDB database store.
 * @param  {Array}    preloaded The list of records to make available to
 *                              get() (default: []).
 * @return {Object}
 */


exports.default = IDB;
function transactionProxy(store) {
  var preloaded = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  return {
    create: function create(record) {
      store.add(record);
    },
    update: function update(record) {
      store.put(record);
    },
    delete: function _delete(id) {
      store.delete(id);
    },
    get: function get(id) {
      return preloaded[id];
    }
  };
}