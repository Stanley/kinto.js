"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollectionTransaction = exports.SyncResultObject = undefined;

var _stringify = require("babel-runtime/core-js/json/stringify");

var _stringify2 = _interopRequireDefault(_stringify);

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require("babel-runtime/regenerator");

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require("babel-runtime/helpers/asyncToGenerator");

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

var _from = require("babel-runtime/core-js/array/from");

var _from2 = _interopRequireDefault(_from);

var _map = require("babel-runtime/core-js/map");

var _map2 = _interopRequireDefault(_map);

var _set = require("babel-runtime/core-js/set");

var _set2 = _interopRequireDefault(_set);

var _assign = require("babel-runtime/core-js/object/assign");

var _assign2 = _interopRequireDefault(_assign);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

exports.recordsEqual = recordsEqual;

var _base = require("./adapters/base");

var _base2 = _interopRequireDefault(_base);

var _IDB = require("./adapters/IDB");

var _IDB2 = _interopRequireDefault(_IDB);

var _utils = require("./utils");

var _uuid = require("uuid");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var RECORD_FIELDS_TO_CLEAN = ["_status"];
var AVAILABLE_HOOKS = ["incoming-changes"];

/**
 * Compare two records omitting local fields and synchronization
 * attributes (like _status and last_modified)
 * @param {Object} a    A record to compare.
 * @param {Object} b    A record to compare.
 * @param {Array} localFields Additional fields to ignore during the comparison
 * @return {boolean}
 */
function recordsEqual(a, b) {
  var localFields = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  var fieldsToClean = RECORD_FIELDS_TO_CLEAN.concat(["last_modified"]).concat(localFields);
  var cleanLocal = function cleanLocal(r) {
    return (0, _utils.omitKeys)(r, fieldsToClean);
  };
  return (0, _utils.deepEqual)(cleanLocal(a), cleanLocal(b));
}

/**
 * Synchronization result object.
 */

var SyncResultObject = exports.SyncResultObject = function () {
  (0, _createClass3.default)(SyncResultObject, null, [{
    key: "defaults",

    /**
     * Object default values.
     * @type {Object}
     */
    get: function get() {
      return {
        ok: true,
        lastModified: null,
        errors: [],
        created: [],
        updated: [],
        deleted: [],
        published: [],
        conflicts: [],
        skipped: [],
        resolved: []
      };
    }

    /**
     * Public constructor.
     */

  }]);

  function SyncResultObject() {
    (0, _classCallCheck3.default)(this, SyncResultObject);

    /**
     * Current synchronization result status; becomes `false` when conflicts or
     * errors are registered.
     * @type {Boolean}
     */
    this.ok = true;
    (0, _assign2.default)(this, SyncResultObject.defaults);
  }

  /**
   * Adds entries for a given result type.
   *
   * @param {String} type    The result type.
   * @param {Array}  entries The result entries.
   * @return {SyncResultObject}
   */


  (0, _createClass3.default)(SyncResultObject, [{
    key: "add",
    value: function add(type, entries) {
      if (!Array.isArray(this[type])) {
        return;
      }
      if (!Array.isArray(entries)) {
        entries = [entries];
      }
      // Deduplicate entries by id. If the values don't have `id` attribute, just
      // keep all.
      var recordsWithoutId = new _set2.default();
      var recordsById = new _map2.default();
      function addOneRecord(record) {
        if (!record.id) {
          recordsWithoutId.add(record);
        } else {
          recordsById.set(record.id, record);
        }
      }
      this[type].forEach(addOneRecord);
      entries.forEach(addOneRecord);

      this[type] = (0, _from2.default)(recordsById.values()).concat((0, _from2.default)(recordsWithoutId));
      this.ok = this.errors.length + this.conflicts.length === 0;
      return this;
    }

    /**
     * Reinitializes result entries for a given result type.
     *
     * @param  {String} type The result type.
     * @return {SyncResultObject}
     */

  }, {
    key: "reset",
    value: function reset(type) {
      this[type] = SyncResultObject.defaults[type];
      this.ok = this.errors.length + this.conflicts.length === 0;
      return this;
    }
  }]);
  return SyncResultObject;
}();

function createUUIDSchema() {
  return {
    generate: function generate() {
      return (0, _uuid.v4)();
    },
    validate: function validate(id) {
      return typeof id == "string" && _utils.RE_RECORD_ID.test(id);
    }
  };
}

function markStatus(record, status) {
  return (0, _extends3.default)({}, record, { _status: status });
}

function markDeleted(record) {
  return markStatus(record, "deleted");
}

function markSynced(record) {
  return markStatus(record, "synced");
}

/**
 * Import a remote change into the local database.
 *
 * @param  {IDBTransactionProxy} transaction The transaction handler.
 * @param  {Object}              remote      The remote change object to import.
 * @param  {Array<String>}       localFields The list of fields that remain local.
 * @return {Object}
 */
function importChange(transaction, remote, localFields) {
  var local = transaction.get(remote.id);
  if (!local) {
    // Not found locally but remote change is marked as deleted; skip to
    // avoid recreation.
    if (remote.deleted) {
      return { type: "skipped", data: remote };
    }
    var _synced = markSynced(remote);
    transaction.create(_synced);
    return { type: "created", data: _synced };
  }
  // Compare local and remote, ignoring local fields.
  var isIdentical = recordsEqual(local, remote, localFields);
  // Apply remote changes on local record.
  var onlyLocal = {};
  localFields.forEach(function (field) {
    return onlyLocal[field] = local[field];
  });
  var synced = (0, _extends3.default)({}, onlyLocal, markSynced(remote));
  // Detect or ignore conflicts if record has also been modified locally.
  if (local._status !== "synced") {
    // Locally deleted, unsynced: scheduled for remote deletion.
    if (local._status === "deleted") {
      return { type: "skipped", data: local };
    }
    if (isIdentical) {
      // If records are identical, import anyway, so we bump the
      // local last_modified value from the server and set record
      // status to "synced".
      transaction.update(synced);
      return { type: "updated", data: { old: local, new: synced } };
    }
    if (local.last_modified !== undefined && local.last_modified === remote.last_modified) {
      // If our local version has the same last_modified as the remote
      // one, this represents an object that corresponds to a resolved
      // conflict. Our local version represents the final output, so
      // we keep that one. (No transaction operation to do.)
      // But if our last_modified is undefined,
      // that means we've created the same object locally as one on
      // the server, which *must* be a conflict.
      return { type: "void" };
    }
    return {
      type: "conflicts",
      data: { type: "incoming", local: local, remote: remote }
    };
  }
  // Local record was synced.
  if (remote.deleted) {
    transaction.delete(remote.id);
    return { type: "deleted", data: local };
  }
  // Import locally.
  transaction.update(synced);
  // if identical, simply exclude it from all SyncResultObject lists
  var type = isIdentical ? "void" : "updated";
  return { type: type, data: { old: local, new: synced } };
}

/**
 * Abstracts a collection of records stored in the local database, providing
 * CRUD operations and synchronization helpers.
 */

