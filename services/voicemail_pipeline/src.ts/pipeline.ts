#!/usr/bin/env node

import url from "url";
import lodash from "lodash";
import fs from "fs-extra";
import debug from "@xmpp/debug";
import path from "path";
import mkdirp from "mkdirp";
import { client, xml } from "@xmpp/client";
import { getTranscript } from "./transcript";
import { spawnSync } from "child_process";
import { BUCKET_NAME, storage } from "./storage";
import yargs from "yargs";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const voicemailDirectory = process.env.VOICEMAIL_DIRECTORY || '/var/spool/asterisk/voicemail/default';

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


async function processBox(xmpp, extension) {
  await mkdirp(path.join(voicemailDirectory, extension, 'INBOX'));
  const parcels = lodash.uniqBy(fs.readdirSync(path.join(voicemailDirectory, extension, 'INBOX')), (v) => path.parse(v).name).map((v) => toParcel(extension, path.parse(v).name));
  for (const message of parcels) {
    console.log('processing ' + message.name + ' for ' + message.extension);
    await getTranscript(message);
    console.log('got transcript')
    await upload(message);
    console.log('uploaded to ipfs');
    const to = message.did + '@' + process.env.DOMAIN;
    const from = 'voicemail@' + process.env.DOMAIN;
    console.log(message);
    console.log({ to, from });
    await xmpp.send(xml('presence', { to, from }));
    await xmpp.send(xml('message', { to, from }, xml('body', {}, 'New voicemail from ' + message.callerid + ':\n' + (message.transcript || '<no transcript could be loaded>'))));
    await xmpp.send(xml('message', { to, from }, [ xml('body', {}, message.url), xml('x', { xmlns: 'jabber:x:oob' }, xml('url', {}, message.pinned)) ]));
  }
}

const getExtensions = () => fs.readdirSync(voicemailDirectory);
  

async function processBoxes(xmpp) {
  const extensions = getExtensions();
  for (const extension of extensions) {
    await processBox(xmpp, extension);
    await cleanBox(extension);
  }
};

async function upload(v) {
  const cwd = process.cwd();
  const { dir, name, ext } = path.parse(v.filepath);
  const bucket = await storage.bucket(BUCKET_NAME);
  console.log(await bucket.upload('/tmp/' + name + '.' + ext, {
    destination: name
  }));
  return 'https://storage.net/1.mp3';
};

function cleanBox(extension) {
  const files = fs.readdirSync(path.join(voicemailDirectory, extension, 'INBOX'));
  files.forEach((v) => {
    fs.unlinkSync(path.join(voicemailDirectory, extension, 'INBOX', v));
  });
  console.log(extension + ': cleaned!');
};

export async function run() {
  const xmpp = client({
    service: process.env.DOMAIN,
    resource: 'voicemail',
    username: 'voicemail',
    password: process.env.ROOT_PASSWORD || 'password'
  });
  debug(xmpp, true);
  await xmpp.start();
  while (true) {
    try {
      console.log('starting xmpp');
      console.log('started!');
      await processBoxes(xmpp);
    } catch (e) {
      console.error(e);
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

  
