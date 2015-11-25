'use strict'

var Rx = require('rx')
var RxNode = require('rx-node')
var PassThrough = require('readable-stream/passthrough')
var split = require('split')

var O = Rx.Observable
var Subject = Rx.Subject

var REGEXES = {
  assertion: new RegExp('^(not )?ok\\b(?:(?:\\s+(\\d+))?(?:\\s+(?:(?:\\s*-\\s*)?(.*)))?)?'),
  result: new RegExp('(#)(\\s+)((?:[a-z][a-z]+))(\\s+)(\\d+)',['i']),
  plan: /^(\d+)\.\.(\d+)\b(?:\s+#\s+SKIP\s+(.*)$)?/,
  comment: /^#\s*(.+)/,
  version: /^TAP\s+version\s+(\d+)/i,
  todo: /^(.*?)\s*#\s*TODO\s+(.*)$/
}

function getTestsWithAssertions (tap$) {

  var tests$ = new Subject()
  tests$.assertions$ = new Subject()
  var currentTest
  var assertionBuffer = []
  var currentTestNum = 0
  var parsingCommentBlock = false
  var shouldOnNext = false

  tap$
    .forEach(
      function (line) {

        if (isTest(line)) {
          if (currentTest) {
            currentTest.assertions$.onCompleted()
          }
          currentTestNum += 1
          currentTest = formatTestObject(line, currentTestNum)
          tests$.onNext(currentTest)
          return
        }

        if (isCommentBlockEnd(line)) {
          parsingCommentBlock = false
          assertionBuffer.push(line)
          shouldOnNext = true
          return
        }

        if (parsingCommentBlock) {
          assertionBuffer.push(line)
          return
        }

        if (isAssertion(line) || shouldOnNext) {

          // Probably in a assertion meta block
          if (assertionBuffer.length > 0) {
            var assertion = formatAssertionObject(assertionBuffer, currentTestNum)
            tests$.assertions$.onNext(assertion)
            currentTest.assertions$.onNext(assertion)
            shouldOnNext = false
            assertionBuffer = []
          }

          assertionBuffer.push(line)
          return
        }

        if (isCommentBlockStart(line)) {
          parsingCommentBlock = true
          assertionBuffer.push(line)
        }
      },
      tests$.onError,
      tests$.onCompleted
    )

  return tests$
}

function getPlans (tap$) {

  return tap$.filter(isPlan)
}

function getVerions (tap$) {

  return tap$.filter(isVersion)
}




module.exports = function run () {

  var stream = new PassThrough()
  var tap$ = RxNode.fromStream(stream.pipe(split()))

  var plans$ = getPlans(tap$)
  var versions$ = getVerions(tap$)
  var tests$ = getTestsWithAssertions(tap$)
  var assertions$ = tests$.assertions$
  var passingAssertions$ = assertions$.filter(function (a) { return a.ok })
  var failingAssertions$ = assertions$.filter(function (a) { return !a.ok })

  stream.tests$ = tests$
  stream.assertions$ = assertions$
  stream.plans$ = plans$
  stream.versions$ = versions$
  stream.passingAssertions$ = passingAssertions$
  stream.failingAssertions$ = failingAssertions$
  // stream.comments$
  // stream.results$

  return stream
}




function isTest (line) {

  return REGEXES.comment.test(line)
    && line.indexOf('# tests') < 0
    && line.indexOf('# pass') < 0
    && line.indexOf('# fail') < 0
}

function isPlan (line) {

  return REGEXES.plan.test(line)
}

function isVersion (line) {

  return REGEXES.version.test(line)
}

function isCommentBlockStart (line) {

  return line.indexOf('  ---') === 0
}

function isCommentBlockEnd (line) {

  return line.indexOf('  ...') === 0
}

function isAssertion (line) {

  return REGEXES.assertion.test(line)
}

function formatTestObject (line, num) {

  return {
    raw: line,
    type: 'test',
    title: line.replace('# ', ''),
    number: num,
    assertions$: new Subject()
  }
}

function formatAssertionObject (assertion, testNum) {

  var m = REGEXES.assertion.exec(assertion[0])
  var rawMeta = assertion.slice(1)
  var meta = rawMeta
    .filter(function (line, idx) {

      return idx !== 0 && idx !== rawMeta.length - 1
    })
    .map(function (line) {

      return line.trim()
    })
    .reduce(function (accum, line) {

      var arr = line.split(': ')
      var key = arr[0].trim()
      var value = arr[1].trim()

      accum[key] = value
      return accum
    }, {})

  return {
    type: 'assertion',
    title: m[3],
    raw: assertion.join('\n'),
    test: testNum,
    ok: !m[1],
    number: m[2] && Number(m[2]),
    meta: meta
  }
}
