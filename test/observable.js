var fs = require('fs')

var namespace = require('tessed').namespace
var R = require('ramda')

var tapOut = require('../')

var test = namespace('observable')

test('parses test values', function (t) {

  t.plan(5)

  return function () {

    testsFromStream$(yamlTapStream())
      .first()
      .forEach(function (line) {

        t.deepEqual(line.raw, '# test 1', 'raw')
        t.equal(line.type, 'test', 'type')
        t.equal(line.title, 'test 1', 'title')
        t.equal(line.lineNumber, 1, 'lineNumber')
        t.equal(line.testNumber, 1, 'testNumber')
      })
  }
})

test('gets all tests', function (t) {

  t.plan(2)

  return function () {

    testsFromStream$(yamlTapStream())
      .count()
      .forEach(function (count) {t.equal(count, 3, 'test count')})

    tapOut.observeStream(yamlTapStream()).tests$
      .count()
      .forEach(function (count) {t.equal(count, 3, 'test count')})
  }
})

test('parses assertion values', function (t) {

  t.plan(8)

  return function (done) {

    assertionsFromStream$(yamlTapStream())
      .first()
      .forEach(function (line) {

        t.deepEqual(line.raw, 'ok 1 first assertion has yaml,\n  ---\n    a: b\n  ...', 'raw')
        t.equal(line.type, 'assertion', 'type')
        t.equal(line.title, 'first assertion has yaml,', 'title')
        t.equal(line.ok, true, 'ok')
        t.equal(line.meta.lineNumber, 2, 'lineNumber')
        t.equal(line.meta.assertionNumber, 1, 'assertionNumber')
        t.equal(line.meta.testNumber, 1, 'testNumber')
        t.deepEqual(line.diagnostic, {a: 'b'}, 'diagnostic')
      })
  }
})

test('gets all assertions', function (t) {

  t.plan(2)

  return function () {

    assertionsFromStream$(yamlTapStream())
      .count()
      .forEach(function (count) {t.equal(count, 7, 'count')})

    tapOut.observeStream(yamlTapStream()).assertions$
      .count()
      .forEach(function (count) {t.equal(count, 7, 'count')})
  }
})

test('gets all passing assertions', function (t) {

  t.plan(2)

  return function () {

    assertionsFromStream$(yamlTapStream())
      .filter(function (line) {return line.ok})
      .reduce(function (all, line) {return all.concat(line)}, [])
      .forEach(function (lines) {t.equal(lines.length, 5, 'number of assertions from all')})

    tapOut.observeStream(yamlTapStream()).passingAssertions$
      .reduce(function (all, line) {return all.concat(line)}, [])
      .forEach(function (lines) {t.equal(lines.length, 5, 'number of assertions from helper property')})
  }
})

test('gets all failing assertions', function (t) {

  t.plan(2)

  return function () {

    assertionsFromStream$(yamlTapStream())
      .filter(function (line) {return !line.ok})
      .reduce(function (all, line) {return all.concat(line)}, [])
      .forEach(function (lines) {t.equal(lines.length, 2, 'number of assertions from all')})

    tapOut.observeStream(yamlTapStream()).failingAssertions$
      .reduce(function (all, line) {return all.concat(line)}, [])
      .forEach(function (lines) {t.equal(lines.length, 2, 'number of assertions from helper property')})
  }
})

test('parses yaml in failing assertions', function (t) {

  t.plan(1)

  return function (done) {

    tapOut.observeStream(yamlTapStream()).failingAssertions$
      .first()
      .forEach(function (assertion) {

        t.deepEqual(assertion.diagnostic, {
          operator: 'equal',
          expected: 'you',
          actual: 'me',
          at: 'Test.<anonymous> (/asdf/index.js:8:5)'
        }, 'parsed yaml block')
      })
  }
})

test('parses comment values', function (t) {

  t.plan(4)

  return function () {

    commentsFromStream$(yamlTapStream())
      .first()
      .forEach(function (line) {

        t.deepEqual(line.raw, 'this is a console log', 'raw')
        t.equal(line.type, 'comment', 'type')
        t.equal(line.title, 'this is a console log', 'title')
        t.equal(line.meta.lineNumber, 7, 'lineNumber')
      })
  }
})

test('gets all comments', function (t) {

  t.plan(2)

  return function () {

    commentsFromStream$(yamlTapStream())
      .count()
      .forEach(function (count) {t.equal(count, 1, 'count')})

    tapOut.observeStream(yamlTapStream()).comments$
      .count()
      .forEach(function (count) {t.equal(count, 1, 'count')})
  }
})

test('parses plan values', function (t) {

  t.plan(4)

  return function () {

    plansFromStream$(yamlTapStream())
      .first()
      .forEach(function (line) {

        t.deepEqual(line.raw, '1..7', 'raw')
        t.equal(line.type, 'plan', 'type')
        t.equal(line.from, 1, 'from')
        t.equal(line.to, 7, 'to')
      })
  }
})

test('gets all plans', function (t) {

  t.plan(2)

  return function () {

    plansFromStream$(yamlTapStream())
      .count()
      .forEach(function (count) {t.equal(count, 1, 'count')})

    tapOut.observeStream(yamlTapStream()).plans$
      .count()
      .forEach(function (count) {t.equal(count, 1, 'count')})
  }
})

test('parses version values', function (t) {

  t.plan(2)

  return function () {

    versionsFromStream$(yamlTapStream())
      .first()
      .forEach(function (line) {

        t.deepEqual(line.raw, 'TAP version 13', 'raw')
        t.equal(line.type, 'version', 'type')
      })
  }
})

test('gets all versions', function (t) {

  t.plan(2)

  return function () {

    versionsFromStream$(yamlTapStream())
      .count()
      .forEach(function (count) {t.equal(count, 1, 'count')})

    tapOut.observeStream(yamlTapStream()).versions$
      .count()
      .forEach(function (count) {t.equal(count, 1, 'count')})
  }
})

test('parses result values', function (t) {

  t.plan(2)

  return function () {

    resultsFromStream$(yamlTapStream())
      .reduce(R.concat, [])
      .forEach(function (lines) {

        t.deepEqual(
          lines,
          [ { type: 'result', name: 'tests', count: 7, raw: '# tests 7' },
            { type: 'result', name: 'pass', count: 5, raw: '# pass 5' },
            { type: 'result', name: 'fail', count: 2, raw: '# fail 2' } ],
          'all results'
        )
      })

    tapOut.observeStream(yamlTapStream()).results$
      .reduce(R.concat, [])
      .forEach(function (lines) {

        t.deepEqual(
          lines,
          [ { type: 'result', name: 'tests', count: 7, raw: '# tests 7' },
            { type: 'result', name: 'pass', count: 5, raw: '# pass 5' },
            { type: 'result', name: 'fail', count: 2, raw: '# fail 2' } ],
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

function filterTypeInObservable$ (stream, type) {

    return tapOut.observeStream(stream)
    .filter(R.pipe(R.path(['type']), R.equals(type)))
}

function testsFromStream$ (source) {

  return filterTypeInObservable$(source, 'test')
}

function assertionsFromStream$ (source) {

  return filterTypeInObservable$(source, 'assertion')
}

function commentsFromStream$ (source) {

  return filterTypeInObservable$(source, 'comment')
}

function plansFromStream$ (source) {

  return filterTypeInObservable$(source, 'plan')
}

function versionsFromStream$ (source) {

  return filterTypeInObservable$(source, 'version')
}

function resultsFromStream$ (source) {

  return filterTypeInObservable$(source, 'result')
}

