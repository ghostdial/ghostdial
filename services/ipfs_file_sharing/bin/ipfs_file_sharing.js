#!/usr/bin/env node

const infura = new (require("ipfs-deploy/src/pinners/infura"))();
const morgan = require('morgan');
const redis = new (require("ioredis"))();
const ethers = require('ethers');

const https = require("https");
const crypto = require('crypto');
const fs = require("fs");
require('request-debug')(require('request'));
const express = require("express");

const app = express();

const jwt = require("express-jwt");

const {
  createEncryptStream,
  createDecryptStream,
} = require("../lib/aes-stream");
const request = require('request');

app.use(morgan('tiny'));

const algorithm = 'aes-256-ctr';

app.put(
  "/upload/:slot/:filename",
  jwt({ algorithms: ["HS256"], secret: process.env.HTTP_FILE_SHARE_SECRET }),
  (req, res) => {
    //NOTE: slot now being used as our key entry-point secret
    let secret = Buffer.from(ethers.utils.solidityKeccak256(['string', 'string'], [ process.env.HTTP_FILE_SHARE_SECRET, req.params.slot ]).substr(2), 'hex');
    console.log('secret: ' + secret);
    (async () => {
      try {
        console.log("uploading stream");
        const encryptStream = crypto.createCipheriv(algorithm, secret, secret.slice(0, 16));
        let contentLength = 0;
        req.on('data', (chunk) => {
          contentLength += chunk.length;
        });
        const result = await infura.ipfs.add(
          { path: req.params.filename, content: req.pipe(encryptStream) },
          { pin: true }
        );
        console.log(JSON.stringify(result));
        console.log("uploaded " + result.cid);
        await redis.set(req.params.slot, result.cid);
        await redis.set(req.params.slot + '.length', contentLength);
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
/*

app.head('/upload/:slot/:filename', async (req, res) => {
  console.log('HEAD attempt');
  const cid = await redis.get(req.params.slot);
  console.log("cid: " + cid);
  console.log(req.params.filename);
  const contentLength = await redis.get(req.params.slot + '.length');
  res.setHeader('Content-Length', contentLength);
  res.setHeader('content-length', contentLength);
  res.sendStatus(201);
  res.end();
});
*/


app.get("/upload/:slot/:filename", (req, res) => {
  (async () => {
    let secret = Buffer.from(ethers.utils.solidityKeccak256(['string', 'string'], [ process.env.HTTP_FILE_SHARE_SECRET, req.params.slot ]).substr(2), 'hex');
    console.log('GET attempt');
    console.log("secret: " + secret);
    const cid = await redis.get(req.params.slot);
    console.log("cid: " + cid);
    console.log(req.params.filename);
    res.setHeader('Content-Length', await redis.get(req.params.slot + '.length'));
    const decryptStream = crypto.createDecipheriv(algorithm, secret, secret.slice(0, 16));
    const stream = request({
      url: 'https://cloudflare-ipfs.com/ipfs/' + cid,
      qs: {
        filename: req.params.filename
      },
      method: 'GET'
    }).pipe(decryptStream).pipe(res);
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
