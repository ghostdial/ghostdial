#!/usr/bin/env node
'use strict';

const yargs = require('yargs');
const { makeLongTranscript: makeTranscript } = require('@ghostdial/voicemail_pipeline/lib/get-transcript');
const redis = new (require('ioredis'))();
const [ filepath ] = yargs.argv._;
const path = require('path');
const base = path.parse(filepath).base;

(async () => {
  const cached = await redis.get(base);
  if (cached) return console.log(cached);
  const transcript = await makeTranscript(filepath);
  console.log(transcript);
  await redis.set(base, transcript); 
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
