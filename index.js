var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var Buffer = require('buffer').Buffer;
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var map = require('event-stream').map;
var util = require('util');

var FILE_DECL = /(href=|src=|url\()(['"])([^\s>"']+?)\?rev=([^\s>&"']+)/gi;
var SPECIAL_DECL = /@@hash\(([^'">)]+)\)/gi;

/*
options = {
  basePath: <path to files>,
  skipFileErrors: false,
}
 */
var revPlugin = function revPlugin(options) {

  return map(function(file, cb) {

    if(!options)
      options = {};

    var contents;
    var dependencyPath;
    var data, hash;

    if(!file) {
      throw new PluginError('gulp-rev-append', 'Missing file option for gulp-rev-append.');
    }

    if(!file.contents) {
      throw new PluginError('gulp-rev-append', 'Missing file.contents required for modifying files using gulp-rev-append.');
    }

    function appendHash(string, filename){
        var normPath = path.normalize(filename);
        if(options.basePath) {
            dependencyPath = path.join(options.basePath, normPath);
        }else if (normPath.indexOf(path.sep) === 0) {
            dependencyPath = path.join(file.base, normPath);
        }else{
            dependencyPath = path.resolve(path.dirname(file.path), normPath);
        }

        data = fs.readFileSync(dependencyPath);
        hash = crypto.createHash('md5');
        hash.update(data.toString(), 'utf8');

        return string + hash.digest('base64').replace(/[=\+\/]/g, function (match) {
            if(match === '+')
              return '$';
            if(match === '/')
              return '-';
            return '';
        });
    }

    function appendHashWithErrorHandling(string, filename, match, offset){
      try{
        return appendHash(string, filename);
      }catch(e){
        var error = e.message + ': ' + filename + ' from statement ' + match + ' (offset ' + offset + ')';
        console.error('gulp-rev-append: ' + error);
        if(options.skipFileErrors)
          return string + '';
        throw new PluginError('gulp-rev-append', error);
      }
    }

    contents = file.contents.toString();
    contents = contents.replace(FILE_DECL, function (match, attr, quote, filename, rev, offset) {
      return appendHashWithErrorHandling(attr + quote + filename + '?rev=', filename, match, offset);
    });
    contents = contents.replace(SPECIAL_DECL, function (match, filename, offset) {
      return appendHashWithErrorHandling('', filename, match, offset);
    });

    file.contents = new Buffer(contents);
    cb(null, file);

  });

};

module.exports = revPlugin;