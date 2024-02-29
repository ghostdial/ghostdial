const { run, logger } = require('../lib');

(async () => {
  await run();
})().catch((err) => logger.error(err));
