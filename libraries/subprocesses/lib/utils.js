'use strict';

const mkdirp = require('mkdirp');
const tmpdir = require("tmpdir");
const path = require('path');
const fs = require('fs-extra');

exports.tmpdir = tmpdir;

exports.readResult = async (query) => {
  const result = JSON.parse(
    (await fs.readFile(path.join(tmpdir, query + ".json"), "utf8")).trim()
  );
  return result;
};

exports.readResultRaw = async (query) => {
  const result = (
    await fs.readFile(path.join(tmpdir, query + ".json"), "utf8")
  ).trim();
  return result;
};

exports.mkTmp = async () => {
  await mkdirp(tmpdir);
};
