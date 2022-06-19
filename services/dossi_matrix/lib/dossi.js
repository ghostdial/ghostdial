"use strict";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const url = require('url');
const subprocesses = require('@ghostdial/subprocesses');
const request = require('request');
const pipl = require("@ghostdial/pipl");
const voipms = require('@ghostdial/voipms');
const fs = require("fs-extra");
const faxvin = require('faxvin-puppeteer');
const sdk = require('matrix-bot-sdk');
const { Client } = require("ssh2");

const path = require("path");
const mkdirp = require("mkdirp");

const ZGREP_SSH_HOSTNAME = process.env.ZGREP_SSH_HOSTNAME;
const ZGREP_SSH_PORT = process.env.ZGREP_SSH_PORT;
const ZGREP_SSH_IDENTITY =
  process.env.ZGREP_SSH_IDENTITY ||
  path.join(process.env.HOME, ".ssh", "id_rsa");
const ZGREP_SSH_USER = process.env.ZGREP_SSH_USER;
const ZGREP_DIR = process.env.ZGREP_DIR;
const VOIPMS_SUBACCOUNT = process.env.VOIPMS_SUBACCOUNT;
const VOIPMS_POP = process.env.VOIPMS_POP;
const ZGREP_MAX_RESULTS = Number(process.env.ZGREP_MAX_RESULTS || 1000);
const FAXVIN_DEFAULT_STATE = process.env.FAXVIN_DEFAULT_STATE;
const lodash = require("lodash");
const truepeoplesearch = require('truepeoplesearch-puppeteer');
const facebook = require('facebook-recover-puppeteer');

const sendResults = async (results, query, to) => {
  const lines = results.split("\n");
  const chunks = lodash.chunk(lines, 50);
  for (const chunk of chunks) {
    console.log(chunk);
    await send("zgrep:" + query + ":" + chunk.join("\n"), to);
    await new Promise((resolve, reject) => setTimeout(resolve, 300));
  }
};
const sendLinkedInResults = async (results, query, to) => {
  const lines = results.split("\n").map((v) => v.substr(v.indexOf('{')));
  const chunks = lodash.chunk(lines, 50);
  for (const chunk of chunks) {
    await send(chunk.join("\n"), to);
    await new Promise((resolve, reject) => setTimeout(resolve, 300));
  }
};

const searchDIDs = async (query) => {
  const processed = piplQueryToObject(query);
  const result = await voipms.fromEnv().searchDIDsUSA.get(processed);
  return (result.dids || []).map((v) => v.did);
};

const orderDID = async (number, sourceDid) => {
  const vms = voipms.fromEnv();
  const ext = await redis.get('extfor.' + sourceDid);
  const { servers } = await vms.getServersInfo.get();
  const { server_pop } = servers.find((v) => v.server_hostname === (VOIPMS_POP || 'atlanta1.voip.ms'));
  await vms.orderDID.get({
    did: number,
    routing: 'account:' + VOIPMS_SUBACCOUNT,
    pop: server_pop,
    dialtime: 60,
    cnam: 1,
    billing_type: 1
  });
  await vms.setSMS.get({
    did: number,
    enable: 1
  });
  await redis.set('extfor.' + number, ext);
};

