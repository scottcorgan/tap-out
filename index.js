'use strict';

var through = require('through2');
var split = require('split');
var trim = require('trim');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var reemit = require('re-emitter');

var expr = require('./lib/utils/regexes');
var parseLine = require('./lib/parse-line');

function Parser() {
  if (!(this instanceof Parser)) {
    return new Parser();
  }

  EventEmitter.call(this);

  this.results = {
    tests: [],
    asserts: [],
    versions: [],
    results: [],
    comments: [],
    pass: [],
    fail: [],
  };
  this.testNumber = 0;


  this.writingErrorOutput = false;
  this.writingErrorStackOutput = false;
  this.tmpErrorOutput = '';
}

util.inherits(Parser, EventEmitter);

Parser.prototype.handleLine = function handleLine(line) {
  var parsed = parseLine(line);

  // This will handle all the error stuff
  this._handleError(line);
  
  // THis is weird, but it's the only way to distinguish a
  // console.log type output from an error output
  if (!this.writingErrorOutput && !parsed && !isErrorOutputEnd(line)) {
    var comment = {
      type: 'comment',
      raw: line,
      test: this.testNumber
    };
    this.emit('comment', comment);
    this.results.comments.push(comment);
  }
  
  // Invalid line
  if (!parsed) {
    return;
  }
  
  // Handle tests
  if (parsed.type === 'test') {
    this.testNumber += 1;
    parsed.number = this.testNumber;
  }
  
  // Handle asserts
  if (parsed.type === 'assert') {
    parsed.test = this.testNumber;
    this.results[parsed.ok ? 'pass' : 'fail'].push(parsed);
    
    if (parsed.ok) {
      // No need to have the error object
      // in a passing assertion
      delete parsed.error;
      this.emit('pass', parsed);
    }
  }
  
  this.emit(parsed.type, parsed);
  this.results[parsed.type + 's'].push(parsed);
};

Parser.prototype._handleError = function _handleError(line) {
  // Start of error output
  if (isErrorOutputStart(line)) {
    this.writingErrorOutput = true;
  }
  // End of error output
  else if (isErrorOutputEnd(line)) {
    this.writingErrorOutput = false;
    this.writingErrorStackOutput = false;

    // Emit error here so it has the full error message with it
    var lastAssert = this.results.fail[this.results.fail.length - 1];

    if (this.tmpErrorOutput) {
      lastAssert.error.stack = this.tmpErrorOutput;
      this.tmpErrorOutput = '';
    }

    this.emit('fail', lastAssert);
  }
  // Append to stack
  else if (this.writingErrorStackOutput) {
    this.tmpErrorOutput += trim(line) + '\n';
  }
  // No the beginning of the error message but it's the body
  else if (this.writingErrorOutput) {
    var lastAssert = this.results.fail[this.results.fail.length - 1];
    var m = splitFirst(trim(line), (':'));

    if (m[0] === 'stack') {
      this.writingErrorStackOutput = true;
      return;
    }
    
    var msg = trim((m[1] || '').replace(/['"]+/g, ''));
    
    if (m[0] === 'at') {
      msg = trim(m[1]
        .replace(/['"]+/g, '')
        .replace('Test.<anonymous> (', ''))
        .replace(')', '');
      
      var values = msg.split(':');
      
      msg = {
        file: values[0],
        line: values[1],
        charactor: values[2]
      };
    }
    
    // This is a plan failure
    if (lastAssert.name === 'plan != count') {
      lastAssert.type = 'plan';
      delete lastAssert.error.at;
      lastAssert.error.operator = 'count';
      
      // Need to set this value
      if (m[0] === 'actual') {
        lastAssert.error.actual = trim(m[1]);
      }
    }
    
    lastAssert.error[m[0]] = msg;
  }
};

module.exports = function (done) {
  
  done = done || function () {};
  
  var stream = through();
  var parser = Parser();
  reemit(parser, stream, [
    'test', 'assert', 'version', 'result', 'pass', 'fail', 'comment'
  ]);
  
  stream
    .pipe(split())
    .on('data', function (data) {
      
      if (!data) {
        return;
      }
      
      var line = data.toString();
      parser.handleLine(line);
    })
    .on('close', function () {
      stream.emit('output', parser.results);
      done(null, parser.results);
    })
    .on('error', done);
  
  return stream;
};
module.exports.Parser = Parser;

function isErrorOutputStart (line) {
  
  return line.indexOf('  ---') === 0;
}

function isErrorOutputEnd (line) {
  
  return line.indexOf('  ...') === 0;
}

function splitFirst(str, pattern) {
  var parts = str.split(pattern);
  if (parts.length <= 1) {
    return parts;
  }

  return [parts[0], parts.slice(1).join(pattern)];
}
