"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

var _getPrototypeOf = require("babel-runtime/core-js/object/get-prototype-of");

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

var _events = require("events");

var _kintoHttp = require("kinto-http");

var _kintoHttp2 = _interopRequireDefault(_kintoHttp);

var _base = require("./adapters/base");

var _base2 = _interopRequireDefault(_base);

var _IDB = require("./adapters/IDB");

var _IDB2 = _interopRequireDefault(_IDB);

var _KintoBase2 = require("./KintoBase");

var _KintoBase3 = _interopRequireDefault(_KintoBase2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// babel-polyfill can only be imported once
if (!global._babelPolyfill) {
  require("babel-polyfill");
}

var Kinto = function (_KintoBase) {
  (0, _inherits3.default)(Kinto, _KintoBase);
  (0, _createClass3.default)(Kinto, null, [{
    key: "adapters",

    /**
     * Provides a public access to the base adapter classes. Users can create
     * a custom DB adapter by extending BaseAdapter.
     *
     * @type {Object}
     */
    get: function get() {
      return {
        BaseAdapter: _base2.default,
        IDB: _IDB2.default
      };
    }
  }]);

  function Kinto() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck3.default)(this, Kinto);

    var defaults = {
      adapter: Kinto.adapters.IDB,
      events: new _events.EventEmitter(),
      ApiClass: _kintoHttp2.default
    };

    return (0, _possibleConstructorReturn3.default)(this, (Kinto.__proto__ || (0, _getPrototypeOf2.default)(Kinto)).call(this, (0, _extends3.default)({}, defaults, options)));
  }

  return Kinto;
}(_KintoBase3.default);

// This fixes compatibility with CommonJS required by browserify.
// See http://stackoverflow.com/questions/33505992/babel-6-changes-how-it-exports-default/33683495#33683495


exports.default = Kinto;
if ((typeof module === "undefined" ? "undefined" : (0, _typeof3.default)(module)) === "object") {
  module.exports = Kinto;
}