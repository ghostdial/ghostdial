'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTranscript = void 0;
const speech_1 = require("@google-cloud/speech");
const speech = new speech_1.SpeechClient();
const storage_1 = require("./storage");
async function makeTranscript(filepath) {
    const bucket = await storage_1.storage.bucket(storage_1.BUCKET_NAME);
    await bucket.upload(filepath, {
        destination: 'tmp'
    });
    const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 8000,
        languageCode: 'en-US'
    };
    const audio = {
        uri: 'gs://' + storage_1.BUCKET_NAME + '/tmp'
    };
    const [{ results: [{ alternatives }] }] = await speech.recognize({
        config,
        audio
    });
    return (alternatives[0] || {}).transcript;
}
;
async function makeLongTranscript(filepath) {
    const bucket = await storage_1.storage.bucket(storage_1.BUCKET_NAME);
    await bucket.upload(filepath, {
        destination: 'tmp'
    });
    const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 8000,
        languageCode: 'en-US'
    };
    const audio = {
        uri: 'gs://' + storage_1.BUCKET_NAME + '/tmp'
    };
    const [operation] = await speech.longRunningRecognize({
        config,
        audio
    });
    const [response] = await operation.promise();
    return response.results.map((v) => (v.alternatives[0] || {}).transcript || '').join('');
}
;
async function getTranscript(parcel) {
    try {
        parcel.transcript = await makeTranscript(parcel.filepath);
    }
    catch (e) {
        console.error(e);
        parcel.transcript = '';
    }
    return parcel;
}
exports.getTranscript = getTranscript;
;
//# sourceMappingURL=transcript.js.map