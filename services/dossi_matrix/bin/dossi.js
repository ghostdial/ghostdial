'use strict';

const { startDossi } = require('../lib/dossi');

(async () => {
  await startDossi();
})().catch(console.error);


