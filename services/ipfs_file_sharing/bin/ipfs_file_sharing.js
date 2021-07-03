#!/usr/bin/env node
"use strict";

const infura = new (require("ipfs-deploy/src/pinners/infura"))();
const morgan = require('morgan');
const redis = new (require("ioredis"))();

const https = require("https");
const fs = require("fs");
const express = require("express");

const app = express();
const jwt = require("express-jwt");
const {
  createEncryptStream,
  createDecryptStream,
} = require("../lib/aes-stream");
const request = require('request');

app.use(morgan('tiny'));

app.put(
  "/upload/:slot/:filename",
  jwt({ algorithms: ["HS256"], secret: process.env.HTTP_FILE_SHARE_SECRET }),
  (req, res) => {
    console.log('secret: ' + req.headers.secret);
    (async () => {
      try {
        console.log("uploading stream");
        const result = await infura.ipfs.add(
          { path: req.params.filename, content: createEncryptStream(req, req.headers.secret) },
          { pin: true }
        );
        console.log(JSON.stringify(result));
        console.log("uploaded " + result.cid);
        await redis.set(req.params.slot, result.cid);
        res.sendStatus(201);
        res.end();
      } catch (e) {
        console.error(e);
        res.sendStatus(500);
        res.end();
      }
    })();
  }
);

app.get("/upload/:slot/:filename", (req, res) => {
  (async () => {
    console.log("get secret: " + req.headers.secret);
    const cid = await redis.get(req.params.slot);
    console.log("cid: " + cid);
    console.log(req.params.filename);
    createDecryptStream(request({
      url: 'https://ipfs.io/ipfs/' + cid,
      qs: {
        filename: req.params.filename
      },
      method: 'GET'
    }), req.headers.secret).pipe(res);
  })().catch((err) => console.error(err));
});

const server = https.createServer(
  {
    key: fs.readFileSync(process.env.TLS_PRIVATE_KEY),
    cert: fs.readFileSync(process.env.TLS_CERTIFICATE),
  },
  app
);

server.listen(process.env.PORT || 8443, (err) => {
  if (err) return console.error(err);
  console.log('server listening');
});
