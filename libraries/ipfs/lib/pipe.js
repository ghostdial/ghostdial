'use strict';

const infura = new (require('ipfs-deploy/src/pinners/infura'))();

const request = require('request');
const url = require('url');
const path = require('path');

exports.pipeToIPFS = async (url) => {
  const { pathname } = url.parse(url);
  const { base } = path.parse(pathname);
  const req = request.get(url);
  const { cid } = await infura.ipfs.add({
    content: req,
    filename: base,
    pin: true
  });
  return 'https://cloudflare-ipfs.com/ipfs/' + cid + '?filename=' + base;
};