var Collection = function () {
  /**
   * Constructor.
   *
   * Options:
   * - `{BaseAdapter} adapter` The DB adapter (default: `IDB`)
   * - `{String} dbPrefix`     The DB name prefix (default: `""`)
   *
   * @param  {String} bucket  The bucket identifier.
   * @param  {String} name    The collection name.
   * @param  {Api}    api     The Api instance.
   * @param  {Object} options The options object.
   */
  function Collection(bucket, name, api) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    (0, _classCallCheck3.default)(this, Collection);

    this._bucket = bucket;
    this._name = name;
    this._lastModified = null;

    var DBAdapter = options.adapter || _IDB2.default;
    if (!DBAdapter) {
      throw new Error("No adapter provided");
    }
    var dbPrefix = options.dbPrefix || "";
    var db = new DBAdapter("" + dbPrefix + bucket + "/" + name, options.adapterOptions);
    if (!(db instanceof _base2.default)) {
      throw new Error("Unsupported adapter.");
    }
    // public properties
    /**
     * The db adapter instance
     * @type {BaseAdapter}
     */
    this.db = db;
    /**
     * The Api instance.
     * @type {KintoClient}
     */
    this.api = api;
    /**
     * The event emitter instance.
     * @type {EventEmitter}
     */
    this.events = options.events;
    /**
     * The IdSchema instance.
     * @type {Object}
     */
    this.idSchema = this._validateIdSchema(options.idSchema);
    /**
     * The list of remote transformers.
     * @type {Array}
     */
    this.remoteTransformers = this._validateRemoteTransformers(options.remoteTransformers);
    /**
     * The list of hooks.
     * @type {Object}
     */
    this.hooks = this._validateHooks(options.hooks);
    /**
     * The list of fields names that will remain local.
     * @type {Array}
     */
    this.localFields = options.localFields || [];
  }

  /**
   * The collection name.
   * @type {String}
   */


  (0, _createClass3.default)(Collection, [{
    key: "_validateIdSchema",


    /**
     * Validates an idSchema.
     *
     * @param  {Object|undefined} idSchema
     * @return {Object}
     */
    value: function _validateIdSchema(idSchema) {
      if (typeof idSchema === "undefined") {
        return createUUIDSchema();
      }
      if ((typeof idSchema === "undefined" ? "undefined" : (0, _typeof3.default)(idSchema)) !== "object") {
        throw new Error("idSchema must be an object.");
      } else if (typeof idSchema.generate !== "function") {
        throw new Error("idSchema must provide a generate function.");
      } else if (typeof idSchema.validate !== "function") {
        throw new Error("idSchema must provide a validate function.");
      }
      return idSchema;
    }

    /**
     * Validates a list of remote transformers.
     *
     * @param  {Array|undefined} remoteTransformers
     * @return {Array}
     */

  }, {
    key: "_validateRemoteTransformers",
    value: function _validateRemoteTransformers(remoteTransformers) {
      if (typeof remoteTransformers === "undefined") {
        return [];
      }
      if (!Array.isArray(remoteTransformers)) {
        throw new Error("remoteTransformers should be an array.");
      }
      return remoteTransformers.map(function (transformer) {
        if ((typeof transformer === "undefined" ? "undefined" : (0, _typeof3.default)(transformer)) !== "object") {
          throw new Error("A transformer must be an object.");
        } else if (typeof transformer.encode !== "function") {
          throw new Error("A transformer must provide an encode function.");
        } else if (typeof transformer.decode !== "function") {
          throw new Error("A transformer must provide a decode function.");
        }
        return transformer;
      });
    }

    /**
     * Validate the passed hook is correct.
     *
     * @param {Array|undefined} hook.
     * @return {Array}
     **/

  }, {
    key: "_validateHook",
    value: function _validateHook(hook) {
      if (!Array.isArray(hook)) {
        throw new Error("A hook definition should be an array of functions.");
      }
      return hook.map(function (fn) {
        if (typeof fn !== "function") {
          throw new Error("A hook definition should be an array of functions.");
        }
        return fn;
      });
    }

    /**
     * Validates a list of hooks.
     *
     * @param  {Object|undefined} hooks
     * @return {Object}
     */

  }, {
    key: "_validateHooks",
    value: function _validateHooks(hooks) {
      if (typeof hooks === "undefined") {
        return {};
      }
      if (Array.isArray(hooks)) {
        throw new Error("hooks should be an object, not an array.");
      }
      if ((typeof hooks === "undefined" ? "undefined" : (0, _typeof3.default)(hooks)) !== "object") {
        throw new Error("hooks should be an object.");
      }

      var validatedHooks = {};

      for (var hook in hooks) {
        if (!AVAILABLE_HOOKS.includes(hook)) {
          throw new Error("The hook should be one of " + AVAILABLE_HOOKS.join(", "));
        }
        validatedHooks[hook] = this._validateHook(hooks[hook]);
      }
      return validatedHooks;
    }

    /**
     * Deletes every records in the current collection and marks the collection as
     * never synced.
     *
     * @return {Promise}
     */

  }, {
    key: "clear",
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.db.clear();

              case 2:
                _context.next = 4;
                return this.db.saveLastModified(null);

              case 4:
                return _context.abrupt("return", { data: [], permissions: {} });

              case 5:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function clear() {
        return _ref.apply(this, arguments);
      }

      return clear;
    }()

    /**
     * Encodes a record.
     *
     * @param  {String} type   Either "remote" or "local".
     * @param  {Object} record The record object to encode.
     * @return {Promise}
     */

  }, {
    key: "_encodeRecord",
    value: function _encodeRecord(type, record) {
      if (!this[type + "Transformers"].length) {
        return _promise2.default.resolve(record);
      }
      return (0, _utils.waterfall)(this[type + "Transformers"].map(function (transformer) {
        return function (record) {
          return transformer.encode(record);
        };
      }), record);
    }

    /**
     * Decodes a record.
     *
     * @param  {String} type   Either "remote" or "local".
     * @param  {Object} record The record object to decode.
     * @return {Promise}
     */

  }, {
    key: "_decodeRecord",
    value: function _decodeRecord(type, record) {
      if (!this[type + "Transformers"].length) {
        return _promise2.default.resolve(record);
      }
      return (0, _utils.waterfall)(this[type + "Transformers"].reverse().map(function (transformer) {
        return function (record) {
          return transformer.decode(record);
        };
      }), record);
    }

    /**
     * Adds a record to the local database, asserting that none
     * already exist with this ID.
     *
     * Note: If either the `useRecordId` or `synced` options are true, then the
     * record object must contain the id field to be validated. If none of these
     * options are true, an id is generated using the current IdSchema; in this
     * case, the record passed must not have an id.
     *
     * Options:
     * - {Boolean} synced       Sets record status to "synced" (default: `false`).
     * - {Boolean} useRecordId  Forces the `id` field from the record to be used,
     *                          instead of one that is generated automatically
     *                          (default: `false`).
     *
     * @param  {Object} record
     * @param  {Object} options
     * @return {Promise}
     */

  }, {
    key: "create",
    value: function create(record) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { useRecordId: false, synced: false };

      // Validate the record and its ID (if any), even though this
      // validation is also done in the CollectionTransaction method,
      // because we need to pass the ID to preloadIds.
      var reject = function reject(msg) {
        return _promise2.default.reject(new Error(msg));
      };
      if ((typeof record === "undefined" ? "undefined" : (0, _typeof3.default)(record)) !== "object") {
        return reject("Record is not an object.");
      }
      if ((options.synced || options.useRecordId) && !record.hasOwnProperty("id")) {
        return reject("Missing required Id; synced and useRecordId options require one");
      }
      if (!options.synced && !options.useRecordId && record.hasOwnProperty("id")) {
        return reject("Extraneous Id; can't create a record having one set.");
      }
      var newRecord = (0, _extends3.default)({}, record, {
        id: options.synced || options.useRecordId ? record.id : this.idSchema.generate(record),
        _status: options.synced ? "synced" : "created"
      });
      if (!this.idSchema.validate(newRecord.id)) {
        return reject("Invalid Id: " + newRecord.id);
      }
      return this.execute(function (txn) {
        return txn.create(newRecord);
      }, {
        preloadIds: [newRecord.id]
      }).catch(function (err) {
        if (options.useRecordId) {
          throw new Error("Couldn't create record. It may have been virtually deleted.");
        }
        throw err;
      });
    }

    /**
     * Like {@link CollectionTransaction#update}, but wrapped in its own transaction.
     *
     * Options:
     * - {Boolean} synced: Sets record status to "synced" (default: false)
     * - {Boolean} patch:  Extends the existing record instead of overwriting it
     *   (default: false)
     *
     * @param  {Object} record
     * @param  {Object} options
     * @return {Promise}
     */

  }, {
    key: "update",
    value: function update(record) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { synced: false, patch: false };

      // Validate the record and its ID, even though this validation is
      // also done in the CollectionTransaction method, because we need
      // to pass the ID to preloadIds.
      if ((typeof record === "undefined" ? "undefined" : (0, _typeof3.default)(record)) !== "object") {
        return _promise2.default.reject(new Error("Record is not an object."));
      }
      if (!record.hasOwnProperty("id")) {
        return _promise2.default.reject(new Error("Cannot update a record missing id."));
      }
      if (!this.idSchema.validate(record.id)) {
        return _promise2.default.reject(new Error("Invalid Id: " + record.id));
      }

      return this.execute(function (txn) {
        return txn.update(record, options);
      }, {
        preloadIds: [record.id]
      });
    }

    /**
     * Like {@link CollectionTransaction#upsert}, but wrapped in its own transaction.
     *
     * @param  {Object} record
     * @return {Promise}
     */

  }, {
    key: "upsert",
    value: function upsert(record) {
      // Validate the record and its ID, even though this validation is
      // also done in the CollectionTransaction method, because we need
      // to pass the ID to preloadIds.
      if ((typeof record === "undefined" ? "undefined" : (0, _typeof3.default)(record)) !== "object") {
        return _promise2.default.reject(new Error("Record is not an object."));
      }
      if (!record.hasOwnProperty("id")) {
        return _promise2.default.reject(new Error("Cannot update a record missing id."));
      }
      if (!this.idSchema.validate(record.id)) {
        return _promise2.default.reject(new Error("Invalid Id: " + record.id));
      }

      return this.execute(function (txn) {
        return txn.upsert(record);
      }, { preloadIds: [record.id] });
    }

    /**
     * Like {@link CollectionTransaction#get}, but wrapped in its own transaction.
     *
     * Options:
     * - {Boolean} includeDeleted: Include virtually deleted records.
     *
     * @param  {String} id
     * @param  {Object} options
     * @return {Promise}
     */

  }, {
    key: "get",
    value: function get(id) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { includeDeleted: false };

      return this.execute(function (txn) {
        return txn.get(id, options);
      }, { preloadIds: [id] });
    }

    /**
     * Like {@link CollectionTransaction#getAny}, but wrapped in its own transaction.
     *
     * @param  {String} id
     * @return {Promise}
     */

  }, {
    key: "getAny",
    value: function getAny(id) {
      return this.execute(function (txn) {
        return txn.getAny(id);
      }, { preloadIds: [id] });
    }

    /**
     * Same as {@link Collection#delete}, but wrapped in its own transaction.
     *
     * Options:
     * - {Boolean} virtual: When set to `true`, doesn't actually delete the record,
     *   update its `_status` attribute to `deleted` instead (default: true)
     *
     * @param  {String} id       The record's Id.
     * @param  {Object} options  The options object.
     * @return {Promise}
     */

  }, {
    key: "delete",
    value: function _delete(id) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { virtual: true };

      return this.execute(function (transaction) {
        return transaction.delete(id, options);
      }, { preloadIds: [id] });
    }

    /**
     * Same as {@link Collection#deleteAll}, but wrapped in its own transaction, execulding the parameter.
     *
     * @return {Promise}
     */

  }, {
    key: "deleteAll",
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
        var _ref3, data, recordIds;

        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.list({}, { includeDeleted: false });

              case 2:
                _ref3 = _context2.sent;
                data = _ref3.data;
                recordIds = data.map(function (record) {
                  return record.id;
                });
                return _context2.abrupt("return", this.execute(function (transaction) {
                  return transaction.deleteAll(recordIds);
                }, { preloadIds: recordIds }));

              case 6:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function deleteAll() {
        return _ref2.apply(this, arguments);
      }

      return deleteAll;
    }()

    /**
     * The same as {@link CollectionTransaction#deleteAny}, but wrapped
     * in its own transaction.
     *
     * @param  {String} id       The record's Id.
     * @return {Promise}
     */

  }, {
    key: "deleteAny",
    value: function deleteAny(id) {
      return this.execute(function (txn) {
        return txn.deleteAny(id);
      }, { preloadIds: [id] });
    }

    /**
     * Lists records from the local database.
     *
     * Params:
     * - {Object} filters Filter the results (default: `{}`).
     * - {String} order   The order to apply   (default: `-last_modified`).
     *
     * Options:
     * - {Boolean} includeDeleted: Include virtually deleted records.
     *
     * @param  {Object} params  The filters and order to apply to the results.
     * @param  {Object} options The options object.
     * @return {Promise}
     */

  }, {
    key: "list",
    value: function () {
      var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
        var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { includeDeleted: false };
        var results, data;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                params = (0, _extends3.default)({ order: "-last_modified", filters: {} }, params);
                _context3.next = 3;
                return this.db.list(params);

              case 3:
                results = _context3.sent;
                data = results;

                if (!options.includeDeleted) {
                  data = results.filter(function (record) {
                    return record._status !== "deleted";
                  });
                }
                return _context3.abrupt("return", { data: data, permissions: {} });

              case 7:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function list() {
        return _ref4.apply(this, arguments);
      }

      return list;
    }()

    /**
     * Imports remote changes into the local database.
     * This method is in charge of detecting the conflicts, and resolve them
     * according to the specified strategy.
     * @param  {SyncResultObject} syncResultObject The sync result object.
     * @param  {Array}            decodedChanges   The list of changes to import in the local database.
     * @param  {String}           strategy         The {@link Collection.strategy} (default: MANUAL)
     * @return {Promise}
     */

  }, {
    key: "importChanges",
    value: function () {
      var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(syncResultObject, decodedChanges) {
        var _this = this;

        var strategy = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Collection.strategy.MANUAL;

        var _ref6, imports, resolved, data;

        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.prev = 0;
                _context4.next = 3;
                return this.db.execute(function (transaction) {
                  var imports = decodedChanges.map(function (remote) {
                    // Store remote change into local database.
                    return importChange(transaction, remote, _this.localFields);
                  });
                  var conflicts = imports.filter(function (i) {
                    return i.type === "conflicts";
                  }).map(function (i) {
                    return i.data;
                  });
                  var resolved = _this._handleConflicts(transaction, conflicts, strategy);
                  return { imports: imports, resolved: resolved };
                }, { preload: decodedChanges.map(function (record) {
                    return record.id;
                  }) });

              case 3:
                _ref6 = _context4.sent;
                imports = _ref6.imports;
                resolved = _ref6.resolved;


                // Lists of created/updated/deleted records
                imports.forEach(function (_ref7) {
                  var type = _ref7.type,
                      data = _ref7.data;
                  return syncResultObject.add(type, data);
                });

                // Automatically resolved conflicts (if not manual)
                if (resolved.length > 0) {
                  syncResultObject.reset("conflicts").add("resolved", resolved);
                }
                _context4.next = 14;
                break;

              case 10:
                _context4.prev = 10;
                _context4.t0 = _context4["catch"](0);
                data = {
                  type: "incoming",
                  message: _context4.t0.message,
                  stack: _context4.t0.stack
                };
                // XXX one error of the whole transaction instead of per atomic op

                syncResultObject.add("errors", data);

              case 14:
                return _context4.abrupt("return", syncResultObject);

              case 15:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[0, 10]]);
      }));

      function importChanges(_x9, _x10) {
        return _ref5.apply(this, arguments);
      }

      return importChanges;
    }()

    /**
     * Imports the responses of pushed changes into the local database.
     * Basically it stores the timestamp assigned by the server into the local
     * database.
     * @param  {SyncResultObject} syncResultObject The sync result object.
     * @param  {Array}            toApplyLocally   The list of changes to import in the local database.
     * @param  {Array}            conflicts        The list of conflicts that have to be resolved.
     * @param  {String}           strategy         The {@link Collection.strategy}.
     * @return {Promise}
     */

  }, {
    key: "_applyPushedResults",
    value: function () {
      var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(syncResultObject, toApplyLocally, conflicts) {
        var _this2 = this;

        var strategy = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : Collection.strategy.MANUAL;

        var toDeleteLocally, toUpdateLocally, _ref9, published, resolved;

        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                toDeleteLocally = toApplyLocally.filter(function (r) {
                  return r.deleted;
                });
                toUpdateLocally = toApplyLocally.filter(function (r) {
                  return !r.deleted;
                });
                _context5.next = 4;
                return this.db.execute(function (transaction) {
                  var updated = toUpdateLocally.map(function (record) {
                    var synced = markSynced(record);
                    transaction.update(synced);
                    return synced;
                  });
                  var deleted = toDeleteLocally.map(function (record) {
                    transaction.delete(record.id);
                    // Amend result data with the deleted attribute set
                    return { id: record.id, deleted: true };
                  });
                  var published = updated.concat(deleted);
                  // Handle conflicts, if any
                  var resolved = _this2._handleConflicts(transaction, conflicts, strategy);
                  return { published: published, resolved: resolved };
                });

              case 4:
                _ref9 = _context5.sent;
                published = _ref9.published;
                resolved = _ref9.resolved;


                syncResultObject.add("published", published);

                if (resolved.length > 0) {
                  syncResultObject.reset("conflicts").reset("resolved").add("resolved", resolved);
                }
                return _context5.abrupt("return", syncResultObject);

              case 10:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function _applyPushedResults(_x12, _x13, _x14) {
        return _ref8.apply(this, arguments);
      }

      return _applyPushedResults;
    }()

    /**
     * Handles synchronization conflicts according to specified strategy.
     *
     * @param  {SyncResultObject} result    The sync result object.
     * @param  {String}           strategy  The {@link Collection.strategy}.
     * @return {Promise<Array<Object>>} The resolved conflicts, as an
     *    array of {accepted, rejected} objects
     */

  }, {
    key: "_handleConflicts",
    value: function _handleConflicts(transaction, conflicts, strategy) {
      var _this3 = this;

      if (strategy === Collection.strategy.MANUAL) {
        return [];
      }
      return conflicts.map(function (conflict) {
        var resolution = strategy === Collection.strategy.CLIENT_WINS ? conflict.local : conflict.remote;
        var rejected = strategy === Collection.strategy.CLIENT_WINS ? conflict.remote : conflict.local;
        var accepted = void 0,
            status = void 0,
            id = void 0;
        if (resolution === null) {
          // We "resolved" with the server-side deletion. Delete locally.
          // This only happens during SERVER_WINS because the local
          // version of a record can never be null.
          // We can get "null" from the remote side if we got a conflict
          // and there is no remote version available; see kinto-http.js
          // batch.js:aggregate.
          transaction.delete(conflict.local.id);
          accepted = null;
          // The record was deleted, but that status is "synced" with
          // the server, so we don't need to push the change.
          status = "synced";
          id = conflict.local.id;
        } else {
          var updated = _this3._resolveRaw(conflict, resolution);
          transaction.update(updated);
          accepted = updated;
          status = updated._status;
          id = updated.id;
        }
        return { rejected: rejected, accepted: accepted, id: id, _status: status };
      });
    }

    /**
     * Execute a bunch of operations in a transaction.
     *
     * This transaction should be atomic -- either all of its operations
     * will succeed, or none will.
     *
     * The argument to this function is itself a function which will be
     * called with a {@link CollectionTransaction}. Collection methods
     * are available on this transaction, but instead of returning
     * promises, they are synchronous. execute() returns a Promise whose
     * value will be the return value of the provided function.
     *
     * Most operations will require access to the record itself, which
     * must be preloaded by passing its ID in the preloadIds option.
     *
     * Options:
     * - {Array} preloadIds: list of IDs to fetch at the beginning of
     *   the transaction
     *
     * @return {Promise} Resolves with the result of the given function
     *    when the transaction commits.
     */

  }, {
    key: "execute",
    value: function execute(doOperations) {
      var _this4 = this;

      var _ref10 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          _ref10$preloadIds = _ref10.preloadIds,
          preloadIds = _ref10$preloadIds === undefined ? [] : _ref10$preloadIds;

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = (0, _getIterator3.default)(preloadIds), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var id = _step.value;

          if (!this.idSchema.validate(id)) {
            return _promise2.default.reject(Error("Invalid Id: " + id));
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return this.db.execute(function (transaction) {
        var txn = new CollectionTransaction(_this4, transaction);
        var result = doOperations(txn);
        txn.emitEvents();
        return result;
      }, { preload: preloadIds });
    }

    /**
     * Resets the local records as if they were never synced; existing records are
     * marked as newly created, deleted records are dropped.
     *
     * A next call to {@link Collection.sync} will thus republish the whole
     * content of the local collection to the server.
     *
     * @return {Promise} Resolves with the number of processed records.
     */

  }, {
    key: "resetSyncStatus",
    value: function () {
      var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6() {
        var unsynced;
        return _regenerator2.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this.list({ filters: { _status: ["deleted", "synced"] }, order: "" }, { includeDeleted: true });

              case 2:
                unsynced = _context6.sent;
                _context6.next = 5;
                return this.db.execute(function (transaction) {
                  unsynced.data.forEach(function (record) {
                    if (record._status === "deleted") {
                      // Garbage collect deleted records.
                      transaction.delete(record.id);
                    } else {
                      // Records that were synced become «created».
                      transaction.update((0, _extends3.default)({}, record, {
                        last_modified: undefined,
                        _status: "created"
                      }));
                    }
                  });
                });

              case 5:
                this._lastModified = null;
                _context6.next = 8;
                return this.db.saveLastModified(null);

              case 8:
                return _context6.abrupt("return", unsynced.data.length);

              case 9:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function resetSyncStatus() {
        return _ref11.apply(this, arguments);
      }

      return resetSyncStatus;
    }()

    /**
     * Returns an object containing two lists:
     *
     * - `toDelete`: unsynced deleted records we can safely delete;
     * - `toSync`: local updates to send to the server.
     *
     * @return {Promise}
     */

  }, {
    key: "gatherLocalChanges",
    value: function () {
      var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
        var unsynced, deleted;
        return _regenerator2.default.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.list({
                  filters: { _status: ["created", "updated"] },
                  order: ""
                });

              case 2:
                unsynced = _context7.sent;
                _context7.next = 5;
                return this.list({ filters: { _status: "deleted" }, order: "" }, { includeDeleted: true });

              case 5:
                deleted = _context7.sent;
                _context7.next = 8;
                return _promise2.default.all(unsynced.data.concat(deleted.data).map(this._encodeRecord.bind(this, "remote")));

              case 8:
                return _context7.abrupt("return", _context7.sent);

              case 9:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function gatherLocalChanges() {
        return _ref12.apply(this, arguments);
      }

      return gatherLocalChanges;
    }()

    /**
     * Fetch remote changes, import them to the local database, and handle
     * conflicts according to `options.strategy`. Then, updates the passed
     * {@link SyncResultObject} with import results.
     *
     * Options:
     * - {String} strategy: The selected sync strategy.
     *
     * @param  {KintoClient.Collection} client           Kinto client Collection instance.
     * @param  {SyncResultObject}       syncResultObject The sync result object.
     * @param  {Object}                 options
     * @return {Promise}
     */

  }, {
    key: "pullChanges",
    value: function () {
      var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(client, syncResultObject) {
        var _this5 = this;

        var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

        var since, filters, data, last_modified, exclude_id, response, _response, unquoted, localSynced, serverChanged, emptyCollection, decodedChanges, payload, afterHooks;

        return _regenerator2.default.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                if (syncResultObject.ok) {
                  _context8.next = 2;
                  break;
                }

                return _context8.abrupt("return", syncResultObject);

              case 2:
                if (!this.lastModified) {
                  _context8.next = 6;
                  break;
                }

                _context8.t0 = this.lastModified;
                _context8.next = 9;
                break;

              case 6:
                _context8.next = 8;
                return this.db.getLastModified();

              case 8:
                _context8.t0 = _context8.sent;

              case 9:
                since = _context8.t0;


                options = (0, _extends3.default)({
                  strategy: Collection.strategy.MANUAL,
                  lastModified: since,
                  headers: {}
                }, options);

                // Optionally ignore some records when pulling for changes.
                // (avoid redownloading our own changes on last step of #sync())
                filters = void 0;
                data = void 0;
                last_modified = void 0;

                if (!options.exclude) {
                  _context8.next = 24;
                  break;
                }

                // Limit the list of excluded records to the first 50 records in order
                // to remain under de-facto URL size limit (~2000 chars).
                // http://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers/417184#417184
                exclude_id = options.exclude.map(function (r) {
                  return r.id;
                }).join(",");

                filters = { exclude_id: exclude_id };

                _context8.next = 19;
                return client.batch(function (batch) {
                  batch.listRecords({
                    since: options.lastModified ? "" + options.lastModified : undefined,
                    pages: Infinity,
                    filters: filters
                  });
                }, {
                  headers: options.headers,
                  retry: options.retry
                });

              case 19:
                response = _context8.sent[0];


                data = response.body.data;
                last_modified = response.headers['ETag'].replace(/"/g, "");

                _context8.next = 29;
                break;

              case 24:
                _context8.next = 26;
                return client.listRecords({
                  // Since should be ETag (see https://github.com/Kinto/kinto.js/issues/356)
                  since: options.lastModified ? "" + options.lastModified : undefined,
                  headers: options.headers,
                  retry: options.retry,
                  // Fetch every page by default (FIXME: option to limit pages, see #277)
                  pages: Infinity
                });

              case 26:
                _response = _context8.sent;

                data = _response.data;
                last_modified = _response.last_modified;

              case 29:
                // last_modified is the ETag header value (string).
                // For retro-compatibility with first kinto.js versions
                // parse it to integer.
                unquoted = last_modified ? parseInt(last_modified, 10) : undefined;

                // Check if server was flushed.
                // This is relevant for the Kinto demo server
                // (and thus for many new comers).

                localSynced = options.lastModified;
                serverChanged = unquoted > options.lastModified;
                emptyCollection = data.length === 0;

                if (!(!options.exclude && localSynced && serverChanged && emptyCollection)) {
                  _context8.next = 35;
                  break;
                }

                throw Error("Server has been flushed.");

              case 35:

                syncResultObject.lastModified = unquoted;

                // Decode incoming changes.
                _context8.next = 38;
                return _promise2.default.all(data.map(function (change) {
                  return _this5._decodeRecord("remote", change);
                }));

              case 38:
                decodedChanges = _context8.sent;

                // Hook receives decoded records.
                payload = { lastModified: unquoted, changes: decodedChanges };
                _context8.next = 42;
                return this.applyHook("incoming-changes", payload);

              case 42:
                afterHooks = _context8.sent;

                if (!(afterHooks.changes.length > 0)) {
                  _context8.next = 46;
                  break;
                }

                _context8.next = 46;
                return this.importChanges(syncResultObject, afterHooks.changes, options.strategy);

              case 46:
                return _context8.abrupt("return", syncResultObject);

              case 47:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function pullChanges(_x17, _x18) {
        return _ref13.apply(this, arguments);
      }

      return pullChanges;
    }()
  }, {
    key: "applyHook",
    value: function applyHook(hookName, payload) {
      var _this6 = this;

      if (typeof this.hooks[hookName] == "undefined") {
        return _promise2.default.resolve(payload);
      }
      return (0, _utils.waterfall)(this.hooks[hookName].map(function (hook) {
        return function (record) {
          var result = hook(payload, _this6);
          var resultThenable = result && typeof result.then === "function";
          var resultChanges = result && result.hasOwnProperty("changes");
          if (!(resultThenable || resultChanges)) {
            throw new Error("Invalid return value for hook: " + (0, _stringify2.default)(result) + " has no 'then()' or 'changes' properties");
          }
          return result;
        };
      }), payload);
    }

    /**
     * Publish local changes to the remote server and updates the passed
     * {@link SyncResultObject} with publication results.
     *
     * @param  {KintoClient.Collection} client           Kinto client Collection instance.
     * @param  {SyncResultObject}       syncResultObject The sync result object.
     * @param  {Object}                 changes          The change object.
     * @param  {Array}                  changes.toDelete The list of records to delete.
     * @param  {Array}                  changes.toSync   The list of records to create/update.
     * @param  {Object}                 options          The options object.
     * @return {Promise}
     */

  }, {
    key: "pushChanges",
    value: function () {
      var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(client, changes, syncResultObject) {
        var _this7 = this;

        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

        var safe, toDelete, toSync, synced, conflicts, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _ref16, type, local, remote, safeLocal, realLocal, realRemote, conflict, missingRemotely, published, toApplyLocally, decoded;

        return _regenerator2.default.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                if (syncResultObject.ok) {
                  _context9.next = 2;
                  break;
                }

                return _context9.abrupt("return", syncResultObject);

              case 2:
                safe = !options.strategy || options.strategy !== Collection.CLIENT_WINS;
                toDelete = changes.filter(function (r) {
                  return r._status == "deleted";
                });
                toSync = changes.filter(function (r) {
                  return r._status != "deleted";
                });

                // Perform a batch request with every changes.

                _context9.next = 7;
                return client.batch(function (batch) {
                  toDelete.forEach(function (r) {
                    // never published locally deleted records should not be pusblished
                    if (r.last_modified) {
                      batch.deleteRecord(r);
                    }
                  });
                  toSync.forEach(function (r) {
                    // Clean local fields (like _status) before sending to server.
                    var published = _this7.cleanLocalFields(r);
                    if (r._status === "created") {
                      batch.createRecord(published);
                    } else {
                      batch.updateRecord(published);
                    }
                  });
                }, {
                  headers: options.headers,
                  retry: options.retry,
                  safe: safe,
                  aggregate: true
                });

              case 7:
                synced = _context9.sent;


                // Store outgoing errors into sync result object
                syncResultObject.add("errors", synced.errors.map(function (e) {
                  return (0, _extends3.default)({}, e, { type: "outgoing" });
                }));

                // Store outgoing conflicts into sync result object
                conflicts = [];
                _iteratorNormalCompletion2 = true;
                _didIteratorError2 = false;
                _iteratorError2 = undefined;
                _context9.prev = 13;
                _iterator2 = (0, _getIterator3.default)(synced.conflicts);

              case 15:
                if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                  _context9.next = 33;
                  break;
                }

                _ref16 = _step2.value;
                type = _ref16.type, local = _ref16.local, remote = _ref16.remote;

                // Note: we ensure that local data are actually available, as they may
                // be missing in the case of a published deletion.
                safeLocal = local && local.data || { id: remote.id };
                _context9.next = 21;
                return this._decodeRecord("remote", safeLocal);

              case 21:
                realLocal = _context9.sent;
                _context9.t0 = remote;

                if (!_context9.t0) {
                  _context9.next = 27;
                  break;
                }

                _context9.next = 26;
                return this._decodeRecord("remote", remote);

              case 26:
                _context9.t0 = _context9.sent;

              case 27:
                realRemote = _context9.t0;
                conflict = { type: type, local: realLocal, remote: realRemote };

                conflicts.push(conflict);

              case 30:
                _iteratorNormalCompletion2 = true;
                _context9.next = 15;
                break;

              case 33:
                _context9.next = 39;
                break;

              case 35:
                _context9.prev = 35;
                _context9.t1 = _context9["catch"](13);
                _didIteratorError2 = true;
                _iteratorError2 = _context9.t1;

              case 39:
                _context9.prev = 39;
                _context9.prev = 40;

                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }

              case 42:
                _context9.prev = 42;

                if (!_didIteratorError2) {
                  _context9.next = 45;
                  break;
                }

                throw _iteratorError2;

              case 45:
                return _context9.finish(42);

              case 46:
                return _context9.finish(39);

              case 47:
                syncResultObject.add("conflicts", conflicts);

                // Records that must be deleted are either deletions that were pushed
                // to server (published) or deleted records that were never pushed (skipped).
                missingRemotely = synced.skipped.map(function (r) {
                  return (0, _extends3.default)({}, r, { deleted: true });
                });

                // For created and updated records, the last_modified coming from server
                // will be stored locally.
                // Reflect publication results locally using the response from
                // the batch request.

                published = synced.published.map(function (c) {
                  return c.data;
                });
                toApplyLocally = published.concat(missingRemotely);

                // Apply the decode transformers, if any

                _context9.next = 53;
                return _promise2.default.all(toApplyLocally.map(function (record) {
                  return _this7._decodeRecord("remote", record);
                }));

              case 53:
                decoded = _context9.sent;

                if (!(decoded.length > 0 || conflicts.length > 0)) {
                  _context9.next = 57;
                  break;
                }

                _context9.next = 57;
                return this._applyPushedResults(syncResultObject, decoded, conflicts, options.strategy);

              case 57:
                return _context9.abrupt("return", syncResultObject);

              case 58:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this, [[13, 35, 39, 47], [40,, 42, 46]]);
      }));

      function pushChanges(_x20, _x21, _x22) {
        return _ref14.apply(this, arguments);
      }

      return pushChanges;
    }()

    /**
     * Return a copy of the specified record without the local fields.
     *
     * @param  {Object} record  A record with potential local fields.
     * @return {Object}
     */

  }, {
    key: "cleanLocalFields",
    value: function cleanLocalFields(record) {
      var localKeys = RECORD_FIELDS_TO_CLEAN.concat(this.localFields);
      return (0, _utils.omitKeys)(record, localKeys);
    }

    /**
     * Resolves a conflict, updating local record according to proposed
     * resolution — keeping remote record `last_modified` value as a reference for
     * further batch sending.
     *
     * @param  {Object} conflict   The conflict object.
     * @param  {Object} resolution The proposed record.
     * @return {Promise}
     */

  }, {
    key: "resolve",
    value: function resolve(conflict, resolution) {
      var _this8 = this;

      return this.db.execute(function (transaction) {
        var updated = _this8._resolveRaw(conflict, resolution);
        transaction.update(updated);
        return { data: updated, permissions: {} };
      });
    }

    /**
     * @private
     */

  }, {
    key: "_resolveRaw",
    value: function _resolveRaw(conflict, resolution) {
      var resolved = (0, _extends3.default)({}, resolution, {
        // Ensure local record has the latest authoritative timestamp
        last_modified: conflict.remote && conflict.remote.last_modified
      });
      // If the resolution object is strictly equal to the
      // remote record, then we can mark it as synced locally.
      // Otherwise, mark it as updated (so that the resolution is pushed).
      var synced = (0, _utils.deepEqual)(resolved, conflict.remote);
      return markStatus(resolved, synced ? "synced" : "updated");
    }

    /**
     * Synchronize remote and local data. The promise will resolve with a
     * {@link SyncResultObject}, though will reject:
     *
     * - if the server is currently backed off;
     * - if the server has been detected flushed.
     *
     * Options:
     * - {Object} headers: HTTP headers to attach to outgoing requests.
     * - {Number} retry: Number of retries when server fails to process the request (default: 1).
     * - {Collection.strategy} strategy: See {@link Collection.strategy}.
     * - {Boolean} ignoreBackoff: Force synchronization even if server is currently
     *   backed off.
     * - {String} bucket: The remove bucket id to use (default: null)
     * - {String} collection: The remove collection id to use (default: null)
     * - {String} remote The remote Kinto server endpoint to use (default: null).
     *
     * @param  {Object} options Options.
     * @return {Promise}
     * @throws {Error} If an invalid remote option is passed.
     */

  }, {
    key: "sync",
    value: function () {
      var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10() {
        var _this9 = this;

        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
          strategy: Collection.strategy.MANUAL,
          headers: {},
          retry: 1,
          ignoreBackoff: false,
          bucket: null,
          collection: null,
          remote: null
        };
        var previousRemote, seconds, client, result, lastModified, toSync, resolvedUnsynced, resolvedEncoded, pullOpts;
        return _regenerator2.default.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                options = (0, _extends3.default)({}, options, {
                  bucket: options.bucket || this.bucket,
                  collection: options.collection || this.name
                });

                previousRemote = this.api.remote;

                if (options.remote) {
                  // Note: setting the remote ensures it's valid, throws when invalid.
                  this.api.remote = options.remote;
                }

                if (!(!options.ignoreBackoff && this.api.backoff > 0)) {
                  _context10.next = 6;
                  break;
                }

                seconds = Math.ceil(this.api.backoff / 1000);
                return _context10.abrupt("return", _promise2.default.reject(new Error("Server is asking clients to back off; retry in " + seconds + "s or use the ignoreBackoff option.")));

              case 6:
                client = this.api.bucket(options.bucket).collection(options.collection);
                result = new SyncResultObject();
                _context10.prev = 8;
                _context10.next = 11;
                return this.pullChanges(client, result, options);

              case 11:
                lastModified = result.lastModified;

                // Fetch local changes

                _context10.next = 14;
                return this.gatherLocalChanges();

              case 14:
                toSync = _context10.sent;
                _context10.next = 17;
                return this.pushChanges(client, toSync, result, options);

              case 17:

                // Publish local resolution of push conflicts to server (on CLIENT_WINS)
                resolvedUnsynced = result.resolved.filter(function (r) {
                  return r._status !== "synced";
                });

                if (!(resolvedUnsynced.length > 0)) {
                  _context10.next = 24;
                  break;
                }

                _context10.next = 21;
                return _promise2.default.all(resolvedUnsynced.map(function (resolution) {
                  var record = resolution.accepted;
                  if (record === null) {
                    record = { id: resolution.id, _status: resolution._status };
                  }
                  return _this9._encodeRecord("remote", record);
                }));

              case 21:
                resolvedEncoded = _context10.sent;
                _context10.next = 24;
                return this.pushChanges(client, resolvedEncoded, result, options);

              case 24:
                if (!(result.published.length > 0)) {
                  _context10.next = 28;
                  break;
                }

                // Avoid redownloading our own changes during the last pull.
                pullOpts = (0, _extends3.default)({}, options, {
                  lastModified: lastModified,
                  exclude: result.published
                });
                _context10.next = 28;
                return this.pullChanges(client, result, pullOpts);

              case 28:
                if (!result.ok) {
                  _context10.next = 32;
                  break;
                }

                _context10.next = 31;
                return this.db.saveLastModified(result.lastModified);

              case 31:
                this._lastModified = _context10.sent;

              case 32:
                _context10.next = 38;
                break;

              case 34:
                _context10.prev = 34;
                _context10.t0 = _context10["catch"](8);

                this.events.emit("sync:error", (0, _extends3.default)({}, options, { error: _context10.t0 }));
                throw _context10.t0;

              case 38:
                _context10.prev = 38;

                // Ensure API default remote is reverted if a custom one's been used
                this.api.remote = previousRemote;
                return _context10.finish(38);

              case 41:
                this.events.emit("sync:success", (0, _extends3.default)({}, options, { result: result }));
                return _context10.abrupt("return", result);

              case 43:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this, [[8, 34, 38, 41]]);
      }));

      function sync() {
        return _ref17.apply(this, arguments);
      }

      return sync;
    }()

    /**
     * Load a list of records already synced with the remote server.
     *
     * The local records which are unsynced or whose timestamp is either missing
     * or superior to those being loaded will be ignored.
     *
     * @param  {Array} records The previously exported list of records to load.
     * @return {Promise} with the effectively imported records.
     */

  }, {
    key: "loadDump",
    value: function () {
      var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(records) {
        var _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, record, _ref19, data, existingById, newRecords;

        return _regenerator2.default.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                if (Array.isArray(records)) {
                  _context11.next = 2;
                  break;
                }

                throw new Error("Records is not an array.");

              case 2:
                _iteratorNormalCompletion3 = true;
                _didIteratorError3 = false;
                _iteratorError3 = undefined;
                _context11.prev = 5;
                _iterator3 = (0, _getIterator3.default)(records);

              case 7:
                if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
                  _context11.next = 16;
                  break;
                }

                record = _step3.value;

                if (!(!record.hasOwnProperty("id") || !this.idSchema.validate(record.id))) {
                  _context11.next = 11;
                  break;
                }

                throw new Error("Record has invalid ID: " + (0, _stringify2.default)(record));

              case 11:
                if (record.last_modified) {
                  _context11.next = 13;
                  break;
                }

                throw new Error("Record has no last_modified value: " + (0, _stringify2.default)(record));

              case 13:
                _iteratorNormalCompletion3 = true;
                _context11.next = 7;
                break;

              case 16:
                _context11.next = 22;
                break;

              case 18:
                _context11.prev = 18;
                _context11.t0 = _context11["catch"](5);
                _didIteratorError3 = true;
                _iteratorError3 = _context11.t0;

              case 22:
                _context11.prev = 22;
                _context11.prev = 23;

                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }

              case 25:
                _context11.prev = 25;

                if (!_didIteratorError3) {
                  _context11.next = 28;
                  break;
                }

                throw _iteratorError3;

              case 28:
                return _context11.finish(25);

              case 29:
                return _context11.finish(22);

              case 30:
                _context11.next = 32;
                return this.list({}, { includeDeleted: true });

              case 32:
                _ref19 = _context11.sent;
                data = _ref19.data;
                existingById = data.reduce(function (acc, record) {
                  acc[record.id] = record;
                  return acc;
                }, {});
                newRecords = records.filter(function (record) {
                  var localRecord = existingById[record.id];
                  var shouldKeep =
                  // No local record with this id.
                  localRecord === undefined ||
                  // Or local record is synced
                  localRecord._status === "synced" &&
                  // And was synced from server
                  localRecord.last_modified !== undefined &&
                  // And is older than imported one.
                  record.last_modified > localRecord.last_modified;
                  return shouldKeep;
                });
                _context11.next = 38;
                return this.db.loadDump(newRecords.map(markSynced));

              case 38:
                return _context11.abrupt("return", _context11.sent);

              case 39:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this, [[5, 18, 22, 30], [23,, 25, 29]]);
      }));

      function loadDump(_x25) {
        return _ref18.apply(this, arguments);
      }

      return loadDump;
    }()
  }, {
    key: "name",
    get: function get() {
      return this._name;
    }

    /**
     * The bucket name.
     * @type {String}
     */

  }, {
    key: "bucket",
    get: function get() {
      return this._bucket;
    }

    /**
     * The last modified timestamp.
     * @type {Number}
     */

  }, {
    key: "lastModified",
    get: function get() {
      return this._lastModified;
    }

    /**
     * Synchronization strategies. Available strategies are:
     *
     * - `MANUAL`: Conflicts will be reported in a dedicated array.
     * - `SERVER_WINS`: Conflicts are resolved using remote data.
     * - `CLIENT_WINS`: Conflicts are resolved using local data.
     *
     * @type {Object}
     */

  }], [{
    key: "strategy",
    get: function get() {
      return {
        CLIENT_WINS: "client_wins",
        SERVER_WINS: "server_wins",
        MANUAL: "manual"
      };
    }
  }]);
  return Collection;
}();

