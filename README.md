# tap-out

A different tap parser

## Install

```
npm install tap-out --save
```

## Usage

**CLI**

```
$ something-that-produces-tap | tap-out
{
  asserts: [
    { name: 'true value', number: 1, ok: true, raw: 'ok 1 true value', test: 1, type: 'assert' }, 
    { name: 'true value', number: 2, ok: true, raw: 'ok 2 true value', test: 1, type: 'assert' }
  ],
  fail: [],
  pass: [ 
    { name: 'true value', number: 1, ok: true, raw: 'ok 1 true value', test: 1, type: 'assert' },
    { name: 'true value', number: 2, ok: true, raw: 'ok 2 true value', test: 1, type: 'assert' }
  ],
  results: [],
  tests: [
    { name: 'is true', number: 1, raw: '# is true', type: 'test' }
  ],
  versions: []
}
```

**API**

```js
var tapOut = require('tap-out');

var t = tapOut(function (output) {
  
  console.log(output);
});

process.stdin.pipe(t);
```

## Methods

### var t = tapOut(function (err, output) {})

Returns a stream that emits events with various TAP data. Takes a callback which is called when all parsing is done.

## Events

### t.on('output', function (output) {})

All output after all TAP data is parsed.

### t.on('test', function (test) {})

Parsed test object with details

### t.on('assert', function (assert) {})

Parsed assert object details

### t.on('version', function (version) {})

Parsed version data

### t.on('result', function (result) {})

Parsed test result data (pass, fail, etc.)

### t.on('pass', function (pass) {})

Parsed assertion that has passed with details

### t.on('fail', function (pass) {})

Failed assertion that has passed with details

### t.on('comment', function (comment) {})

Generic output like `console.log()` in your tests

## Run Test

```
npm install
npm test
```
