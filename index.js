'use strict'

var Rx = require('rx')
var RxNode = require('rx-node')
var R = require('ramda')
var PassThrough = require('readable-stream/passthrough')
var split = require('split')

var O = Rx.Observable
var Subject = Rx.Subject

var TEST = 'TEST'
var ASSERTION = 'ASSERTION'
var PLAN = 'PLAN'
var VERSION = 'VERSION'
var COMMENT_BLOCK_START = 'COMMENT_BLOCK_START'
var COMMENT_BLOCK_END = 'COMMENT_BLOCK_END'

var REGEXES = {
  assertion: new RegExp('^(not )?ok\\b(?:(?:\\s+(\\d+))?(?:\\s+(?:(?:\\s*-\\s*)?(.*)))?)?'),
  result: new RegExp('(#)(\\s+)((?:[a-z][a-z]+))(\\s+)(\\d+)',['i']),
  plan: /^(\d+)\.\.(\d+)\b(?:\s+#\s+SKIP\s+(.*)$)?/,
  comment: /^#\s*(.+)/,
  version: /^TAP\s+version\s+(\d+)/i,
  todo: /^(.*?)\s*#\s*TODO\s+(.*)$/
}

function getGroupedLines (input$) {

  return input$
    .startWith(null)
    .pairwise()
    .map(formatLinePair)
}

function getAssertions (input$) {

  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(ASSERTION)
    ))
}

function getCommentBlockStart (input$) {

  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(COMMENT_BLOCK_START)
    ))
}

function getCommentBlockEnd (input$) {

  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(COMMENT_BLOCK_END)
    ))
}

function getAssertionsWithComments (assertions$, blocks$) {

  return assertions$
    .filter(R.pipe(
      R.path(['next', 'type']),
      R.equals(COMMENT_BLOCK_START)
    ))
    .flatMap(function (line) {

      return blocks$.take(1)
        .map(function (block) {

          return {
            raw: line.current.raw,
            meta: {
              block: block
            }
          }
        })
    })
}

function getCommentBlocks (formattedLines$, start$, end$) {

  var parsingCommentBlock = false
  var currentCommentBlock = []

  formattedLines$
    .forEach(function (line) {

      if (parsingCommentBlock) {
        currentCommentBlock.push(line)
      }
      else {
        currentCommentBlock = []
      }
    })

  start$
    .forEach(function () {

      parsingCommentBlock = true
    })

  return  end$
    .map(function (line) {

      parsingCommentBlock = false

      return R.pipe(
        R.map(R.path(['current', 'raw'])),
        R.flatten
      )(currentCommentBlock)
    })
}

function getFormattedTests (input$) {

  return input$
    .filter(R.pipe(
      R.path(['current', 'type']),
      R.equals(TEST)
    ))
    .map(function (line) {

      return formatTestObject(line.current.raw, line.current.number)
    })
}

function getFormattedAssertions (assertions$, commentBlocks$) {

  var assertionsWithComments$ = getAssertionsWithComments(assertions$, commentBlocks$)

  return assertions$
    .filter(R.pipe(
      R.path(['next', 'type']),
      R.complement(R.equals(COMMENT_BLOCK_START))
    ))
    .map(R.pipe(
      R.path(['current']),
      R.pick(['raw']),
      R.merge({meta: {}})
    ))
    .merge(assertionsWithComments$)
    // .map(/* format for output here */)
}

function getTestsWithAssertions (input$) {

  var tests$ = new Subject()
  tests$.assertions$ = new Subject()

  var formattedLines$ = getGroupedLines(input$)
  var assertions$ = getAssertions(formattedLines$)
  var commentBlockStart$ = getCommentBlockStart(formattedLines$)
  var commentBlockEnd$ = getCommentBlockEnd(formattedLines$)
  var commentBlocks$ = getCommentBlocks(formattedLines$, commentBlockStart$, commentBlockEnd$)
  var formattedTests$ = getFormattedTests(formattedLines$)
  var formattedAssertions$ = getFormattedAssertions(assertions$, commentBlocks$)

  formattedTests$.forEach(tests$)
  formattedAssertions$.forEach(tests$.assertions$)

  return tests$
}

module.exports = function run () {

  var stream = new PassThrough()
  var tap$ = RxNode.fromStream(stream.pipe(split()))

  var plans$ = getPlans(tap$)
  var versions$ = getVerions(tap$)
  var tests$ = getTestsWithAssertions(tap$)
  var assertions$ = tests$.assertions$
  // var passingAssertions$ = assertions$.filter(function (a) { return a.ok })
  // var failingAssertions$ = assertions$.filter(function (a) { return !a.ok })

  stream.tests$ = tests$
  stream.assertions$ = assertions$
  stream.plans$ = plans$
  stream.versions$ = versions$
  // stream.passingAssertions$ = passingAssertions$
  // stream.failingAssertions$ = failingAssertions$
  // stream.comments$
  // stream.results$

  return stream
}


function formatLinePair (pair, index) {

  return {
    current: {
      raw: [pair[0]],
      type: getLineType(pair[0]),
      number: index
    },
    next: {
      raw: [pair[1]],
      type: getLineType(pair[1]),
      number: index + 1
    }
  }
}

function getPlans (tap$) {

  return tap$.filter(isPlan)
}

function getVerions (tap$) {

  return tap$.filter(isVersion)
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

  if (line === null || line === undefined) {
    return false
  }

  return line.indexOf('  ---') === 0
}

function isCommentBlockEnd (line) {

  if (line === null || line === undefined) {
    return false
  }

  return line.indexOf('  ...') === 0
}

function isAssertion (line) {

  return REGEXES.assertion.test(line)
}

function getLineType (line) {

  if (isTest(line)) {
    return TEST
  }

  if (isAssertion(line)) {
    return ASSERTION
  }

  if (isPlan(line)) {
    return PLAN
  }

  if (isVersion(line)) {
    return VERSION
  }

  if (isCommentBlockStart(line)) {
    return COMMENT_BLOCK_START
  }

  if (isCommentBlockEnd(line)) {
    return COMMENT_BLOCK_END
  }
}

function formatTestObject (line, num) {

  return {
    raw: line,
    type: 'test',
    title: line.map(R.replace('# ', '')),
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