/**
 * A Collection-oriented wrapper for an adapter's transaction.
 *
 * This defines the high-level functions available on a collection.
 * The collection itself offers functions of the same name. These will
 * perform just one operation in its own transaction.
 */


exports.default = Collection;

var CollectionTransaction = exports.CollectionTransaction = function () {
  function CollectionTransaction(collection, adapterTransaction) {
    (0, _classCallCheck3.default)(this, CollectionTransaction);

    this.collection = collection;
    this.adapterTransaction = adapterTransaction;

    this._events = [];
  }

  (0, _createClass3.default)(CollectionTransaction, [{
    key: "_queueEvent",
    value: function _queueEvent(action, payload) {
      this._events.push({ action: action, payload: payload });
    }

    /**
     * Emit queued events, to be called once every transaction operations have
     * been executed successfully.
     */

  }, {
    key: "emitEvents",
    value: function emitEvents() {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = (0, _getIterator3.default)(this._events), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var _ref22 = _step4.value;
          var action = _ref22.action,
              payload = _ref22.payload;

          this.collection.events.emit(action, payload);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      if (this._events.length > 0) {
        var targets = this._events.map(function (_ref21) {
          var action = _ref21.action,
              payload = _ref21.payload;
          return (0, _extends3.default)({
            action: action
          }, payload);
        });
        this.collection.events.emit("change", { targets: targets });
      }
      this._events = [];
    }

    /**
     * Retrieve a record by its id from the local database, or
     * undefined if none exists.
     *
     * This will also return virtually deleted records.
     *
     * @param  {String} id
     * @return {Object}
     */

  }, {
    key: "getAny",
    value: function getAny(id) {
      var record = this.adapterTransaction.get(id);
      return { data: record, permissions: {} };
    }

    /**
     * Retrieve a record by its id from the local database.
     *
     * Options:
     * - {Boolean} includeDeleted: Include virtually deleted records.
     *
     * @param  {String} id
     * @param  {Object} options
     * @return {Object}
     */

  }, {
    key: "get",
    value: function get(id) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { includeDeleted: false };

      var res = this.getAny(id);
      if (!res.data || !options.includeDeleted && res.data._status === "deleted") {
        throw new Error("Record with id=" + id + " not found.");
      }

      return res;
    }

    /**
     * Deletes a record from the local database.
     *
     * Options:
     * - {Boolean} virtual: When set to `true`, doesn't actually delete the record,
     *   update its `_status` attribute to `deleted` instead (default: true)
     *
     * @param  {String} id       The record's Id.
     * @param  {Object} options  The options object.
     * @return {Object}
     */

  }, {
    key: "delete",
    value: function _delete(id) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { virtual: true };

      // Ensure the record actually exists.
      var existing = this.adapterTransaction.get(id);
      var alreadyDeleted = existing && existing._status == "deleted";
      if (!existing || alreadyDeleted && options.virtual) {
        throw new Error("Record with id=" + id + " not found.");
      }
      // Virtual updates status.
      if (options.virtual) {
        this.adapterTransaction.update(markDeleted(existing));
      } else {
        // Delete for real.
        this.adapterTransaction.delete(id);
      }
      this._queueEvent("delete", { data: existing });
      return { data: existing, permissions: {} };
    }

    /**
     * Soft delete all records from the local database.
     *
     * @param  {Array} ids        Array of non-deleted Record Ids.
     * @return {Object}
     */

  }, {
    key: "deleteAll",
    value: function deleteAll(ids) {
      var _this10 = this;

      var existingRecords = [];
      ids.forEach(function (id) {
        existingRecords.push(_this10.adapterTransaction.get(id));
        _this10.delete(id);
      });

      this._queueEvent("deleteAll", { data: existingRecords });
      return { data: existingRecords, permissions: {} };
    }

    /**
     * Deletes a record from the local database, if any exists.
     * Otherwise, do nothing.
     *
     * @param  {String} id       The record's Id.
     * @return {Object}
     */

  }, {
    key: "deleteAny",
    value: function deleteAny(id) {
      var existing = this.adapterTransaction.get(id);
      if (existing) {
        this.adapterTransaction.update(markDeleted(existing));
        this._queueEvent("delete", { data: existing });
      }
      return { data: (0, _extends3.default)({ id: id }, existing), deleted: !!existing, permissions: {} };
    }

    /**
     * Adds a record to the local database, asserting that none
     * already exist with this ID.
     *
     * @param  {Object} record, which must contain an ID
     * @return {Object}
     */

  }, {
    key: "create",
    value: function create(record) {
      if ((typeof record === "undefined" ? "undefined" : (0, _typeof3.default)(record)) !== "object") {
        throw new Error("Record is not an object.");
      }
      if (!record.hasOwnProperty("id")) {
        throw new Error("Cannot create a record missing id");
      }
      if (!this.collection.idSchema.validate(record.id)) {
        throw new Error("Invalid Id: " + record.id);
      }

      this.adapterTransaction.create(record);
      this._queueEvent("create", { data: record });
      return { data: record, permissions: {} };
    }

    /**
     * Updates a record from the local database.
     *
     * Options:
     * - {Boolean} synced: Sets record status to "synced" (default: false)
     * - {Boolean} patch:  Extends the existing record instead of overwriting it
     *   (default: false)
     *
     * @param  {Object} record
     * @param  {Object} options
     * @return {Object}
     */

  }, {
    key: "update",
    value: function update(record) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { synced: false, patch: false };

      if ((typeof record === "undefined" ? "undefined" : (0, _typeof3.default)(record)) !== "object") {
        throw new Error("Record is not an object.");
      }
      if (!record.hasOwnProperty("id")) {
        throw new Error("Cannot update a record missing id.");
      }
      if (!this.collection.idSchema.validate(record.id)) {
        throw new Error("Invalid Id: " + record.id);
      }

      var oldRecord = this.adapterTransaction.get(record.id);
      if (!oldRecord) {
        throw new Error("Record with id=" + record.id + " not found.");
      }
      var newRecord = options.patch ? (0, _extends3.default)({}, oldRecord, record) : record;
      var updated = this._updateRaw(oldRecord, newRecord, options);
      this.adapterTransaction.update(updated);
      this._queueEvent("update", { data: updated, oldRecord: oldRecord });
      return { data: updated, oldRecord: oldRecord, permissions: {} };
    }

    /**
     * Lower-level primitive for updating a record while respecting
     * _status and last_modified.
     *
     * @param  {Object} oldRecord: the record retrieved from the DB
     * @param  {Object} newRecord: the record to replace it with
     * @return {Object}
     */

  }, {
    key: "_updateRaw",
    value: function _updateRaw(oldRecord, newRecord) {
      var _ref23 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
          _ref23$synced = _ref23.synced,
          synced = _ref23$synced === undefined ? false : _ref23$synced;

      var updated = (0, _extends3.default)({}, newRecord);
      // Make sure to never loose the existing timestamp.
      if (oldRecord && oldRecord.last_modified && !updated.last_modified) {
        updated.last_modified = oldRecord.last_modified;
      }
      // If only local fields have changed, then keep record as synced.
      // If status is created, keep record as created.
      // If status is deleted, mark as updated.
      var isIdentical = oldRecord && recordsEqual(oldRecord, updated, this.localFields);
      var keepSynced = isIdentical && oldRecord._status == "synced";
      var neverSynced = !oldRecord || oldRecord && oldRecord._status == "created";
      var newStatus = keepSynced || synced ? "synced" : neverSynced ? "created" : "updated";
      return markStatus(updated, newStatus);
    }

    /**
     * Upsert a record into the local database.
     *
     * This record must have an ID.
     *
     * If a record with this ID already exists, it will be replaced.
     * Otherwise, this record will be inserted.
     *
     * @param  {Object} record
     * @return {Object}
     */

  }, {
    key: "upsert",
    value: function upsert(record) {
      if ((typeof record === "undefined" ? "undefined" : (0, _typeof3.default)(record)) !== "object") {
        throw new Error("Record is not an object.");
      }
      if (!record.hasOwnProperty("id")) {
        throw new Error("Cannot update a record missing id.");
      }
      if (!this.collection.idSchema.validate(record.id)) {
        throw new Error("Invalid Id: " + record.id);
      }
      var oldRecord = this.adapterTransaction.get(record.id);
      var updated = this._updateRaw(oldRecord, record);
      this.adapterTransaction.update(updated);
      // Don't return deleted records -- pretend they are gone
      if (oldRecord && oldRecord._status == "deleted") {
        oldRecord = undefined;
      }
      if (oldRecord) {
        this._queueEvent("update", { data: updated, oldRecord: oldRecord });
      } else {
        this._queueEvent("create", { data: updated });
      }
      return { data: updated, oldRecord: oldRecord, permissions: {} };
    }
  }]);
  return CollectionTransaction;
}();