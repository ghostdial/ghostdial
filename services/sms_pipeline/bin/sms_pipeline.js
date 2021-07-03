"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const child_process = require("child_process");
const url = require("url");
const path = require("path");
const SMPP_URL = process.env.SMPP_URL || "ssmpp://smpp.voip.ms:3550";
const SMPP_SYSTEM_ID = process.env.SMPP_SYSTEM_ID;
const SMPP_PASSWORD = process.env.SMPP_PASSWORD;
const SMPP_TLSKEY = process.env.SMPP_TLSKEY || null;
const SMPP_TLSCERT = process.env.SMPP_TLSCERT || null;
const VOIPMS_USERNAME = process.env.VOIPMS_USERNAME;
const VOIPMS_PASSWORD = process.env.VOIPMS_PASSWORD;
const smpp = require("smpp");
const ethers = require("ethers");
const fs = require("fs-extra");
const voipms = new (require('../lib/voipms'))({ username: VOIPMS_USERNAME, password: VOIPMS_PASSWORD });

const redis = new (require('ioredis'))();


const connect = () => smpp.connect({ url: SMPP_URL });

const SMS_OUT_CHANNEL = "sms-out";
const SMS_IN_CHANNEL = "sms-in";

const bind = (session) =>
  new Promise((resolve, reject) =>
    session.bind_transceiver(
      {
        system_id: SMPP_SYSTEM_ID,
        password: SMPP_PASSWORD,
      },
      (pdu) => resolve(pdu)
    )
  );

const once = (fn) => {
  let done;
  return (...args) => {
    done = true;
    return fn(...args);
  };
};

const sendMMS = async ({
  from,
  to,
  message,
  attachments
}) => {
  console.log('sending MMS ...');
  const [ media1, media2, media3 ] = attachments;
  const out = {
    did: from,
    dst: to,
    message: message || ''
  };
  if (media1) out.media1 = media1;
  if (media2) out.media2 = media2;
  if (media3) out.media3 = media3;
  await voipms.sendMMS.get(out);
};

const sendSMPP = async ({
  from: source_addr,
  to: destination_addr,
  message: short_message,
}) => {
  const session = connect();
  try {
    let pdu = await bind(session);
    if (pdu.command_status !== 0)
      throw Error("command_status: " + String(pdu.command_status));
    pdu = await new Promise((resolve) => session.submit_sm( {
          destination_addr,
          source_addr,
          short_message,
        },
        once(resolve)
      )
    );
    if (pdu.command_status !== 0)
      throw Error("command_status: " + String(pdu.command_Status));
    session.close();
    return pdu;
  } catch (e) {
    console.error(e);
    session.close();
  }
};

const checkUserPass = (pdu) => {
  return pdu.system_id === SMPP_SYSTEM_ID && pdu.password === SMPP_PASSWORD;
};

const smsFromPdu = (pdu) => {
  const {
    destination_addr: to,
    source_addr: from,
    short_message: { message },
  } = pdu;
  return {
    from,
    to,
    attachments: [],
    message,
  };
};

const pduHandler = (session, handleSms) => (pdu) => {
  session.send(pdu.response());
  handleSms(smsFromPdu(pdu));
};

const smppHandler = (handleSms) => (session) => {
  session.on('error', (e) => {
    console.error(e);
  });
  session.on("bind_transceiver", (pdu) => {
    if (!checkUserPass(pdu)) {
      session.send(
        pdu.response({
          command_status: smpp.ESME_RBINDFAIL,
        })
      );
      session.close();
      return;
    }
    session.on("deliver_sm", pduHandler(session, handleSms));
    session.on("submit_sm", pduHandler(session, handleSms));
    session.on("enquire_link", (pdu) => session.send(pdu.response()));
    session.send(pdu.response());
  });
};