const runLinkedIn = (query, to) => {
  const client = new Client();
  return new Promise(async (resolve, reject) => {
    client.on("error", (e) => {
      client.end();
      reject(e);
    });
    client
      .on("ready", () => {
        console.log("session::remote: opened");
        client.exec(
          'grep -r "' + query + '" ' + process.env.LINKEDIN_DIR + "/*",
          (err, stream) => {
            if (err) {
              client.end();
              return reject(err);
            }
            console.log("session::remote: ran " + query);
            let data = "";
            stream.setEncoding("utf8");
            stream.stderr.setEncoding("utf8");
            stream.stderr.on("data", (data) => console.error(data));
            stream.on("data", async (_data) => {
              await sendLinkedInResults(_data, query, to).catch((err) => console.error(err));
            });
            stream.on("close", (code, signal) => {
              client.end();
              console.log("session::remote: close");
              console.log(data);
              resolve("");
            });
          }
        );
      })
      .connect({
        user: ZGREP_SSH_USER,
        privateKey: await fs.readFile(ZGREP_SSH_IDENTITY),
        port: ZGREP_SSH_PORT,
        host: ZGREP_SSH_HOSTNAME,
      });
  });
};
const runZgrep = (query, to) => {
  const client = new Client();
  return new Promise(async (resolve, reject) => {
    client.on("error", (e) => {
      client.end();
      reject(e);
    });
    client
      .on("ready", () => {
        console.log("session::remote: opened");
        client.exec(
          'zgrep -a "' + query + '" ' + ZGREP_DIR + "/*",
          (err, stream) => {
            if (err) {
              client.end();
              return reject(err);
            }
            console.log("session::remote: ran " + query);
            let data = "";
            stream.setEncoding("utf8");
            stream.stderr.setEncoding("utf8");
            stream.stderr.on("data", (data) => console.error(data));
            stream.on("data", async (_data) => {
              console.log(_data);
              await sendResults(_data, query, to).catch((err) => console.error(err));
            });
            stream.on("close", (code, signal) => {
              client.end();
              console.log("session::remote: close");
              console.log(data);
              resolve("");
            });
          }
        );
      })
      .connect({
        user: ZGREP_SSH_USER,
        privateKey: await fs.readFile(ZGREP_SSH_IDENTITY),
        port: ZGREP_SSH_PORT,
        host: ZGREP_SSH_HOSTNAME,
      });
  });
};
const runZgrepFull = (query, to) => {
  const client = new Client();
  return new Promise(async (resolve, reject) => {
    client.on("error", (e) => {
      client.end();
      reject(e);
    });
    client
      .on("ready", () => {
        console.log("session::remote: opened");
        client.exec(
          'zgrep -a "' + query + '" ' + path.parse(ZGREP_DIR).dir + "/*",
          (err, stream) => {
            if (err) {
              client.end();
              return reject(err);
            }
            console.log("session::remote: ran " + query);
            let data = "";
            stream.setEncoding("utf8");
            stream.stderr.setEncoding("utf8");
            stream.stderr.on("data", (data) => console.error(data));
            stream.on("data", async (_data) => {
              console.log(_data);
              await sendResults(_data, query, to).catch((err) => console.error(err));
            });
            stream.on("close", (code, signal) => {
              client.end();
              console.log("session::remote: close");
              console.log(data);
              resolve("");
            });
          }
        );
      })
      .connect({
        user: ZGREP_SSH_USER,
        privateKey: await fs.readFile(ZGREP_SSH_IDENTITY),
        port: ZGREP_SSH_PORT,
        host: ZGREP_SSH_HOSTNAME,
      });
  });
};


const piplQueryToObject = (query) => {
  return query
    .match(/([^\s:]+):((?:"((?:[^"\\]|\\[\s\S])*)")|(?:\S+))/g)
    .map((v) =>
      v.split(":").map((v) => (v.substr(0, 1) === '"' ? JSON.parse(v) : v))
    )
    .reduce((r, [key, value]) => {
      r[key] = value;
      return r;
    }, {});
};

const spookyStuff = [
  "don't let them see you",
  "look alive ghost",
  "the cabal?",
  "just a nightmare",
  "boo",
  "happy haunting",
  "disappear #ghost",
];
const talkGhastly = async (to) => {
  await send(spookyStuff[Math.floor(Math.random() * spookyStuff.length)], to);
};

const from = "@dossi:" + process.env.MATRIX_HOMESERVER;


const { createClient } = require('matrix-js-sdk').default;

const client = new sdk.MatrixClient('https://' + process.env.MATRIX_HOMESERVER, process.env.MATRIX_ACCESS_TOKEN, new sdk.SimpleFsStorageProvider('dossi-matrix.json'));

sdk.AutojoinRoomsMixin.setupOnClient(client);

const send = async (msg, to) => {
  await client.sendMessage(to, {
    msgtype: 'm.text',
    body: msg
  });
};


