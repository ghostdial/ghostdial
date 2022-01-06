'use strict';

const utils = require('./utils');
const path = require('path');
const child_process = require('child_process');

exports.stripUsed = (s) => {
  return s
    .split("\n")
    .filter((v) => v.match("[+]"))
    .join("\n");
};

exports.holehe = async function holehe(username) {
  const subprocess = child_process.spawn(
    "holehe",
    [username, "--only-used", "--no-color"],
    { stdio: "pipe" }
  );
  const stdout = await new Promise((resolve, reject) => {
    let data = "";
    subprocess.stdout.setEncoding("utf8");
    subprocess.stdout.on("data", (v) => {
      data += v;
    });
    subprocess.on("exit", (code) => {
      if (code !== 0) return reject(Error("non-zero exit code"));
      resolve(data);
    });
  });
  return exports.stripUsed(stdout);
};
