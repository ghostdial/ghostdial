#!/usr/bin/env node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const url = require('url');
const lodash = require('lodash');
const fs = require('fs');
const debug = require('@xmpp/debug');
const path = require('path');
const mkdirp = require('mkdirp');
const { client, xml } = require('@xmpp/client');

const voicemailDirectory = process.env.VOICEMAIL_DIRECTORY || '/var/spool/asterisk/voicemail/default';

const yargs = require('yargs');
const filename = yargs.argv._[0];
const bucketName = (process.env.DOMAIN || 'ghostdial.net').replace(/\./g, '-') + '-voicemail';

const getCallerID = (data) => {
  return data.match(/callerid=(.*)$/m)[1];
};

const toParcel = (extension, messageBasename) => {
  const callerid = getCallerID(fs.readFileSync(path.join(voicemailDirectory, extension, 'INBOX', messageBasename + '.txt'), 'utf8'));
  let did;
  try {
    did = fs.readFileSync(path.join(voicemailDirectory, extension, 'did.txt'), 'utf8').trim();
  } catch (e) {
    console.error(e);
    did = extension;
  }
  return {
    callerid,
    did,
    extension,
    filepath: path.join(voicemailDirectory, extension, 'INBOX', messageBasename + '.wav'),
    name: messageBasename
  };
};

const xmpp = client({
  service: process.env.DOMAIN,
  resource: 'voicemail',
  username: 'voicemail',
  password: process.env.ROOT_PASSWORD || 'password'
});

debug(xmpp, true);
  

const { getTranscript } = require('../lib/get-transcript');

const processBox = async (extension) => {
  await mkdirp(path.join(voicemailDirectory, extension, 'INBOX'));
  const parcels = lodash.uniqBy(fs.readdirSync(path.join(voicemailDirectory, extension, 'INBOX')), (v) => path.parse(v).name).map((v) => toParcel(extension, path.parse(v).name));
  for (const message of parcels) {
    console.log('processing ' + message.name + ' for ' + message.extension);
    await getTranscript(message);
    console.log('got transcript')
    await uploadToIPFS(message);
    console.log('uploaded to ipfs');
    const to = message.did + '@' + process.env.DOMAIN;
    const from = 'voicemail@' + process.env.DOMAIN;
    console.log(message);
    console.log({ to, from });
    await xmpp.send(xml('presence', { to, from }));
    await xmpp.send(xml('message', { to, from }, xml('body', {}, 'New voicemail from ' + message.callerid + ':\n' + (message.transcript || '<no transcript could be loaded>'))));
    await xmpp.send(xml('message', { to, from }, [ xml('body', {}, message.pinned), xml('x', { xmlns: 'jabber:x:oob' }, xml('url', {}, message.pinned)) ]));
  }
};

const getExtensions = () => fs.readdirSync(voicemailDirectory);
  

const processBoxes = async () => {
  const extensions = getExtensions();
  for (const extension of extensions) {
    await processBox(extension);
    await cleanBox(extension);
  }
};


const spawnSync = require('child_process').spawnSync;

const infura = new (require('ipfs-deploy/src/pinners/infura'))({ projectId: process.env.INFURA_PROJECT_ID, projectSecret: process.env.INFURA_PROJECT_SECRET });
const uploadToIPFS = async (v) => {
  const cwd = process.cwd();
  const { dir, name, ext } = path.parse(v.filepath);
  const { cid } = await infura.ipfs.add(fs.readFileSync(v.filepath));
  const result = await infura.pinCid(cid);
  v.pinned = 'https://ipfs.io/ipfs/' + cid + '?filename=' + name + '.wav';
  return v;
};

const cleanBox = (extension) => {
  const files = fs.readdirSync(path.join(voicemailDirectory, extension, 'INBOX'));
  files.forEach((v) => {
    fs.unlinkSync(path.join(voicemailDirectory, extension, 'INBOX', v));
  });
  console.log(extension + ': cleaned!');
};

(async () => {
  await xmpp.start();
  while (true) {
    try {
      console.log('starting xmpp');
      console.log('started!');
      await processBoxes();
    } catch (e) {
      console.error(e);
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
})().catch((err) => console.error(err));

  