const twilio = new (require("twilio"))();
const peopledatalabs = new (require("peopledatalabs"))();

const sendPiplImagesForPerson = async (person, i, to) => {
  if ((person.images || []).length) {
    await send("IMAGES FOR MATCH " + String(i), to);
    i++;
    await new Promise((resolve, reject) => setTimeout(resolve, 300));
  }
  for (const image of person.images || []) {
    await new Promise((resolve, reject) => setTimeout(resolve, 750));
    await send(image.url, to);
    await new Promise((resolve, reject) => setTimeout(resolve, 750));
  }
};

const sendPiplImages = async (fromPipl, to) => {
  let i = 0;
  for (const person of fromPipl.possible_persons) {
    await sendPiplImagesForPerson(person, i, to);
    i++;
  }
};

const printPiplResult = async (search, result, to) => {
  if (!result.possible_persons) return await send('no results found', to);
  result.possible_persons.forEach((v) => {
    delete v["@search_pointer"];
  });
  await send(await uploadToIPFS(search, JSON.stringify(result, null, 2)), to);
  const summary = { ...result };
  const data = JSON.stringify(summary, null, 2);  await new Promise((resolve, reject) => setTimeout(resolve, 1000));

  await send(data, to);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await sendPiplImages(result, to);
};

const piplNumberLookup = async (number, to) => {
  const cached = await redis.get("pipl." + number);
  if (cached) {
    await printPiplResult(number, JSON.parse(cached), to);
  } else {
    const result = await pipl.search({ phone: number });
    await redis.set("pipl." + number, JSON.stringify(result));
    await redis.expire("pipl." + number, 60 * 60 * 24 * 3);
    await printPiplResult(number, result, to);
  }
};

const twilioLookup = (phoneNumber) =>
  twilio.lookups
    .phoneNumbers(phoneNumber)
    .fetch({ type: ["carrier", "caller-name"] });

const cursors = {};

const splitJid = (jid) => jid.match(/(?:[^@/]+)/g).filter(Boolean);

const personEnrich = (first_name, last_name, region) =>
  peopledatalabs.personEnrich({
    first_name: first_name.toLowerCase(),
    last_name: last_name.toLowerCase(),
    region: region.toLowerCase(),
  });

const personSearch = async (from, query) => {
  const [user] = splitJid(from);
  if (query === "next") {
    if (!cursors[user]) return await send("nothing here ghost", user);
    if (cursors[user].index === cursors[user].total)
      return await send("nothing here ghost", user);
    const response = await peopledatalabs.personSearch({
      sql: cursors[user].query,
      from: cursors[user].index,
      limit: 1,
    });
    response.data =
      (response.data &&
        response.data.map &&
        response.data.map((v) => deleteNullKeys(v))) ||
      response.data;
    cursors[user].total = response.total;
    cursors[user].index++;
    await send(JSON.stringify(response, null, 2), from);
  } else {
    cursors[user] = {
      query,
      index: 0,
      total: 1,
    };
    return await personSearch(from, "next");
  }
};

const deleteNullKeys = (o) => {
  if (typeof o !== "object") return o;
  if (Array.isArray(o)) return o.slice().map((v) => deleteNullKeys(v));
  const result = { ...o };
  Object.keys(result).forEach((v) => {
    if (result[v] === null) delete result[v];
    if (typeof result[v] === "object") result[v] = deleteNullKeys(result[v]);
  });
  return result;
};

const redis = new (require("ioredis"))();

const timeout = (n) => new Promise((resolve) => setTimeout(resolve, n));
const POLL_INTERVAL = 500;

