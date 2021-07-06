#!/usr/bin/env node
'use strict';

const yargs = require('yargs');

const [ query, size ] = yargs.argv._;
const { from, raw } = yargs.argv;

const scrollToken = yargs.argv['scroll-token']
const peopledatalabs = new (require('../lib/peopledatalabs'))();
const util = require('util');


(async () => {
  const result = await peopledatalabs.personSearch({
    sql: query,
    size: Number(size) || 1,
    from,
    scroll_token: scrollToken
  });
  if (!raw) console.log(util.inspect(result, { colors: true }));
  else console.log(JSON.stringify(result, null, 2));
})().catch((err) => console.error(err));
