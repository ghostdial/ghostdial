const crypto = require("crypto");
const { Transform, Stream, Writable } = require("stream");
const ethers = require("ethers");

const algorithm = "aes-256-ctr";

function generatePassword(secret) {
  const ghostgen = (n) => {
    return Array(n).fill().reduce((r, v) => ethers.utils.solidityKeccak256(['string'], 
      [process.env.HTTP_FILE_SHARE_SECRET + r]), secret); 
  };
  return Buffer.from(ghostgen(64).substr(2), "hex");
} 

function createEncryptStream(input, secret) {
  const passwordLocal = generatePassword(secret);
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

function createDecryptStream(output, secret) {
  const passwordLocal = generatePassword(secret);

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
    }
  });
}

Object.assign(module.exports, {
  createEncryptStream,
  createDecryptStream,
});