const toJid = ({ host, username }) => {
  return username + "@" + host;
};
const pullIncomingCalls = () => {
  (async () => {
    while (true) {
      try {
        const incomingRaw = await redis.lpop("calls-in");
        if (!incomingRaw) {
          await timeout(POLL_INTERVAL);
          continue;
        } else {
          const incoming = JSON.parse(incomingRaw);
          const jid = toJid({
            host: process.env.DOMAIN,
            username: incoming.did,
          });
          await send("INCOMING:<" + incoming.from + "=>" + incoming.did + ">", jid);
          await callerId(incoming.from, jid);
        }
      } catch (e) {
        console.error(e);
      }
      await timeout(POLL_INTERVAL);
    }
  })().catch((err) => console.error(err));
};
const infura = new (require("ipfs-deploy/src/pinners/infura"))();
const uploadToIPFS = async (search, data) => {
  search = search.replace(/[^\w]+/g, "-").toLowerCase();
  const { cid } = await infura.ipfs.add(Buffer.from(data));
  const result = await infura.pinCid(cid);
  return (
    "https://cloudflare-ipfs.com/ipfs/" + cid + "?filename=" + search + ".txt"
  );
  return v;
};
const callerId = async (number, to) => {
  const twilioResults = await twilioLookup(number);
  await send(JSON.stringify(twilioResults, null, 2), to);
  await piplNumberLookup(number, to);
};

const lookupTruePeopleSearchQuery = async (query) => {
  if (query.match(/^\d+$/)) {
    return await truepeoplesearch.byPhone(query);
  } else {
    const processed = piplQueryToObject(query);
    if (processed.streetaddress) {
      return await truepeoplesearch.byAddress(processed);
    } else {
      return await truepeoplesearch.byName(processed);
    }
  }
};

const lookupFaxVinQuery = async (query) => {
  if (!query.match(/:/)) return await faxvin.lookupPlate({ state: FAXVIN_DEFAULT_STATE, plate: query });
  const processed = piplQueryToObject(query);
  return await faxvin.lookupPlate(processed);
};

