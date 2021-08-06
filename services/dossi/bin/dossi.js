'use strict';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const debug = require('@xmpp/debug');
const path = require('path');
const { client, xml } = require('@xmpp/client');
const xid = require('@xmpp/id');
const pipl = require('@ghostdial/pipl');


const piplQueryToObject = (query) => {
  return query 
    .match(/([^\s:]+):((?:"((?:[^"\\]|\\[\s\S])*)")|(?:\S+))/g)
    .map((v) => v.split(':')
    .map((v) => v.substr(0, 1) === '"' ? JSON.parse(v) : v))
    .reduce((r, [key, value]) => {
      r[key] = value;
      return r;
    }, {});
};



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

const printPiplResult = async (result, to) => {
  const { possible_persons } = result;
  if (!possible_persons || !possible_persons.length) {
    return send('No match found in pipl', to);
  }
  const [ person ] = possible_persons;
  send(JSON.stringify(person, null, 2), to);
  const images = possible_persons.reduce((r, v) => r.concat((v.images || [])), []);
  for (const image of images) {
    await new Promise((resolve, reject) => setTimeout(resolve, 750));
    xmpp.send(xml('message', { to, from, id: xid(), type: 'chat' }, xml('body', {}, image.url) + xml('x', { xmlns: 'jabber:x:oob' }, xml('url', {}, image.url))));
  }
};

const piplNumberLookup = async (number, to) => {
  const cached = await redis.get('pipl.' + number);
  if (cached) {
    await printPiplResult(JSON.parse(cached), to);
  } else {
    const result = await pipl.search({ phone: number });
    await redis.set('pipl.' + number, JSON.stringify(result));
    await redis.expire('pipl.' + number, 60*60*24*3);
    await printPiplResult(result, to);
  }
};

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

const redis = new (require('ioredis'))();

const timeout = (n) => new Promise((resolve) => setTimeout(resolve, n));
const POLL_INTERVAL = 500;

const toJid = ({ host, username }) => {
  return username + '@' + host;
};
const pullIncomingCalls = () => {
  (async () => {
    while (true) {
      try {
        const incomingRaw = await redis.lpop('calls-in');
        if (!incomingRaw) {
          await timeout(POLL_INTERVAL);
          continue;
        } else {
          const incoming = JSON.parse(incomingRaw);
          const jid = toJid({ host: process.env.DOMAIN, username: incoming.did });
          send('INCOMING:<' + incoming.from + '=>' + incoming.did + '>', jid);  
          await callerId(incoming.from, jid);
        }
      } catch (e) {
        console.error(e);
      }
      await timeout(POLL_INTERVAL);
    }
  })().catch((err) => console.error(err));
};
const infura = new (require('ipfs-deploy/src/pinners/infura'))();
const uploadToIPFS = async (search, data) => {
  search = search.replace(/[^\w]+/g, '-').toLowerCase();
  const { cid } = await infura.ipfs.add(Buffer.from(data));
  const result = await infura.pinCid(cid);
  return 'https://cloudflare-ipfs.com/ipfs/' + cid + '?filename=' + search + '.txt';
  return v;
};
const callerId = async (number, to) => {
  const twilioResults = await twilioLookup(number);
  send(JSON.stringify(twilioResults, null, 2), to);
  await piplNumberLookup(number, to);
};
  
const printDossier = async (body, to) => {
  if (body.substr(0, 4) === 'pipl') {
    const match = body.match(/^pipl\s+(.*$)/);
    if (match) {
      const search = match[1];
      if (search.indexOf(':') !== -1) {
        const data = JSON.stringify(await pipl.search(piplQueryToObject(search)), null, 2);
        send(data, to);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return send(await uploadToIPFS(search, data), to);
      } else if (search.indexOf('@') !== -1) {
        const data = JSON.stringify(await pipl.search({ email: search }), null, 2);
        send(data, to);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return send(await uploadToIPFS(search, data), to);
      } else if (search.match(/\d+/)) {
        const data = JSON.stringify(await pipl.search({ phone: search }), null, 2);
        send(data, to);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return send(await uploadToIPFS(search, data), to);
      } else {
        const split = search.split(/\s+/);
        const data = JSON.stringify(await pipl.search({ first_name: split[0], last_name: split[1], state: split[2] }), null, 2);
        send(data, to);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return send(await uploadToIPFS(search, data), to);
      }

    }
  } else if (/(?:^\d{10,11}$)/.test(body)) {
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
    await printDossier(body, to);
  });
  await xmpp.start();
  pullIncomingCalls();
})().catch((err) => console.error(err));
