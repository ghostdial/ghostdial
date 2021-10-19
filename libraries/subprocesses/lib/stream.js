'use strict';

exports.streamStdout = async (subprocess, onData = () => {}) => await new Promise((resolve, reject) => {
  let data = "";
  subprocess.stdout.setEncoding("utf8");
  subprocess.stderr.setEncoding("utf8");
  subprocess.stderr.on("data", (v) => {
    if (process.env.NODE_ENV === 'development') process.stderr.write(v);
  });
  subprocess.stdout.on("data", (v) => {
    if (process.env.NODE_ENV === 'development') process.stdout.write(v);
    onData(v);
    data += v;
  });
  subprocess.on("exit", (code) => {
    if (code !== 0) return reject(Error("non-zero exit code"));
    resolve(data);
  });
});
