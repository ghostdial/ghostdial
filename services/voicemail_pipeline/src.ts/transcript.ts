'use strict';

import { Storage } from "@google-cloud/storage";
import { SpeechClient } from "@google-cloud/speech";
const speech = new SpeechClient();
import { storage, BUCKET_NAME } from "./storage";

async function makeTranscript(filepath) {
  const bucket = await storage.bucket(BUCKET_NAME);
  await bucket.upload(filepath, {
    destination: 'tmp'
  });
  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 8000,
    languageCode: 'en-US'
  };
  const audio = {
    uri: 'gs://' + BUCKET_NAME + '/tmp'
  };
  const [ { results: [ { alternatives } ] } ] = await (speech as any).recognize({
    config,
    audio
  });
  return (alternatives[0] || {}).transcript;
};
async function makeLongTranscript(filepath) {
  const bucket = await storage.bucket(BUCKET_NAME);
  await bucket.upload(filepath, {
    destination: 'tmp'
  });
  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 8000,
    languageCode: 'en-US'
  };
  const audio = {
    uri: 'gs://' + BUCKET_NAME + '/tmp'
  };
  const [ operation ] = await (speech as any).longRunningRecognize({
    config,
    audio
  });
  const [ response ] = await operation.promise();
  return response.results.map((v) => (v.alternatives[0] || {}).transcript || '').join('');
};

export async function getTranscript(parcel) {
  try {
    parcel.transcript = await makeTranscript(parcel.filepath);
  } catch  (e) {
    console.error(e);
    parcel.transcript = '';
  }
  return parcel;
};
