#!/usr/bin/env node

var tapOut = require('../')

process.stdin
  .pipe(tapOut.stream())
  .pipe(process.stdout)
