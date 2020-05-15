#!/usr/bin/env node

const tapOut = require("../");

const parser = tapOut(function (err, output) {
  if (err) {
    throw err;
  }

  let out = output;

  try {
    out = JSON.stringify(output, null, 2);
  } catch (e) {
    console.error(e);
  }

  process.stdout.write(out);
});

process.stdin.pipe(parser);
