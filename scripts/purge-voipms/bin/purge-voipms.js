'use strict';

const VOIPMS_USERNAME = process.env.VOIPMS_USERNAME;
const VOIPMS_PASSWORD = process.env.VOIPMS_PASSWORD;
const voipms = new (require("@ghostdial/voipms"))({
  username: VOIPMS_USERNAME,
  password: VOIPMS_PASSWORD,
});

const purgeOne = async (id) => {
  try {
    await voipms.deleteMMS.get({ id });
  } catch (e) {
    console.error(e);
  }
  try {
    await voipms.deleteSMS.get({ id });
  } catch (e) {
    console.error(e);
  }
};

const moment = require('moment');

const from = Date.now() - 1000*60*60*24*90;
const to = Date.now() - 1000*60*60*24*0;

const purgeAll = async () => {
  const sms = await voipms.getMMS.get({
    type: 0,
    from: moment(new Date(from)).format('YYYY-MM-DD'),
    to: moment(new Date(to)).format('YYYY-MM-DD'),
    all_messages: 1
  });
  console.log(sms);
  if (sms.sms.length === 0) return false;
  for (const msg of sms.sms) {
    await purgeOne(msg.id);
    console.log(JSON.stringify(msg, null, 1));
    await new Promise((resolve, reject) => setTimeout(resolve, 1000));
  }
  return true;
};

(async () => {
  let result = true;
  while (result) {
    result = await purgeAll();
  }
})().catch((err) => console.error(err));
