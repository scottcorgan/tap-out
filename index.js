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

function getAssertions (tap$) {

  var assertionBuffer = []
  var parsingCommentBlock = false
  var shouldOneNext = false
  var assertions$ = new Subject()

  function isCommentBlockStart (line) {

    return line.indexOf('  ---') === 0
  }

  function isCommentBlockEnd (line) {

    return line.indexOf('  ...') === 0
  }

  function isAssertion (line) {

    return REGEXES.assertion.test(line)
  }

  tap$
    .forEach(
      function (line) {

        if (isCommentBlockEnd(line)) {
          parsingCommentBlock = false
          assertionBuffer.push(line)
          shouldOneNext = true
          return
        }

        if (parsingCommentBlock) {
          assertionBuffer.push(line)
          return
        }

        if (isAssertion(line) || shouldOneNext) {
          if (assertionBuffer.length > 0) {
            assertions$.onNext(assertionBuffer)
            shouldOneNext = false
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
      assertions$.onError,
      assertions$.onCompleted
    )

  return assertions$
}

function getTests (tap$) {

  return tap$
    .filter(function (line) {

      return REGEXES.comment.test(line)
        && line.indexOf('# tests') < 0
        && line.indexOf('# pass') < 0
        && line.indexOf('# fail') < 0
    })
}

function getPlans (tap$) {

  return tap$.filter(function (line) {

    return REGEXES.plan.test(line)
  })
}

function getVerions (tap$) {

  return tap$.filter(function (line) {

    return REGEXES.version.test(line)
  })
}

module.exports = function run () {

  var stream = new PassThrough()
  var tap$ = RxNode.fromStream(stream.pipe(split()))

  var plans$ = getPlans(tap$)
  var versions$ = getVerions(tap$)
  var tests$ = getTests(tap$)
  var assertions$ = getAssertions(tap$)
  var passingAssertions$ = assertions$
    .filter(function (assertion) {

      return !REGEXES.assertion.exec(assertion[0])[1]
    })
  var failingAssertions$ = assertions$
    .filter(function (assertion) {

      return REGEXES.assertion.exec(assertion[0])[1]
    })




  // tap$
  //   .forEach(console.log.bind(console))

  return stream
}
