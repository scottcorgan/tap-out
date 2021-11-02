'use strict';

var PassThrough = require('readable-stream/passthrough');
var split = require('split');
var trim = require('trim');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var reemit = require('re-emitter');

var expr = require('./lib/utils/regexes');
var parseLine = require('./lib/parse-line');
var error = require('./lib/error');

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
    plans: [],
    pass: [],
    fail: [],
    errors: [],
  };
  this.testNumber = 0;

  this.previousLine = '';
  this.currentNextLineError = null;
  this.writingErrorOutput = false;
  this.writingErrorStackOutput = false;
  this.tmpErrorOutput = '';
}

util.inherits(Parser, EventEmitter);

Parser.prototype.handleLine = function handleLine(line) {

  var parsed = parseLine(line);

  // This will handle all the error stuff
  this._handleError(line);

  // This is weird, but it's the only way to distinguish a
  // console.log type output from an error output
  if (
    !this.writingErrorOutput
    && !parsed
    && !isErrorOutputEnd(line)
    && !isRawTapTestStatus(line)
    )
      {
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
    this.previousLine = line;
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

  if (!isOkLine(this.previousLine)) {
    this.emit(parsed.type, parsed);
    this.results[parsed.type + 's'].push(parsed);
  }

  // This is all so we can determine if the "# ok" output on the last line
  // should be skipped
  function isOkLine (previousLine) {

    return line === '# ok' && previousLine.indexOf('# pass') > -1;
  }
  this.previousLine = line;
};

Parser.prototype._handleError = function _handleError(line) {
  var lastAssert;

  // Start of error output
  if (isErrorOutputStart(line)) {
    this.writingErrorOutput = true;
    this.lastAsserRawErrorString = '';
  }
  // End of error output
  else if (isErrorOutputEnd(line)) {
    this.writingErrorOutput = false;
    this.currentNextLineError = null;
    this.writingErrorStackOutput = false;

    // Emit error here so it has the full error message with it
    var lastAssert = this.results.fail[this.results.fail.length - 1];

    if (this.tmpErrorOutput) {
      lastAssert.error.stack = this.tmpErrorOutput;
      this.lastAsserRawErrorString += this.tmpErrorOutput + '\n';
      this.tmpErrorOutput = '';
    }

    // right-trimmed raw error string
    lastAssert.error.raw = this.lastAsserRawErrorString.replace(/\s+$/g, '');

    this.emit('fail', lastAssert);
  }
  // Append to stack
  else if (this.writingErrorStackOutput) {
    this.tmpErrorOutput += trim(line) + '\n';
  }
  // Not the beginning of the error message but it's the body
  else if (this.writingErrorOutput) {
    var m = splitFirst(trim(line), (':'));
    lastAssert = this.results.fail[this.results.fail.length - 1];

    // Rebuild raw error output
    this.lastAsserRawErrorString += line + '\n';

    if (m[0] === 'stack') {
      this.writingErrorStackOutput = true;
      return;
    }

    var msg = trim((m[1] || '').replace(/['"]+/g, ''));

    if (m[0] === 'at') {
      // Example string: Object.async.eachSeries (/Users/scott/www/modules/nash/node_modules/async/lib/async.js:145:20)

      msg = msg
      .split(' ')[1]
      .replace('(', '')
      .replace(')', '');

      var values = msg.split(':');
      var file = values.slice(0, values.length-2).join(':');

      msg = {
        file: file,
        line: values[values.length-2],
        character: values[values.length-1]
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

    // outputting expected/actual object or array
    if (this.currentNextLineError) {
      lastAssert.error[this.currentNextLineError] = trim(line);
      this.currentNextLineError = null;
    }
    else if (trim(m[1]) === '|-') {
      this.currentNextLineError = m[0];
    }
    else {
      lastAssert.error[m[0]] = msg;
    }
  }
  // Emit fail when error on previous line had no diagnostics
  else if (this.previousLine && isFailAssertionLine(this.previousLine)) {
    lastAssert = this.results.fail[this.results.fail.length - 1];

    this.emit('fail', lastAssert);
  }
};

Parser.prototype._handleEnd = function _handleEnd() {
  var plan = this.results.plans.length ? this.results.plans[0] : null;
  var count = this.results.asserts.length;
  var first = count && this.results.asserts.reduce(firstAssertion);
  var last = count && this.results.asserts.reduce(lastAssertion);

  // Emit fail when error on previous line had no diagnostics
  if (this.previousLine && isFailAssertionLine(this.previousLine)) {
    var lastAssert = this.results.fail[this.results.fail.length - 1];

    this.emit('fail', lastAssert);
  }

  if (!plan) {
    if (count > 0) {
      this.results.errors.push(error('no plan provided'));
    }
    return;
  }

  if (this.results.fail.length > 0) {
    return;
  }

  if (count !== (plan.to - plan.from + 1)) {
    this.results.errors.push(error('incorrect number of assertions made'));
  } else if (first && first.number !== plan.from) {
    this.results.errors.push(error('first assertion number does not equal the plan start'));
  } else if (last && last.number !== plan.to) {
    this.results.errors.push(error('last assertion number does not equal the plan end'));
  }
};

module.exports = function (done) {

  done = done || function () {};

  var stream = new PassThrough();
  var parser = Parser();
  reemit(parser, stream, [
    'test', 'assert', 'version', 'result', 'pass', 'fail', 'comment', 'plan'
  ]);

  var write = stream.write;
  var end = stream.end;

  var splitStream = split();

  stream.write = function() {
    write.apply(stream, arguments);
    splitStream.write.apply(splitStream, arguments);
  };

  stream.end = function() {
    end.apply(stream, arguments);
    splitStream.end.apply(splitStream, arguments);
  };

  splitStream
    .on('data', function (data) {

      if (!data) {
        return;
      }

      var line = data.toString();
      parser.handleLine(line);
    })
    .on('end', function () {
      parser._handleEnd();

      stream.emit('output', parser.results);

      done(null, parser.results);
    })
    .on('error', done);

  return stream;
};

module.exports.Parser = Parser;

function isFailAssertionLine (line) {

  return line.indexOf('not ok') === 0;
}

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

function isRawTapTestStatus (str) {

  var rawTapTestStatusRegex = new RegExp('(\\d+)(\\.)(\\.)(\\d+)');;
  return rawTapTestStatusRegex.exec(str);
}

function firstAssertion(first, assert) {
  return assert.number < first.number ? assert : first;
}

function lastAssertion(last, assert) {
  return assert.number > last.number ? assert : last;
}
