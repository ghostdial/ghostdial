'use strict';

const { startDossi } = require('../lib/dossi');

(async () => {
  await startDossi();
})().catch(console.error);

/* cryptoStorage must be deleted before each restart so the bot can build it */
