'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');

const app = express();
app.use(bodyParser.json({ extended: true }));

app.all('/message', (req, res) => {
  console.log(req.headers);
  console.log(req,body);
  res.json({ success: true });
});

const server = https.createServer({
  key: fs.readFileSync(process.env.TLS_PRIVATE_KEY, 'utf8'),
  cert: fs.readFileSync(process.env.TLS_CERTIFICATE, 'utf8')
}, app);

server.listen(3550, '0.0.0.0', (err) => {
  console.error(err);
});

