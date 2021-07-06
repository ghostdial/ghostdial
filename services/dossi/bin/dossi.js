'use strict';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const debug = require('@xmpp/debug');
const path = require('path');
const { client, xml } = require('@xmpp/client');
const xid = require('@xmpp/id');


const spookyStuff = [
  'don\'t let them see you',
  'look alive ghost',
  'the cabal?',
  'just a nightmare',
  'boo',
  'happy haunting',
  'disappear #ghost'
];
const talkGhastly = (to) => {
  send(spookyStuff[Math.floor(Math.random()*spookyStuff.length)], to);
};

const xmpp = client({
  service: process.env.DOMAIN,
  resource: 'dossi',
  username: 'dossi',
  password: process.env.ROOT_PASSWORD || 'password'
});

debug(xmpp, true);
const from = 'dossi@' + process.env.DOMAIN;

const send = (msg, to) => {
  xmpp.send(xml('message', { to, from, id: xid(), type: 'chat' }, xml('body', {}, msg)));
};

/* 
const ack = (stz) => {
  xmpp.send(xml('message', { to, from, id: xid(), type: 'chat' }, xml('receipt
  */

const twilio = new (require('twilio'))();
const peopledatalabs = new (require('peopledatalabs'))();

const twilioLookup = (phoneNumber) => twilio.lookups.phoneNumbers(phoneNumber).fetch({ type: ['carrier', 'caller-name'] });

const cursors = {};

const splitJid = (jid) => jid.match(/(?:[^@/]+)/g).filter(Boolean);

const personEnrich = (first_name, last_name, region) => peopledatalabs.personEnrich({ first_name: first_name.toLowerCase(), last_name: last_name.toLowerCase(), region: region.toLowerCase() });

const personSearch = async (from, query) => {
  const [ user ] = splitJid(from);
  if (query === 'next') {
    if (!cursors[user]) return send('nothing here ghost', user);
    if (cursors[user].index === cursors[user].total) return send('nothing here ghost', user);
    const response = await peopledatalabs.personSearch({ sql: cursors[user].query, from: cursors[user].index, limit: 1 });;
    response.data = response.data && response.data.map && response.data.map((v) => deleteNullKeys(v)) || response.data;
    cursors[user].total = response.total;
    cursors[user].index++;
    send(JSON.stringify(response, null, 2), from);

  } else {
    cursors[user] = {
      query,
      index: 0,
      total: 1
    };
    return await personSearch(from, 'next');
  }
}


const deleteNullKeys = (o) => {
  if (typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.slice().map((v) => deleteNullKeys(v));;
  const result = { ...o };
  Object.keys(result).forEach((v) => {
    if (result[v] === null) delete result[v];
    if (typeof result[v] === 'object') result[v] = deleteNullKeys(result[v]);  

  });
  return result;
};

(async () => {
  xmpp.on('online', () => {
    console.log('online!');
    xmpp.send(xml('presence'));
  });
  xmpp.on('stanza', async (stanza) => {
    console.log(stanza);
    console.log(stanza.getChild('body'));
    if (!stanza.is('message')) return;
    if (!stanza.getChild('body')) return;
    const to = stanza.attrs.from;
    let body = stanza.getChild('body').children[0].trim();
    if (/(?:^\d{10,11}$)/.test(body)) {
      if (body.length === 11) body = body.substr(1);
      body = '+1' + body;
      const twilioResults = await twilioLookup(body);
      const peopleDataLabsResults = deleteNullKeys(await peopledatalabs.personEnrich({ phone: body }));
      send(JSON.stringify({ twilioResults, peopleDataLabsResults }, null, 2), to);
      send('good luck ghost', to);
    } else if (body.match(/\w+/g).length === 3) {
      const [ first_name, last_name, region ] = body.match(/\w+/g);
      send(JSON.stringify(await personEnrich(first_name, last_name, region), null, 2), to);
      talkGhastly(to);
    } else if (body.match(/^(?:SELECT|next)/g)) {
      await personSearch(to, body);
      talkGhastly(to);
    }
  });
  await xmpp.start();
})().catch((err) => console.error(err));
