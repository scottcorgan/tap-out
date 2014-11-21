var fs = require('fs');
var through = require('through2');
var split = require('split');
var trim = require('trim');

var expr = require('./lib/utils/regexes');
var parseLine = require('./lib/parse-line');

module.exports = function (done) {
  
  done = done || function () {};
  
  var stream = through();
  var testNumber = 0;
  var writingErrorOutput = false;
  var tmpErrorOutput = '';
  var results = {
    tests: [],
    asserts: [],
    versions: [],
    results: [],
    pass: [],
    fail: []
  };
  
  stream
    .pipe(split())
    .on('data', function (data) {
      
      if (!data) {
        return;
      }
      
      var line = data.toString();
      var parsed = parseLine(line);
      
      // This will handle all the error stuff
      handleError(line);
      
      // Invalid line
      if (!parsed) {
        return;
      }
      
      // Handle tests
      if (parsed.type === 'test') {
        testNumber += 1;
        parsed.number = testNumber;
      }
      
      // Handle asserts
      if (parsed.type === 'assert') {
        parsed.test = testNumber;
        results[parsed.ok ? 'pass' : 'fail'].push(parsed);
        
        if (parsed.ok) {
          // No need to have the error object
          // in a passing assertion
          delete parsed.error;
          stream.emit('pass', parsed);
        }
      }
      
      stream.emit(parsed.type, parsed);
      results[parsed.type + 's'].push(parsed);
    })
    .on('close', function () {
      
      stream.emit('output', results);
      done(null, results);
    })
    .on('error', done);
  
  //
  function handleError (line) {
    
    // Start of error output
    if (isErrorOutputStart(line)) {
      writingErrorOutput = true;
    }
    // End of error output
    else if (isErrorOutputEnd(line)) {
      writingErrorOutput = false;
      // Emit error here so it has the full error message with it
      var lastAssert = results.fail[results.fail.length - 1];
      stream.emit('fail', lastAssert);
    }
    // No the beginning of the error message but it's the body
    else if (writingErrorOutput) {
      var lastAssert = results.fail[results.fail.length - 1];
      var m = trim(line).split(': ');
      
      var msg = trim(m[1].replace(/['"]+/g, ''));
      
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
        }
      }
      
      lastAssert.error[m[0]] = msg;
    }
  }
  
  return stream;
};

function isErrorOutputStart (line) {
  
  return line.indexOf('  ---') === 0;
}

function isErrorOutputEnd (line) {
  
  return line.indexOf('  ...') === 0;
}