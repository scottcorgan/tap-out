#!/usr/bin/env node

var tapOut = require('../');

var parser = tapOut(function (err, output) {
  
  process.stdout.write(JSON.stringify(output, null, 2));
});

process.stdin.pipe(parser);
