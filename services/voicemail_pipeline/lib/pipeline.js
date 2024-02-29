#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const lodash_1 = __importDefault(require("lodash"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const debug_1 = __importDefault(require("@xmpp/debug"));
const path_1 = __importDefault(require("path"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const client_1 = require("@xmpp/client");
const transcript_1 = require("./transcript");
const storage_1 = require("./storage");
const yargs_1 = __importDefault(require("yargs"));
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const voicemailDirectory = process.env.VOICEMAIL_DIRECTORY || '/var/spool/asterisk/voicemail/default';
const filename = yargs_1.default.argv._[0];
const bucketName = (process.env.DOMAIN || 'ghostdial.net').replace(/\./g, '-') + '-voicemail';
const getCallerID = (data) => {
    return data.match(/callerid=(.*)$/m)[1];
};
const toParcel = (extension, messageBasename) => {
    const callerid = getCallerID(fs_extra_1.default.readFileSync(path_1.default.join(voicemailDirectory, extension, 'INBOX', messageBasename + '.txt'), 'utf8'));
    let did;
    try {
        did = fs_extra_1.default.readFileSync(path_1.default.join(voicemailDirectory, extension, 'did.txt'), 'utf8').trim();
    }
    catch (e) {
        console.error(e);
        did = extension;
    }
    return {
        callerid,
        did,
        extension,
        filepath: path_1.default.join(voicemailDirectory, extension, 'INBOX', messageBasename + '.wav'),
        name: messageBasename
    };
};
async function processBox(xmpp, extension) {
    await (0, mkdirp_1.default)(path_1.default.join(voicemailDirectory, extension, 'INBOX'));
    const parcels = lodash_1.default.uniqBy(fs_extra_1.default.readdirSync(path_1.default.join(voicemailDirectory, extension, 'INBOX')), (v) => path_1.default.parse(v).name).map((v) => toParcel(extension, path_1.default.parse(v).name));
    for (const message of parcels) {
        console.log('processing ' + message.name + ' for ' + message.extension);
        await (0, transcript_1.getTranscript)(message);
        console.log('got transcript');
        await upload(message);
        console.log('uploaded to ipfs');
        const to = message.did + '@' + process.env.DOMAIN;
        const from = 'voicemail@' + process.env.DOMAIN;
        console.log(message);
        console.log({ to, from });
        await xmpp.send((0, client_1.xml)('presence', { to, from }));
        await xmpp.send((0, client_1.xml)('message', { to, from }, (0, client_1.xml)('body', {}, 'New voicemail from ' + message.callerid + ':\n' + (message.transcript || '<no transcript could be loaded>'))));
        await xmpp.send((0, client_1.xml)('message', { to, from }, [(0, client_1.xml)('body', {}, message.url), (0, client_1.xml)('x', { xmlns: 'jabber:x:oob' }, (0, client_1.xml)('url', {}, message.pinned))]));
    }
}
const getExtensions = () => fs_extra_1.default.readdirSync(voicemailDirectory);
async function processBoxes(xmpp) {
    const extensions = getExtensions();
    for (const extension of extensions) {
        await processBox(xmpp, extension);
        await cleanBox(extension);
    }
}
;
async function upload(v) {
    const cwd = process.cwd();
    const { dir, name, ext } = path_1.default.parse(v.filepath);
    const bucket = await storage_1.storage.bucket(storage_1.BUCKET_NAME);
    console.log(await bucket.upload('/tmp/' + name + '.' + ext, {
        destination: name
    }));
    return 'https://storage.net/1.mp3';
}
;
function cleanBox(extension) {
    const files = fs_extra_1.default.readdirSync(path_1.default.join(voicemailDirectory, extension, 'INBOX'));
    files.forEach((v) => {
        fs_extra_1.default.unlinkSync(path_1.default.join(voicemailDirectory, extension, 'INBOX', v));
    });
    console.log(extension + ': cleaned!');
}
;
async function run() {
    const xmpp = (0, client_1.client)({
        service: process.env.DOMAIN,
        resource: 'voicemail',
        username: 'voicemail',
        password: process.env.ROOT_PASSWORD || 'password'
    });
    (0, debug_1.default)(xmpp, true);
    await xmpp.start();
    while (true) {
        try {
            console.log('starting xmpp');
            console.log('started!');
            await processBoxes(xmpp);
        }
        catch (e) {
            console.error(e);
        }
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }
}
exports.run = run;
//# sourceMappingURL=pipeline.js.map