#!/usr/bin/env node

const infura = new (require("ipfs-deploy/src/pinners/infura"))();
const morgan = require('morgan');
const redis = new (require("ioredis"))();
const ethers = require('ethers');
const path = require('path');
const mime = require('mime-types');

const https = require("https");
const crypto = require('crypto');
const fs = require("fs-extra");
require('request-debug')(require('request'));
const express = require("express");

const app = express();

const jwt = require("express-jwt");

const {
  createEncryptStream,
  createDecryptStream,
} = require("../lib/aes-stream");
const { PassThrough } = require('stream');
const mkdirp = require('mkdirp');
const request = require('request');

app.use(morgan('tiny'));

const algorithm = 'aes-256-ctr';

const HTTP_FILE_SHARE_DIRECTORY = process.env.HTTP_FILE_SHARE_DIRECTORY;
const HTTP_FILE_SHARE_SECRET = process.env.HTTP_FILE_SHARE_SECRET;

app.put(
  "/upload/:slot/:filename",
  jwt({ algorithms: ["HS256"], secret: HTTP_FILE_SHARE_SECRET }),
  (req, res) => {
    //NOTE: slot now being used as our key entry-point secret
    let secret = Buffer.from(ethers.utils.solidityKeccak256(['string', 'string'], [ HTTP_FILE_SHARE_SECRET, req.params.slot ]).substr(2), 'hex');
    console.log('secret: ' + secret);
    (async () => {
      try {
        console.log("uploading stream");
        const encryptStream = crypto.createCipheriv(algorithm, secret, secret.slice(0, 16));
        let contentLength = 0;
	      /*
        const [ one, two, three ] = Array(3).fill(0).map((v) => new PassThrough());
        [ one, two, three ].forEach((v) => req.pipe(v));
        one.on('data', (chunk) => {
	  console.log('chunk', chunk);
	  console.log('chunk.length', chunk.length);
          contentLength += chunk.length;
        });
	*/
//	req.pipe(toEncrypt);
//        const encrypted = toEncrypt.pipe(encryptStream);
    //    encrypted.pipe(toFile);
//        encrypted.pipe(toIPFS);
	              /*
        const filename = ethers.utils.solidityKeccak256(['bytes'], [ secret ]).substr(2);
	      console.log(path.join(HTTP_FILE_SHARE_DIRECTORY, filename));
	      */
  //      const fileStream = fs.createWriteStream(path.join(HTTP_FILE_SHARE_DIRECTORY, filename));
 //       toFile.pipe(fileStream);
        const result = await infura.ipfs.add(
          { path: req.params.filename, content: req.pipe(encryptStream) },
          { pin: true }
        );
        console.log(JSON.stringify(result));
        console.log("uploaded " + result.cid);
	      console.log('contentLength', contentLength);
        if (result.cid) await redis.set(req.params.slot, result.cid);
	      /*
        if (result.cid) await redis.set(req.params.slot + '.length', contentLength);
	*/

        await new Promise((resolve, reject) => setTimeout(resolve, 1000));
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

const TIMEOUT = process.env.IPFS_FILE_SHARING_TIMEOUT || 30000;

app.get("/upload/:slot/:filename", (req, res) => {
  const slot = req.params.slot;
  (async () => {
    let secret = Buffer.from(ethers.utils.solidityKeccak256(['string', 'string'], [ HTTP_FILE_SHARE_SECRET, req.params.slot ]).substr(2), 'hex');
    const filename = ethers.utils.solidityKeccak256(['bytes'], [ secret ]).substr(2);
    console.log('GET attempt');
    console.log("secret: " + secret);
    const cid = await redis.get(req.params.slot);
    console.log("cid: " + cid);
    const decryptStream = crypto.createDecipheriv(algorithm, secret, secret.slice(0, 16));
    let shouldLoadFromFs;
	  /*
    try {
 //     if (isNaN(contentLength) || contentLength === 0) shouldLoadFromFs = true;
    } catch (e) {
   //   console.error(e);
    //  shouldLoadFromFs = true;
    }
    */
    const fullPath = path.join(HTTP_FILE_SHARE_DIRECTORY, filename);
	  /*
    res.setHeader('content-type', mime.lookup(req.params.filename));
    res.setHeader('content-length', await redis.get(req.params.slot + '.length'));
    res.setHeader('Content-Type', mime.lookup(req.params.filename));
    res.setHeader('Content-Length', await redis.get(req.params.slot + '.length'));
    */
    const stream = request({
      url: 'https://ipfs.io/ipfs/' + cid + '?filename=' + req.params.filename,
      method: 'GET'
    });
	  /*
    stream.on('error', (err) => {
	    console.error(err);
      const fileStream = fs.createReadStream(fullPath);
      fileStream.on('error', (err) => {
        console.error(err);
        res.end();
      });
      fileStream.pipe(decryptStream).pipe(res);
    });
    */
    const headers = Object.entries(await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('response', (v) => { resolve(v.headers); });
    }));
    headers.forEach(([ key, value ]) => res.setHeader(key, value));
    stream.pipe(decryptStream.pipe(res));
	    /*
      await new Promise((resolve) => setTimeout(resolve, TIMEOUT));
      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (e) { console.error(e); }
      if (shouldLoadFromFs) {
        if (!await fs.exists(fullPath)) shouldLoadFromFs = false;
      }
      */
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
