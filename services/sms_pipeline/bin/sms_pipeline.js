"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const jwt = require('jsonwebtoken');
const child_process = require("child_process");
const request = require('request');
const url = require("url");
const path = require("path");
const SMPP_URL = process.env.SMPP_URL || "ssmpp://smpp.voip.ms:3550";
const HTTP_FILE_SHARE_BASE_URL = process.env.HTTP_FILE_SHARE_BASE_URL;
const HTTP_FILE_SHARE_SECRET = process.env.HTTP_FILE_SHARE_SECRET;
const SMPP_SYSTEM_ID = process.env.SMPP_SYSTEM_ID;
const SMPP_PASSWORD = process.env.SMPP_PASSWORD;
const SMPP_TLSKEY = process.env.SMPP_TLSKEY || null;
const SMPP_TLSCERT = process.env.SMPP_TLSCERT || null;
const VOIPMS_USERNAME = process.env.VOIPMS_USERNAME;
const VOIPMS_PASSWORD = process.env.VOIPMS_PASSWORD;
const GHOST_NUMBER = process.env.GHOST_NUMBER;
const smpp = require("smpp");
const ethers = require("ethers");
const fs = require("fs-extra");
const voipms = new (require("@ghostdial/voipms"))({
  username: VOIPMS_USERNAME,
  password: VOIPMS_PASSWORD,
});
const mkdirp = require('mkdirp');
const SMS_SQLITE3_DATABASE = process.env.SMS_SQLITE3_DATABASE || path.join(process.env.HOME, '.sms_pipeline', 'sms.db');

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: SMS_SQLITE3_DATABASE
  }
});

const initializeDatabase = async () => {
  await mkdirp(path.parse(SMS_SQLITE3_DATABASE).dir);
  const exists = await knex.schema.hasTable('messages');
  if (!exists) {
    await knex.schema.createTable('messages', table => {
      table.increments('id');
      table.string('from');
      table.string('to');
      table.string('message');
      table.string('attachments');
      table.time('time');
    });
  }
};

const insertToDatabase = async (sms) => {
  await knex('messages').insert(Object.assign({}, sms, { attachments: JSON.stringify(sms.attachments || []), time: Math.floor(Date.now() / 1000) }));
};

const redis = new (require("ioredis"))();

const connect = () => smpp.connect({ url: SMPP_URL });

const SMS_OUT_CHANNEL = "sms-out";
const SMS_IN_CHANNEL = "sms-in";

const bind = (session, callback) =>
  session.bind_transceiver(
    {
      system_id: SMPP_SYSTEM_ID,
      password: SMPP_PASSWORD,
    },
    (pdu) => callback(pdu)
  );

const once = (fn) => {
  let done;
  return (...args) => {
    done = true;
    return fn(...args);
  };
};

const sendMMS = async ({ from, to, message, attachments }) => {
  console.log("sending MMS ...");
  const [media1, media2, media3] = attachments;
  const out = {
    did: from,
    dst: to,
    message: message || "",
  };
  if (media1) out.media1 = media1;
  if (media2) out.media2 = media2;
  if (media3) out.media3 = media3;
  const result = await voipms.sendMMS.get(out);
  await voipms.deleteMMS.get({ id: result.mms });
  return result;
};
const RETRY_INTERVAL = 3000;


const sendSMPP = async (o) => {
  try {
    const { sms } = await voipms.sendSMS.get({
      did: o.from,
      dst: o.to,
      message: o.message
    });
    try {
      await voipms.deleteSMS({
        id: sms
      });
    } catch (e) { console.error(e); }
  } catch (e) {
    await redis.rpush('sms-in', JSON.stringify({
      from: o.to,
      to: o.from,
      message: '<message failed to send: "' + o.message.substr(0, 20) + '...' + '">'
    }))
  }
};

/*
async function sendSMPP(o) {
  return await new Promise((resolve, _reject) => {
    let {
      from: source_addr,
      to: destination_addr,
      message: short_message,
      retry = 0,
    } = o;
    const session = connect();
    const reject = once((e) => {
      retry++;
      if (retry === 5) {
        redis.lpush(JSON.stringify({
          message: short_message,
          attachments: [],
          from: source_addr,
          to: destination_addr
        })).catch((err) => console.error(err));
        console.log('pushing message back onto stack');
        return resolve();
      }
      setTimeout(
        () =>
          sendSMPP(o)
            .then((v) => resolve(v))
            .catch((err) => _reject(err)),
        RETRY_INTERVAL
      );
    });
    session.on("error", (err) => {
      session.close();
      console.error(err);
    });
    bind(session, (pdu) => {
      if (pdu.command_status !== 0)
        return reject(Error("command_status: " + String(pdu.command_status)));
      session.submit_sm(
        {
          destination_addr,
          source_addr,
          short_message,
        },
        once((pdu) => {
          if (pdu.command_status !== 0)
            return reject(
              Error("command_status: " + String(pdu.command_status))
            );
          resolve(pdu);
          session.close();
        })
      );
    });
  });
}
*/

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
  session.on("error", (err) => console.error(err));
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
      cert: fs.readFileSync(process.env.TLS_CERTIFICATE, "utf8"),
      key: fs.readFileSync(process.env.TLS_PRIVATE_KEY, "utf8"),
    },
    smppHandler(handleSms)
  );
  server.listen(3550, "0.0.0.0");
  return server;
};

const startSMPPServer = (handleSms) => {
  console.log("smpp server starting ...");
  const server = smpp.createServer(smppHandler(handleSms));
  server.listen(2775, "0.0.0.0", (err) => console.error(err));
  return server;
};

