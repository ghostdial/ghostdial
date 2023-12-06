'use strict';

const utils = require('./utils');
const child_process = require('child_process');
const path = require('path');

exports.socialscan = async function socialscan(username) {
  await utils.mkTmp();
  const subprocess = child_process.spawn(
    "socialscan",
    ["--json", path.join(utils.tmpdir, username + ".json"), username],
    { stdio: "pipe" }
  );
  const stdout = await new Promise((resolve, reject) => {
    let data = "";
    subprocess.on("exit", (code) => {
      if (code !== 0) return reject(Error("non-zero exit code"));
      resolve(utils.readResult(username));
    });
  });
  return stdout;
}