const startSecureSMPPServer = (handleSms) => {
  const server = smpp.createServer(
    {
      cert: SMPP_TLSCERT,
      key: SMPP_TLSKEY,
    },
    smppHandler(handleSms)
  );
  server.listen(3550, "0.0.0.0");
  return server;
};

const startSMPPServer = (handleSms) => {
  console.log('smpp server starting ...');
  const server = smpp.createServer(smppHandler(handleSms));
  server.listen(2775, "0.0.0.0", (err) => console.error(err));
  return server;
};

const util = require("util");

const handleSms = async (sms) => {
  try {
    console.log("Got incoming message!");
    console.log(util.inspect(sms, { colors: true, depth: 2 }));
    await redis.rpush(SMS_IN_CHANNEL, JSON.stringify(sms));
  } catch (e) {
    console.error(e);
  }
};

const POLL_INTERVAL = 6000;
const moment = require('moment');

const OFFSET = 3600*4;
const fromUnix = (unix) => {
  return moment(new Date((unix - OFFSET) * 1000)).format('YYYY-MM-DD HH:mm:ss');
};


const toUnix = (dateString) => {
  return Math.floor(Number(new Date(dateString)) / 1000) + OFFSET;
};

const getUnix = () => {
  return Math.floor(Date.now() / 1000);
};

const toArray = (s) => {
  const clone = { ...s };
  const length = Math.max(...Object.keys(s).filter((v) => !isNaN(v)));
  clone.length = length;
  return Array.from(clone);
};

const getAttachmentsEventually = async (id, count = 0) => {
  if (count === 10) return [];
  const attachments = toArray((await voipms.getMediaMMS.get({ id })).media).filter(Boolean);
  if (attachments.length) return attachments;
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  return getAttachmentsEventually(id, count + 1);
};

const pollOneMMS = async () => {
  let last = Number(await redis.get('last-time'));
  if (!last || isNaN(last)) last = getUnix(); // initialize to now
  const now = getUnix();
  const response = await voipms.getMMS.get({
    type: 1,
    all_messages: 0,
    from: fromUnix(last),
    to: fromUnix(now)
  });
  console.log(response);
  const { sms } = response;
  if (sms) await sms.reduce(async (r, v) => {
    await r;
    const attachments = [ v.col_media1, v.col_media2, v.col_media3 ].filter(Boolean); //(await getAttachmentsEventually(v.id)).filter(Boolean);
    const msg = {
      from: v.contact,
      to: v.did,
      message: v.message,
      attachments
    };
    return handleSms(msg).catch((err) => console.error(err));
  }, Promise.resolve());
  await redis.set('last-time', String(now));
};

const startPollingForMMS = async () => {
  while (true) {
    try {
      await pollOneMMS();
    } catch (e) {
      console.error(e);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
};
    
    

const lodash = require('lodash');

const toString = (s) => Buffer.isBuffer(s) ? s.toString('utf8') : s;

const mutateCoerceAttachments = (msg) => {
  if (typeof msg.attachments === 'object' && Object.keys(msg.attachments).length === 0) msg.attachments = [];
  return msg;
};

const flushOne = async (msg) => {
  console.log(msg);
  if (!msg) return false;
  const decoded = mutateCoerceAttachments(JSON.parse(toString(msg)));
  console.log("Got outgoing message from Prosody!");
  console.log(util.inspect(decoded, { colors: true, depth: 2 }));
  if ((decoded.message || '').length > 160 || decoded.attachments.length) await sendMMS(decoded);
  else await sendSMPP(decoded);
  return true;
};

const createConsumer = async () => {
  const pop = async () => {
    const item = await redis.lpop(SMS_OUT_CHANNEL);
    try {
      if (item) {
        await flushOne(item);
        await pop();
      }
    } catch (e) {
      console.error(e);
    }
  };
  while (true) {
    await pop();   
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

(async () => {
  createConsumer().catch((err) => console.error(err));
  startPollingForMMS().catch((err) => console.error(err));
  await startSMPPServer(handleSms);
})().catch((err) => console.error(err));
