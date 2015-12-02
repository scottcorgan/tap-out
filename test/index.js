var fs = require('fs')
var tapOut = require('../')
var namespace = require('tessed').namespace
var R = require('ramda')
var H = require('highland')

// var parsed = tapStream
//   .pipe(tapOut.stream())
//   .pipe(process.stdout)

// tapOut.observeStream(yamlTapStream())
//   .forEach(console.log.bind(console))

testStream = namespace('stream')

testStream('parses test values', function (t) {

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
      .done(done)
  }
})

testStream('gets all tests', function (t) {

  var count = 0

  return function (done) {

    testsFromStream(yamlTapStream())
      .each(function (line) {count += 1})
      .done(function () {

        t.equal(count, 3, 'test count')
        done()
      })
  }
})

testStream('parses assertion values', function (t) {

  return function (done) {


    done()
  }
})

















function yamlTapStream () {

  return fs.createReadStream(__dirname + '/fixtures/yaml.txt')
}

function basicTapStream () {

  return fs.createReadStream(__dirname + '/fixtures/basic.txt')
}

function testsFromStream (stream) {

  return H(stream.pipe(tapOut.stream()))
    .map(JSON.parse)
    .filter(R.pipe(R.path(['type']), R.equals('test')))
}
