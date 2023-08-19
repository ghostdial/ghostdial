'use strict';

const bucketName = (process.env.DOMAIN || 'ghostdial.net').replace(/\./g, '-') + '-voicemail-bucket';
const { Storage } = require('@google-cloud/storage');
const { SpeechClient } = require('@google-cloud/speech');
const speech = new SpeechClient();
const storage = new Storage();

exports.makeTranscript = async (filepath) => {
  const bucket = await storage.bucket(bucketName);
  await bucket.upload(filepath, {
    destination: 'tmp'
  });
  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 8000,
    languageCode: 'en-US'
  };
  const audio = {
    uri: 'gs://' + bucketName + '/tmp'
  };
  const [ { results: [ { alternatives } ] } ] = await speech.recognize({
    config,
    audio
  });
  return (alternatives[0] || {}).transcript;
};
exports.makeLongTranscript = async (filepath) => {
  const bucket = await storage.bucket(bucketName);
  await bucket.upload(filepath, {
    destination: 'tmp'
  });
  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 8000,
    languageCode: 'en-US'
  };
  const audio = {
    uri: 'gs://' + bucketName + '/tmp'
  };
  const [ operation ] = await speech.longRunningRecognize({
    config,
    audio
  });
  const [ response ] = await operation.promise();
  return response.results.map((v) => (v.alternatives[0] || {}).transcript || '').join('');
};

exports.getTranscript = async (parcel) => {
  try {
    parcel.transcript = await exports.makeTranscript(parcel.filepath);
  } catch  (e) {
    console.error(e);
    parcel.transcript = '';
  }
  return parcel;
};
