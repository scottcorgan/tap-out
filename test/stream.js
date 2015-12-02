var fs = require('fs')

var namespace = require('tessed').namespace
var R = require('ramda')
var H = require('highland')

var tapOut = require('../')

var test = namespace('stream')

test('parses test values', function (t) {

  t.plan(5)

  return function (done) {

    testsFromStream(yamlTapStream())
      .head()
      .each(function (line) {

        t.deepEqual(line.raw, ['# test 1'], 'raw')
        t.equal(line.type, 'test', 'type')
        t.equal(line.title, 'test 1', 'title')
        t.equal(line.lineNumber, 1, 'lineNumber')
        t.equal(line.testNumber, 1, 'testNumber')
      })
  }
})

test('gets all tests', function (t) {

  t.plan(1)

  var count = 0

  return function (done) {

    testsFromStream(yamlTapStream())
      .each(function (line) {count += 1})
      .done(function () {

        t.equal(count, 3, 'test count')
      })
  }
})

test('parses assertion values', function (t) {

  t.plan(8)

  return function (done) {

    assertionsFromStream(yamlTapStream())
      .head()
      .each(function (line) {

        t.deepEqual(line.raw, [ 'ok 1 first assertion has yaml,\n    a: b\n  ...' ], 'raw')
        t.equal(line.type, 'assertion', 'type')
        t.equal(line.title, 'first assertion has yaml,', 'title')
        t.equal(line.ok, true, 'ok')
        t.equal(line.meta.lineNumber, 2, 'lineNumber')
        t.equal(line.meta.assertionNumber, 1, 'assertionNumber')
        t.equal(line.meta.testNumber, 1, 'testNumber')
        t.deepEqual(line.meta.block, [ '    a: b', '  ...' ], 'block')
      })
  }
})

test('gets all assertions', function (t) {

  t.plan(1)

  return function (done) {

    var count = 0

    assertionsFromStream(yamlTapStream())
      .each(function () {count += 1})
      .done(function () {

        t.equal(count, 7, 'count')
      })
  }
})

test('gets all passing assertions', function (t) {

  t.plan(1)

  return function (done) {

    assertionsFromStream(yamlTapStream())
      .filter(function (line) {return line.ok})
      .reduce([], function (all, line) {return all.concat(line)})
      .each(function (lines) {

        t.equal(lines.length, 5, 'number of assertions')
      })
  }
})

test('gets all failing assertions', function (t) {

  t.plan(1)

  return function (done) {

    assertionsFromStream(yamlTapStream())
      .filter(function (line) {return !line.ok})
      .reduce([], function (all, line) {return all.concat(line)})
      .each(function (lines) {

        t.equal(lines.length, 2, 'number of assertions')
      })
  }
})

test('parses comment values', function (t) {

  t.plan(4)

  return function (done) {

    commentsFromStream(yamlTapStream())
      .head()
      .each(function (line) {

        t.deepEqual(line.raw, [ 'this is a console log' ], 'raw')
        t.equal(line.type, 'comment', 'type')
        t.equal(line.title, 'this is a console log', 'title')
        t.equal(line.meta.lineNumber, 7, 'lineNumber')
      })
  }
})

test('gets all comments', function (t) {

  t.plan(1)

  return function (done) {

    var count = 0

    commentsFromStream(yamlTapStream())
      .each(function () {count += 1})
      .done(function () {

        t.equal(count, 1, 'count')
      })
  }
})

test('parses plan values', function (t) {

  t.plan(4)

  return function (done) {

    plansFromStream(yamlTapStream())
      .head()
      .each(function (line) {

        t.deepEqual(line.raw, [ '1..7' ], 'raw')
        t.equal(line.type, 'plan', 'type')
        t.equal(line.from, 1, 'from')
        t.equal(line.to, 7, 'to')
      })
  }
})

test('gets all plans', function (t) {

  t.plan(1)

  return function (done) {

    var count = 0

    plansFromStream(yamlTapStream())
      .each(function () {count += 1})
      .done(function () {

        t.equal(count, 1, 'count')
      })
  }
})

test('parses version values', function (t) {

  t.plan(2)

  return function (done) {

    versionsFromStream(yamlTapStream())
      .head()
      .each(function (line) {

        t.deepEqual(line.raw, [ 'TAP version 13' ], 'raw')
        t.equal(line.type, 'version', 'type')
      })
  }
})

test('gets all versions', function (t) {

  t.plan(1)

  return function (done) {

    var count = 0

    versionsFromStream(yamlTapStream())
      .each(function () {count += 1})
      .done(function () {

        t.equal(count, 1, 'count')
      })
  }
})

test('parses result values', function (t) {

  t.plan(1)

  return function (done) {

    resultsFromStream(yamlTapStream())
      .reduce([], function (prev, line) {return prev.concat(line)})
      .each(function (lines) {

        t.deepEqual(
          lines,
          [ { type: 'result', name: 'tests', count: 7, raw: [ '# tests 7' ] },
            { type: 'result', name: 'pass', count: 5, raw: [ '# pass 5' ] },
            { type: 'result', name: 'fail', count: 2, raw: [ '# fail 2' ] } ],
          'all results'
        )
      })
  }
})

// Helpers

function yamlTapStream () {

  return fs.createReadStream(__dirname + '/fixtures/yaml.txt')
}

function basicTapStream () {

  return fs.createReadStream(__dirname + '/fixtures/basic.txt')
}

function filterTypeInStream (stream, type) {

  return H(stream.pipe(tapOut.stream()))
    .map(JSON.parse)
    .filter(R.pipe(R.path(['type']), R.equals(type)))
}

function testsFromStream (stream) {

  return filterTypeInStream(stream, 'test')
}

function assertionsFromStream (stream) {

  return filterTypeInStream(stream, 'assertion')
}

function commentsFromStream (stream) {

  return filterTypeInStream(stream, 'comment')
}

function plansFromStream (stream) {

  return filterTypeInStream(stream, 'plan')
}

function versionsFromStream (stream) {

  return filterTypeInStream(stream, 'version')
}

function resultsFromStream (stream) {

  return filterTypeInStream(stream, 'result')
}