const printDossier = async (body, to) => {
  if (body.substr(0, "twilio".length).toLowerCase() === "twilio") {
    const match = body.match(/^twilio\s+(.*$)/i);
    if (match) {
      const search = match[1];
      if (search.length === 11) body = search.substr(1);
      else body = search;
      body = "+1" + search;
      const twilioResults = await twilioLookup(body);
      await send(JSON.stringify(twilioResults, null, 2), to);
      await send("good luck ghost", to);
    }
    return;
  }
  if (body.substr(0, "socialscan".length).toLowerCase() === "socialscan") {
    const match = body.match(/^socialscan\s+(.*$)/);
    if (match) {
      const search = match[1];
      await send(JSON.stringify(await subprocesses.socialscan(search), null, 2), to);
      await talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "whatsmyname".length).toLowerCase() === "whatsmyname") {
    const match = body.match(/^whatsmyname\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("web_accounts_list_checker.py -u " + search, to);
      await send("wait for complete ...", to);
      await send(await subprocesses.whatsmyname(search), to);
      await talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "holehe".length).toLowerCase() === "holehe") {
    const match = body.match(/^holehe\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("holehe " + search, to);
      await send("wait for complete ...", to);
      await send(await subprocesses.holehe(search), to);
      await talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "zgrep ".length).toLowerCase().trim() === "zgrep") {
    const match = body.match(/^zgrep\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send('zgrep -a "' + search + '"', to);
      await send("wait for complete... (this takes a while)", to);
      await send(await runZgrep(search, to), to);
      await send("zgrep:" + search + ": done!", to);
    }
    return;
  }
  if (body.substr(0, "linkedin".length).toLowerCase().trim() === "linkedin") {
    const match = body.match(/^linkedin\s+(.*$)/i);
    if (match) {
      const search = match[1].toLowerCase();
      await send('grep -r "' + search + '"', to);
      await send("wait for complete... (this takes a while)", to);
      await send(await runLinkedIn(search, to), to);
      await send("linkedin:" + search + ": done!", to);
    }
    return;
  }
  if (
    body.substr(0, "zgrep-full ".length).toLowerCase().trim() === "zgrep-full"
  ) {
    const match = body.match(/^zgrep-full\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send('zgrep-full -a "' + search + '"', to);
      await send("wait for complete... (this takes a while)", to);
      await send(await runZgrepFull(search, to), to);
      await send("zgrep-full:" + search + ": done!", to);
    }
    return;
  }
  if (body.substr(0, "truepeoplesearch".length).toLowerCase() === "truepeoplesearch") {
    const match = body.match(/^truepeoplesearch\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("truepeoplesearch-puppeteer " + search, to);
      await send("wait for complete ...", to);
      await send(JSON.stringify(await lookupTruePeopleSearchQuery(search), null, 2), to);
      await talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "facebook".length).toLowerCase() === "facebook") {
    const match = body.match(/^facebook\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("facebook-recover-puppeteer " + search, to);
      await send("wait for complete ...", to);
      await send(JSON.stringify(await facebook.lookupPhone({ phone: search }), null, 2), to);
      await talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "donotcall".length).toLowerCase() === "donotcall") {
    const match = body.match(/^donotcall\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("ghostmaker donotcall " + search, to);
      await send("wait for complete ...", to);
      await (require('/root/ghostmaker')).addToDoNotCall(search);
      await talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "searchdids".length).toLowerCase() === 'searchdids') {
    const match = body.match(/^searchdids\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("searchdids " + search, to);
      const dids = (await searchDIDs(search)).join(', ');
      const link = await uploadToIPFS(search, dids);
      await send(link, to);
      await send(dids, to);
    }
    return;
  }
  if (body.substr(0, "orderdid".length).toLowerCase() === 'orderdid') {
    const match = body.match(/^orderdid\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("orderdid " + search, to);
      try {
        await orderDID(search, to.split('@')[0])
        await send('added!', to);
      } catch (e) {
        await send(e.message, to);
      }
    }
    return;
  }
  if (body.substr(0, "faxvin".length).toLowerCase() === "faxvin") {
    const match = body.match(/^faxvin\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("faxvin-puppeteer " + search, to);
      await send("wait for complete ...", to);
      await send(JSON.stringify(await lookupFaxVinQuery(search), null, 2), to);
      await talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "sherlock".length).toLowerCase() === "sherlock") {
    const match = body.match(/^sherlock\s+(.*$)/i);
    if (match) {
      const search = match[1];
      await send("sherlock " + search + " --print-found", to);
      await send("wait for complete ...", to);
      await subprocesses.sherlock(search, async (data) => await send(data, to));
      await talkGhastly(to);
    }
    return;
  }

  if (body.substr(0, 4).toLowerCase() === "pipl") {
    const match = body.match(/^(?:p|P)ipl\s+(.*$)/);
    if (match) {
      const search = match[1];
      if (search.indexOf(":") !== -1) {
        const fromPipl = await pipl.search(piplQueryToObject(search));
        await printPiplResult(search, fromPipl, to);
        return;
      } else if (search.indexOf("@") !== -1) {
        const data = await pipl.search({ email: search });
	      console.log(data);
        await printPiplResult(search, data, to);
        return;
      } else if (search.match(/\d+/)) {
        const data = await pipl.search({ phone: search });
        await printPiplResult(search, data, to);
        return;
      } else {
        const split = search.split(/\s+/);
        const data = await pipl.search({
          first_name: split[0],
          last_name: split[1],
          state: split[2],
        });
        await printPiplResult(search, data, to);
        return;
      }
    }
  } else if (/(?:^\d{10,11}$)/.test(body)) {
  } else if (body.match(/\w+/g).length === 3) {
    const [first_name, last_name, region] = body.match(/\w+/g);
    send(
      JSON.stringify(
        await personEnrich(first_name, last_name, region),
        null,
        2
      ),
      to
    );
    await talkGhastly(to);
  } else if (body.match(/^(?:SELECT|next)/g)) {
    await personSearch(to, body);
    await talkGhastly(to);
  }
};

exports.startDossi = async () => {
  await client.start();
  console.log('client started!');
  client.on('room.message', async (roomId, event) => {
    if (!event.content) return;
    const { sender, content: { body } } = event;
    if (sender.match('dossi')) return;
    await printDossier(body, roomId);
  });
};
