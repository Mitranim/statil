/**
 * Private methods.
 */

/******************************* Dependencies ********************************/

// Third party.
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require('path');

var pt = _interopRequireWildcard(_path);

// Local.

var _statics = require('./statics');

var statics = _interopRequireWildcard(_statics);

/********************************** Methods **********************************/

/**
 * Methods store. Used for spying in tests. Library code must always access
 * methods as properties of this object.
 */
var methods = new _statics.Hash();
exports['default'] = methods;

/*-------------------------------- Rendering --------------------------------*/

/**
 * Takes a path to a template and an optional hash of locals. Clones the
 * locals and enhances it with the template's legend (if available). If the
 * legend has an 'echo' option, the locals are echoed for each sublegend, each
 * locals clone receiving the sublegend's properties. For each clone, we form
 * a virtual path where the template's name is replaced with the 'name' from
 * the legend (in absence of legend or 'echo', the original path is used).
 * This virtual path is assigned as $path to the locals clone.
 *
 * Then we call Statil#renderThrough with the original template path for each
 * locals clone, mapping the result to the virtual path.
 *
 * If the statil has a 'rename' method (e.g. passed through the options object
 * into the statil constructor), this method is called for each resulting path.
 * If it returns a value, this value replaces the path.
 *
 * The return value is a map of virtual paths to results.
 */
methods.renderTemplate = function (path, data) {
  var _this = this;

  var buffer = new _statics.Hash();

  // Enhance the locals with the legend.
  var legend = this.fileLegend(path);
  data = _lodash2['default'].assign(new _statics.Hash(data), legend);

  // Default datas group.
  var datas = [data];
  data.name = pt.basename(path);

  // Echo for each sublegend, if available.
  if (legend && legend.echo) {
    // Multiply and validate the legends.
    var legends = statics.echoLegend(this.metaAtPath(path), legend);

    // Map the data.
    datas = legends.map(function (legend) {
      // Convert inherited properties into own properties.
      legend = _lodash2['default'].omit(legend);
      return _lodash2['default'].assign(new _statics.Hash(data), legend);
    });
  }

  // Render the template for each locals clone, assigning the result under the
  // virtual path.
  _lodash2['default'].each(datas, function (data) {
    var echoPath = data.$path = pt.join(pt.dirname(path), data.name);
    var result = methods.renderThrough.call(_this, path, data);

    // Rename the path, if a 'rename' method is available.
    if (typeof _this.rename === 'function') {
      echoPath = _this.rename(echoPath) || echoPath;
    }

    // Write the result.
    buffer[echoPath] = result;
  });

  return buffer;
};

/**
 * Hierarchically renders all templates from the current path, through its
 * ancestors, up to the root 'index' template. Reuses the same mutable locals
 * object between render passes. The result of each pass is assigned to locals
 * as '$content' for transclusion in the next ancestor template.
 *
 * The path must be a non-empty string. The locals are optional.
 */
methods.renderThrough = function (path, data) {
  var _this2 = this;

  // Validate the path.
  statics.validateTruthyString(path);

  // Make sure data is a writable object.
  if (!_lodash2['default'].isObject(data)) data = new _statics.Hash();

  // Get the paths at which to render.
  var compounded = statics.split(path);

  // Render the result hierarchically.
  _lodash2['default'].eachRight(compounded, function (compoundedPath) {
    data.$content = methods.renderOne.call(_this2, compoundedPath, data);
  });

  return data.$content;
};

/**
 * Renders the template at the given path, passing the given locals. The path
 * must be a non-empty string. The locals are optional.
 */
methods.renderOne = function (path, data) {
  // Validate the path and resolve it to a template function.
  statics.validateTruthyString(path);
  var template = this.templates[statics.stripExt(path)] || statics.transclude;

  // Make sure data is a writable object.
  if (!_lodash2['default'].isObject(data)) data = new _statics.Hash();

  // Provide default locals to the data.
  methods.locals.call(this, path, data);

  // Render the result.
  try {
    return template.call(this, data);
  } catch (err) {
    console.error('Error when rendering template at path:', path);
    throw err;
  }
};

/*---------------------------------- Setup ----------------------------------*/

/**
 * Generates a hash of default imports for lodash's template parser.
 */
methods.imports = function () {
  return {
    $include: methods.$include.bind(this),
    $entitle: methods.$entitle.bind(this),
    $active: methods.$active.bind(this),
    $act: methods.$act.bind(this)
  };
};

/**
 * Renders the template with the given path and the given data and returns
 * the result. The data is cloned before it's passed to the renderer.
 */
methods.$include = function (path, data) {
  // Clone the data object and pass arguments to #renderOne.
  data = new _statics.Hash(data);
  return methods.renderOne.call(this, path, data);
};

/**
 * Prepends or assigns the given string to the page's title stored as
 * 'data.$title'. This mutates the title, prepending new parts, if called
 * several times over the data's lifecycle. A non-string or empty title is
 * ignored.
 */
methods.$entitle = function (title, data) {
  if (!_lodash2['default'].isObject(data)) return;
  if (typeof title !== 'string' || !title) return;

  if (typeof data.$title !== 'string' || !data.$title) {
    data.$title = title;
  } else {
    data.$title = title + ' | ' + data.$title;
  }
};

/**
 * Takes a path and a data object; returns 'active' if the path is included
 * into the URL/template path specified in the data (if any), and an empty
 * string otherwise.
 */
methods.$active = function (path, data) {
  if (!_lodash2['default'].isObject(data)) return '';
  if (typeof path !== 'string') return '';
  if (typeof data.$path !== 'string') return '';

  var relative = pt.relative(path, data.$path);
  if (relative[0] !== '.') return 'active';
  return '';
};

/**
 * Version of $active that returns the attribute 'class="active"' if
 * matched.
 */
methods.$act = function (path, data) {
  if (methods.$active.call(this, path, data)) return 'class="active"';
  return '';
};

/**
 * Takes a path to a template file and a data object. Writes contextual locals
 * into that object.
 */
methods.locals = function (path, data) {
  // Validate the input.
  statics.validateString(path);
  statics.validateWritable(data);

  // Make sure '$content' is always defined and is a string.
  if (typeof data.$content !== 'string') data.$content = '';

  // Make sure '$title' is always defined and is a string.
  if (typeof data.$title !== 'string') data.$title = '';

  // Reference the data itself as '$'.
  data.$ = data;

  // Include the metadata associated with the current directory, if any.
  var meta = this.metaAtPath(path);
  if (meta) data.$meta = meta;

  /**
   * Include the file's legend from the directory's metadata, if available.
   * Note: these locals are intentionally allowed to "bleed through" to
   * ancestor templates during a Statil#renderThrough pass.
   */
  var legend = this.fileLegend(path);
  if (legend) _lodash2['default'].assign(data, legend);
};

/**
 * Checks if the name of the template at the given path matches the 'ignore'
 * expression in that directory's metadata, if any.
 */
methods.isIgnored = function (path) {
  var meta = this.metaAtPath(path);
  if (!meta || !meta.ignore) return false;
  statics.validateTruthyString(meta.ignore);
  return !!pt.basename(path).match(meta.ignore);
};
module.exports = exports['default'];