const util = require("util");

const handleSms = async (sms) => {
  try {
    if (sms.to === GHOST_NUMBER) {
      const from = sms.from;
      const matches = sms.message.match(/^(\d+)=>(\d=)\s+(.*$)/);
      if (matches) {
        sms.from = matches[1];
        sms.to = matches[2];
        sms.message = matches[3];
      } else {
        const matches = sms.message.match(/(^\w{4})\s+(.*$)/);
        const tag = matches[1].toLowerCase();
        const target = await redis.get(tag);
        if (target) {
          const [from, to] = target.split(":");
          sms.from = from;
          sms.to = to;
          sms.message = matches[2];
        }
      }
    }
    console.log("Got incoming message!");
    console.log(util.inspect(sms, { colors: true, depth: 2 }));
    await insertToDatabase(sms);
    await redis.rpush(SMS_IN_CHANNEL, JSON.stringify(sms));
    const ext = await redis.get("extfor." + sms.to);
    if (!ext) return;
    const fallback = await redis.get("sms-fallback." + ext);
    if (!fallback) return;
    const forward = { ...sms };
    forward.to = fallback;
    forward.from = GHOST_NUMBER;
    const tag = ethers.utils
      .solidityKeccak256(["string", "string"], [sms.to, sms.from])
      .substr(2, 4);
    forward.message =
      sms.from + "=>" + sms.to + " (" + tag + ") " + (sms.message || "");
    await redis.set(tag, sms.to + ":" + sms.from);
    await forwardMessage(forward);
  } catch (e) {
    console.error(e);
  }
};

const POLL_INTERVAL = 6000;
const moment = require("moment");

const OFFSET = 3600 * 4;
const fromUnix = (unix) => {
  return moment(new Date((unix - OFFSET) * 1000)).format("YYYY-MM-DD HH:mm:ss");
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
  const attachments = toArray(
    (await voipms.getMediaMMS.get({ id })).media
  ).filter(Boolean);
  if (attachments.length) return attachments;
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  return getAttachmentsEventually(id, count + 1);
};

const pullAttachment = async (url) => {
  const { body } = await request.get(url);
  const ext = path.parse(url).ext;
  const slot = ethers.utils.hexlify(ethers.utils.randomBytes(32)).substr(2);
  const filename = ethers.utils.solidityKeccak256(['bytes32'], [ '0x' + slot ]).substr(2);
  const fileUrl = HTTP_FILE_SHARE_BASE_URL + '/' + slot.substr(40) + '/' + filename.substr(40) + ext;
  await new Promise((resolve, reject) => request({
    url: fileUrl,
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + jwt.sign({}, HTTP_FILE_SHARE_SECRET)
    }
  }, (err, result) => err ? reject(err) : resolve(result)));
  return fileUrl;
};

const pullAttachments = async (urls) => {
  const result = [];
  for (const url of urls) {
    result.push(await pullAttachment(url));
  }
  return result;
};

const pollOneMMS = async () => {
  let last = Number(await redis.get("last-time"));
  if (!last || isNaN(last)) last = getUnix(); // initialize to now
  const now = getUnix();
  const response = await voipms.getMMS.get({
    type: 1,
    all_messages: 1,
    from: fromUnix(last + 1),
    to: fromUnix(now),
  });
  const { sms } = response;
  if (sms)
    await sms.reduce(async (r, v) => {
      await r;
      const attachments = await pullAttachments([v.col_media1, v.col_media2, v.col_media3].filter(
        Boolean
      )); //(await getAttachmentsEventually(v.id)).filter(Boolean);
      const msg = {
        from: v.contact,
        to: v.did,
        message: v.message,
        attachments,
      };
      const result = await handleSms(msg).catch((err) => console.error(err));
      if (!attachments.length) try {
        const { status } = await voipms.deleteMMS.get({ id: v.id });
        if (status !== 'success') await voipms.deleteSMS.get({ id: v.id });
      } catch (e) { console.error(e); }
      return result;
    }, Promise.resolve());
  await redis.set("last-time", String(now));
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

const lodash = require("lodash");

const toString = (s) => (Buffer.isBuffer(s) ? s.toString("utf8") : s);

const mutateCoerceAttachments = (msg) => {
  if (
    typeof msg.attachments === "object" &&
    Object.keys(msg.attachments).length === 0
  )
    msg.attachments = [];
  return msg;
};

const flushOne = async (msg) => {
  if (!msg) return false;
  const decoded = mutateCoerceAttachments(JSON.parse(toString(msg)));
  console.log("Got outgoing message from Prosody!");
  console.log(util.inspect(decoded, { colors: true, depth: 2 }));
  await insertToDatabase(decoded);
  if ((decoded.message || "").length > 160 || decoded.attachments.length)
    await sendMMS(decoded);
  else await sendSMPP(decoded);
  return true;
};

const forwardMessage = async (msg) => {
  if (!msg) return false;
  const decoded = mutateCoerceAttachments(msg);
  console.log("Relaying message");
  console.log(util.inspect(decoded, { colors: true, depth: 2 }));
  if ((decoded.message || "").length > 160 || decoded.attachments.length)
    await sendMMS(decoded);
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
  await initializeDatabase();
  createConsumer().catch((err) => console.error(err));
  startPollingForMMS().catch((err) => console.error(err));
  await startSMPPServer(handleSms);
//  await startSecureSMPPServer(handleSms);
})().catch((err) => console.error(err));
