"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _collection = require("./collection");

var _collection2 = _interopRequireDefault(_collection);

var _base = require("./adapters/base");

var _base2 = _interopRequireDefault(_base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_BUCKET_NAME = "default";
var DEFAULT_REMOTE = "http://localhost:8888/v1";
var DEFAULT_RETRY = 1;

/**
 * KintoBase class.
 */

var KintoBase = function () {
  (0, _createClass3.default)(KintoBase, null, [{
    key: "adapters",

    /**
     * Provides a public access to the base adapter class. Users can create a
     * custom DB adapter by extending {@link BaseAdapter}.
     *
     * @type {Object}
     */
    get: function get() {
      return {
        BaseAdapter: _base2.default
      };
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

  }, {
    key: "syncStrategy",
    get: function get() {
      return _collection2.default.strategy;
    }

    /**
     * Constructor.
     *
     * Options:
     * - `{String}`       `remote`         The server URL to use.
     * - `{String}`       `bucket`         The collection bucket name.
     * - `{EventEmitter}` `events`         Events handler.
     * - `{BaseAdapter}`  `adapter`        The base DB adapter class.
     * - `{Object}`       `adapterOptions` Options given to the adapter.
     * - `{String}`       `dbPrefix`       The DB name prefix.
     * - `{Object}`       `headers`        The HTTP headers to use.
     * - `{Object}`       `retry`          Number of retries when the server fails to process the request (default: `1`)
     * - `{String}`       `requestMode`    The HTTP CORS mode to use.
     * - `{Number}`       `timeout`        The requests timeout in ms (default: `5000`).
     *
     * @param  {Object} options The options object.
     */

  }]);

  function KintoBase() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck3.default)(this, KintoBase);

    var defaults = {
      bucket: DEFAULT_BUCKET_NAME,
      remote: DEFAULT_REMOTE,
      retry: DEFAULT_RETRY
    };
    this._options = (0, _extends3.default)({}, defaults, options);
    if (!this._options.adapter) {
      throw new Error("No adapter provided");
    }

    var _options = this._options,
        ApiClass = _options.ApiClass,
        events = _options.events,
        headers = _options.headers,
        remote = _options.remote,
        requestMode = _options.requestMode,
        retry = _options.retry,
        timeout = _options.timeout;

    // public properties

    /**
     * The kinto HTTP client instance.
     * @type {KintoClient}
     */

    this.api = new ApiClass(remote, {
      events: events,
      headers: headers,
      requestMode: requestMode,
      retry: retry,
      timeout: timeout
    });
    /**
     * The event emitter instance.
     * @type {EventEmitter}
     */
    this.events = this._options.events;
  }

  /**
   * Creates a {@link Collection} instance. The second (optional) parameter
   * will set collection-level options like e.g. `remoteTransformers`.
   *
   * @param  {String} collName The collection name.
   * @param  {Object} [options={}]                 Extra options or override client's options.
   * @param  {Object} [options.idSchema]           IdSchema instance (default: UUID)
   * @param  {Object} [options.remoteTransformers] Array<RemoteTransformer> (default: `[]`])
   * @param  {Object} [options.hooks]              Array<Hook> (default: `[]`])
   * @param  {Object} [options.localFields]        Array<Field> (default: `[]`])
   * @return {Collection}
   */


  (0, _createClass3.default)(KintoBase, [{
    key: "collection",
    value: function collection(collName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (!collName) {
        throw new Error("missing collection name");
      }

      var _options$options = (0, _extends3.default)({}, this._options, options),
          bucket = _options$options.bucket,
          events = _options$options.events,
          adapter = _options$options.adapter,
          adapterOptions = _options$options.adapterOptions,
          dbPrefix = _options$options.dbPrefix;

      var idSchema = options.idSchema,
          remoteTransformers = options.remoteTransformers,
          hooks = options.hooks,
          localFields = options.localFields;


      return new _collection2.default(bucket, collName, this.api, {
        events: events,
        adapter: adapter,
        adapterOptions: adapterOptions,
        dbPrefix: dbPrefix,
        idSchema: idSchema,
        remoteTransformers: remoteTransformers,
        hooks: hooks,
        localFields: localFields
      });
    }
  }]);
  return KintoBase;
}();

exports.default = KintoBase;