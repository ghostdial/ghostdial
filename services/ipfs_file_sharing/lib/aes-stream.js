const crypto = require("crypto");
const { Transform, Stream, Writable } = require("stream");
const ethers = require("ethers");

const algorithm = "aes-256-ctr";

function createEncryptStream(input, password) {
  let passwordLocal = Buffer.from(
    ethers.utils.solidityKeccak256(["string"], [password]).substr(2),
    "hex"
  );
  const iv = crypto.randomBytes(16);
  const encryptStream = crypto.createCipheriv(algorithm, passwordLocal, iv);
  let inited = false;
  return input.pipe(encryptStream).pipe(
    new Transform({
      transform(chunk, encoding, callback) {
        if (!inited) {
          inited = true;
          this.push(Buffer.concat([iv, chunk]));
        } else {
          this.push(chunk);
        }
        callback();
      },
    })
  );
}

function createDecryptStream(output, password) {
  let passwordLocal = Buffer.from(
    ethers.utils.solidityKeccak256(["string"], [password]).substtr(2),
    "hex"
  );

  let iv;
  return new Transform({
    transform(chunk, encoding, callback) {
      if (!iv) {
        iv = chunk.slice(0, 16);
        const decryptStream = crypto.createDecipheriv(
          algorithm,
          passwordLocal,
          iv
        );
        this.pipe(decryptStream).pipe(output);
        this.push(chunk.slice(16));
      } else {
        this.push(chunk);
      }
      callback();
    },
  });
}

Object.assign(module.exports, {
  createEncryptStream,
  createDecryptStream,
});
