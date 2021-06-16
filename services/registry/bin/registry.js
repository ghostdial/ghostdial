'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const redis = new (require('ioredis'))();

const app = express();

app.use(bodyParser.json({ extended: true }));

app.post('/resolve', (req, res) => {
  (async () => {
    try {
      const { number } = req.body;
      const result = await redis.get('lookup.' + String(number));
      if (result) {
        res.json({
          status: 'success',
          result
        });
      } else {
        res.setStatus(404);
        res.json({
          status: 'error',
          error: 'not_found'
        });
      }
    } catch (e) {
      console.error(e);
      res.setStatus(500);
      res.json({
        status: 'error',
        error: 'server_error'
      });
    }
  })();
});

app.listen(process.env.PORT || 3050, process.env.HOST || '127.0.0.1');
