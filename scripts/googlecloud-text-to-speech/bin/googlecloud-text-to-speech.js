#!/usr/bin/env node
'use strict';

const yargs = require('yargs');

const { argv } = yargs;

const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

const ethers = require('ethers');

const client = new TextToSpeechClient();
const fs = require('fs');

const PREFIX = '/var/lib/asterisk/sounds/en';

const path = require('path');

const toTranscriptFilename = (filename) => {
  return filename.replace(/[^\w]/g, '-').toLowerCase().substr(0, 64);
};

const synthesize = async () => {
  const filename = toTranscriptFilename(argv._[0]) + '.wav';
  if (fs.existsSync(path.join(PREFIX, filename))) return console.log(filename);
  const request = {
    input: { text: argv._[0], },
    voice: {
      languageCode: 'en-US',
      ssmlGender: 'NEUTRAL',
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 8000
    }
  };
  const [ audio ] = await client.synthesizeSpeech(request);
  fs.writeFileSync(path.join(PREFIX, filename), audio.audioContent);
  console.log(filename);
  process.exit(0);
};

synthesize().catch((err) => console.error(err));
  
