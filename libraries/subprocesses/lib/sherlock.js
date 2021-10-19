'use strict';

const path = require('path');
const child_process = require('child_process');
const stream = require('./stream');

module.exports = async function sherlock(username, onData = () => {}) {
  const subprocess = child_process.spawn(
    "python3",
    [
      path.join(process.env.HOME, "sherlock", "sherlock", "sherlock.py"),
      "--print-found",
      username,
    ],
    { stdio: "pipe" }
  );
  return await stream.streamStdout(subprocess, onData);
};
