#!/usr/bin/env node
'use strict';

const yargs = require('yargs');

const { argv } = yargs;

const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

const ethers = require('ethers');

const client = new TextToSpeechClient();
const fs = require('fs');

const synthesize = async () => {
  const request = {
    input: { text: argv._[0], },
    voice: {
      languageCode: 'en-US',
      ssmlGender: 'NEUTRAL',
    },
    audioConfig: {
      audioEncoding: 'LINEAR16'
    }
  };
  const [ audio ] = await client.synthesizeSpeech(request);
  const filename = ethers.utils.solidityKeccak256(['string'], [ argv._[0] ]).substr(2) + '.wav';
  fs.writeFileSync('/usr/share/asterisk/sounds/' + filename, audio);
  console.log(filename);
  process.exit(0);
};

synthesize().catch((err) => console.error(err));
  
