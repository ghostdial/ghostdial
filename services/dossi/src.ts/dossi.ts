"use strict";
import debug from "@xmpp/debug";
import url from "url";
import { client, xml } from "@xmpp/client";
import subprocesses from "@ghostdial/subprocesses";
import xid from "@xmpp/id";
import pipl from "@ghostdial/pipl";
import VoipMs from "@ghostdial/voipms";
import fs from "fs-extra";
import { FaxvinPuppeteer } from "faxvin-puppeteer";
import { Client } from "ssh2";
import child_process from "child_process";
import Redis from "ioredis";

import path from "path";
import { mkdirp } from "mkdirp";
import lodash from "lodash";
import { TruePuppeteer } from "truepeoplesearch-puppeteer";
import facebook from "facebook-recover-puppeteer";
import OpenAI from "openai-api";
import { logger } from "./logger";
import crypto from "crypto";

const ZGREP_SSH_HOSTNAME = process.env.ZGREP_SSH_HOSTNAME;
const ZGREP_SSH_PORT = process.env.ZGREP_SSH_PORT;
const ZGREP_SSH_IDENTITY =
  process.env.ZGREP_SSH_IDENTITY ||
  path.join(process.env.HOME, ".ssh", "id_rsa");
const ZGREP_SSH_USER = process.env.ZGREP_SSH_USER;
const ZGREP_DIR = process.env.ZGREP_DIR;
const VOIPMS_SUBACCOUNT = process.env.VOIPMS_SUBACCOUNT || process.env.VOIPMS_SIP_USERNAME;
const VOIPMS_POP = process.env.VOIPMS_POP || 'atlanta1.voip.ms';
const ZGREP_MAX_RESULTS = Number(process.env.ZGREP_MAX_RESULTS || 1000);
const FAXVIN_DEFAULT_STATE = process.env.FAXVIN_DEFAULT_STATE;

const openai = new OpenAI(process.env.OPENAI_API_KEY || '') as any;
const answerQuestion = async (question, to) => {
  const documents = [];
  const context = await redis.get('context.' + to);
  if (context) documents.push(context);
  else documents.push('The year is 2022.');
  let temperature = Number(await redis.get('temperature.' + to) || 0.9);
  if (isNaN(temperature)) temperature = 0.9;
  const gptResponse = await openai.answers({
    documents,
    question,
    temperature,
    search_model: "davinci",
    model: "davinci",
    examples_context: "The Scarlet Letter by Nathaniel Hawthorne, adulteress Hester Prynne must wear a scarlet A to mark her shame. Her lover, Arthur Dimmesdale, remains unidentified and is wracked with guilt, while her husband, Roger Chillingworth, seeks revenge. The Scarlet Letter's symbolism helps create a powerful drama in Puritan Boston: a kiss, evil, sin, nature, the scarlet letter, and the punishing scaffold. Nathaniel Hawthorne's masterpiece is a classic example of the human conflict between emotion and intellect.",
    examples: [["What is the reason women would have to wear a scarlet A embroidered on their clothing in Puritan Boston?", "They would wear the scarlet A if they committed adultery."], ["What is the surname of the unidentified man who Hester cheated on Roger with?", "The unidentified man is named Dimmesdale."], ["What should I say to Hester?", "Don't worry about the haters. Roger is a trick, and there's no proof adultery is a sin."]],
    max_tokens: 200,
    stop: ["\n", "<|endoftext|>"],
  });
  await send(gptResponse.data.answers[0], to);
};

const sendResults = async (results, query, to) => {
  const lines = results.split("\n");
  const chunks = lodash.chunk(lines, 50);
  for (const chunk of chunks) {
    logger.info(chunk);
    send("zgrep:" + query + ":" + chunk.join("\n"), to);
    await new Promise((resolve, reject) => setTimeout(resolve, 300));
  }
};
const sendLinkedInResults = async (results, query, to) => {
  const lines = results.split("\n").map((v) => v.substr(v.indexOf('{')));
  const chunks = lodash.chunk(lines, 50);
  for (const chunk of chunks) {
    send(chunk.join("\n"), to);
    await new Promise((resolve, reject) => setTimeout(resolve, 300));
  }
};

const searchDIDs = async (query) => {
  const processed = piplQueryToObject(query);
  const result = await VoipMs.fromEnv().searchDIDsUSA.get(processed);
  return (result.dids || []).map((v) => v.did);
};

const orderDID = async (number, sourceDid) => {
  const vms = VoipMs.fromEnv();
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
        logger.info("session::remote: opened");
        client.exec(
          'grep -r "' + query + '" ' + process.env.LINKEDIN_DIR + "/*",
          (err, stream) => {
            if (err) {
              client.end();
              return reject(err);
            }
            logger.info("session::remote: ran " + query);
            let data = "";
            stream.setEncoding("utf8");
            stream.stderr.setEncoding("utf8");
            stream.stderr.on("data", (data) => logger.error(data));
            stream.on("data", (_data) => {
              sendLinkedInResults(_data, query, to).catch((err) => logger.error(err));
            });
            stream.on("close", (code, signal) => {
              client.end();
              logger.info("session::remote: close");
              logger.info(data);
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
        logger.info("session::remote: opened");
        client.exec(
          'zgrep -a "' + query + '" ' + ZGREP_DIR + "/*",
          (err, stream) => {
            if (err) {
              client.end();
              return reject(err);
            }
            logger.info("session::remote: ran " + query);
            let data = "";
            stream.setEncoding("utf8");
            stream.stderr.setEncoding("utf8");
            stream.stderr.on("data", (data) => logger.error(data));
            stream.on("data", (_data) => {
              logger.info(_data);
              sendResults(_data, query, to).catch((err) => logger.error(err));
            });
            stream.on("close", (code, signal) => {
              client.end();
              logger.info("session::remote: close");
              logger.info(data);
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
        logger.info("session::remote: opened");
        client.exec(
          'zgrep -a "' + query + '" ' + path.parse(ZGREP_DIR).dir + "/*",
          (err, stream) => {
            if (err) {
              client.end();
              return reject(err);
            }
            logger.info("session::remote: ran " + query);
            let data = "";
            stream.setEncoding("utf8");
            stream.stderr.setEncoding("utf8");
            stream.stderr.on("data", (data) => logger.error(data));
            stream.on("data", (_data) => {
              logger.info(_data);
              sendResults(_data, query, to).catch((err) => logger.error(err));
            });
            stream.on("close", (code, signal) => {
              client.end();
              logger.info("session::remote: close");
              logger.info(data);
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
  try {
    return query
      .match(/([^\s:]+):((?:"((?:[^"\\]|\\[\s\S])*)")|(?:\S+))/g)
      .map((v) =>
        v.split(":").map((v) => (v.substr(0, 1) === '"' ? JSON.parse(v) : v))
      )
      .reduce((r, [key, value]) => {
      r[key] = value;
      return r;
      }, {});
  } catch (e) {
    return {};
  }
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
const talkGhastly = (to) => {
  send(spookyStuff[Math.floor(Math.random() * spookyStuff.length)], to);
};

let xmpp = null;

const from = "dossi@" + process.env.DOMAIN;

const send = (msg, to) => {
  xmpp.send(
    xml("message", { to, from, id: xid(), type: "chat" }, xml("body", {}, msg))
  );
};

/* 
const ack = (stz) => {
  xmpp.send(xml('message', { to, from, id: xid(), type: 'chat' }, xml('receipt
  */

const twilio = new (require("twilio"))();
const peopledatalabs = new (require("peopledatalabs"))();

const sendPiplImagesForPerson = async (person, i, to) => {
  if ((person.images || []).length) {
    send("IMAGES FOR MATCH " + String(i), to);
    i++;
    await new Promise((resolve, reject) => setTimeout(resolve, 300));
  }
  for (const image of person.images || []) {
    await new Promise((resolve, reject) => setTimeout(resolve, 750));
    send(image.url, to);
    await new Promise((resolve, reject) => setTimeout(resolve, 750));
    xmpp.send(
      xml(
        "message",
        { to, from, id: xid(), type: "chat" },
        xml("body", {}, image.url) +
          xml("x", { xmlns: "jabber:x:oob" }, xml("url", {}, image.url))
      )
    );
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
  if (!result.possible_persons) return send('no results found', to);
  result.possible_persons.forEach((v) => {
    delete v["@search_pointer"];
  });
  const summary = { ...result };
  const data = JSON.stringify(summary, null, 2);  await new Promise((resolve, reject) => setTimeout(resolve, 1000));

  send(data, to);
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
    if (!cursors[user]) return send("nothing here ghost", user);
    if (cursors[user].index === cursors[user].total)
      return send("nothing here ghost", user);
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
    send(JSON.stringify(response, null, 2), from);
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

const redis = new Redis(process.env.REDIS_URI || 'redis://127.0.0.1:6379');

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
          send("INCOMING:<" + incoming.from + "=>" + incoming.did + ">", jid);
          await callerId(incoming.from, jid);
        }
      } catch (e) {
        logger.error(e);
      }
      await timeout(POLL_INTERVAL);
    }
  })().catch((err) => logger.error(err));
};
const callerId = async (number, to) => {
  const twilioResults = await twilioLookup(number);
  send(JSON.stringify(twilioResults, null, 2), to);
};

const lookupTruePeopleSearchQuery = async (query) => {
  const truepeoplesearch = await TruePuppeteer.initialize({ noSandbox: true, logger: { info(v) { logger.info(v); } } }) as TruePuppeteer;
  let result = null;
  if (query.match(/^\d+$/)) {
    result = await truepeoplesearch.searchPhone({ phone: query } as any);
  } else {
    const processed = piplQueryToObject(query);
    if (processed.streetaddress) {
      result = await truepeoplesearch.searchAddress(processed);
    } else {
      result = await truepeoplesearch.searchName(processed);
    }
  }
  await truepeoplesearch._browser.close();
  return result;
};

const lookupFaxVinQuery = async (query) => {
  const faxvin = await FaxvinPuppeteer.initialize({ noSandbox: true, logger: { info(v) { logger.info(v); } } }) as FaxvinPuppeteer;
  const processed = piplQueryToObject(query);
  const result = await faxvin.searchPlate(query);
  await faxvin.close();
  return result;
};

const parseConfiguration = (s) => {
  return s.match(/\[[^\[]+/mg)
    .map((v) => ({
      section: ((s) => s.substr(1, s.length - 2))(v.match(/\[(?:[^\]]+)\]/g)[0]),
      modifier: ((s) => s && s[0].substr(1))(v.match(/\((?:[^\)]+)/g)),
      fields: v.split('\n').slice(1)
        .reduce((r, v) => {
          const split = v.split('=');
          if (split[0][0] && split[0][0] !== ';') {
            r[split[0]] = split[1];
	  }
          return r;
        }, {})
     }));
};

const parseVoicemail = (s): any => {
  const fields = s
    .split("\n")
    .filter(Boolean)
    .filter((v) => v[0] !== ";");
  const result = {};
  let tag = "";
  fields.forEach((v) => {
    if (v[0] === "[") {
      tag = v.substr(1, v.length - 2);
      result[tag] = [];
    } else {
      if (v.match("=>")) {
        result[tag].push({
          type: "mapping",
          key: v.split("=>")[0].trim(),
          value: v.split("=>")[1].trim().split(",").filter(Boolean),
        });
      } else {
        result[tag].push({
          type: "field",
          key: v.split("=")[0].trim(),
          value: v.split("=")[1].trim(),
        });
      }
    }
  });
  return result;
};

const buildVoicemail = (voicemailAccounts) => {
  return Object.entries(voicemailAccounts).map(([ section, rows ]: any) => {
    return [ '[' + section + ']', ...rows.map((v) => v.type === 'field' ? (v.key + ' = ' + v.value) : (v.key + ' => ' + v.value.join(','))) ].join('\n');
  }).join('\n\n');
};

const buildConfiguration = (o) => {
  return o.map((v) => [
    '[' + v.section + ']' + (v.modifier ? '(' + v.modifier + ')' : ''),
    ...Object.entries(v.fields).map(([ k, v ]) => String(k) + '=' + String(v))
  ].join('\n')).join('\n\n');
};

const readVoicemail = async () => {
  return parseVoicemail(await fs.readFile('/etc/asterisk/voicemail.conf', 'utf8'));
};

const writeVoicemail = async (voicemailAccounts) => {
  await fs.writeFile('/etc/asterisk/voicemail.conf', buildVoicemail(voicemailAccounts));
};

const readSipAccounts = async () => {
  return parseConfiguration(await fs.readFile('/etc/asterisk/sip.conf', 'utf8'));
};

const writeSipAccounts = async (sipAccounts) => {
  await fs.writeFileSync('/etc/asterisk/sip.conf', buildConfiguration(sipAccounts));
  const proc = child_process.spawn('bash', ['-c', 'asterisk -rx "sip reload"; asterisk -rx "voicemail reload"']);
  return await new Promise<any>((resolve, reject) => proc.on('close', (code) => {
    if (code !== 0) return reject(Error('non-zero exit code: ' + String(code)));
    return resolve(null);
  }));
};
  

const printDossier = async (body, to) => {
  if (body.substr(0, "block-voip".length).toLowerCase() === "block-voip") {
    const ext = await redis.get('extfor.', to);
    if (!ext) return;
    await redis.del('voip-passthrough.' + ext);
    talkGhastly(to);
    return;
  }
  if (body.substr(0, "unblock-voip".length).toLowerCase() === "unblock-voip") {
    const ext = await redis.get('extfor.', to);
    if (!ext) return;
    await redis.set('voip-passthrough.' + ext, '1');
    talkGhastly(to);
    return;
  }
  if (body.substr(0, "ghostem".length).toLowerCase() === "ghostem") {
    await redis.set('ghostem.' + to, '1');
    talkGhastly(to);
    return;
  }
  if (body.substr(0, "unghostem".length).toLowerCase() === "unghostem") {
    await redis.del('ghostem.' + to);
    talkGhastly(to);
    return;
  }
  if (body.substr(0, "register".length).toLowerCase() === "register") {
    const match = body.match(/\s+/g).slice(1).join(' ');
    if (!match || isNaN(match)) {
      send('must send "register NXX" i.e. "register 123"', to);
    } else {
      const sipAccounts = await readSipAccounts();
      const account = sipAccounts.find((v) => v.section === match);
      if (!account) {
        if (match.length < 4) {
          const password = crypto.randomBytes(8).toString('hex');
          sipAccounts.push({
            section: match,
            modifier: 'friends_internal',
            fields: {
              secret: password,
              defaultuser: match,
              nat: 'force_rport,comedia',
              context: 'authenticated'
	    }
	  });
          const voicemailAccounts = await readVoicemail();
          voicemailAccounts.default = voicemailAccounts.default || [];
          const pin = String(1000 + Math.floor(Math.random()*9000));
          voicemailAccounts.default.push({
            type: 'mapping',
            key: match,
            value: pin
	  });
          await writeVoicemail(voicemailAccounts);
          await redis.set('extfor.' + to, match);
          send('SIP password: ' + password, to);
          send('PIN: ' + pin, to);
	} else {
          const ext = await redis.get('extfor.' + to);
          if (!ext) {
            send('must register a 3 digit extension first from this handle', to);
	  } else {
            const extAccount = sipAccounts.find((v) => v.section === ext);
            sipAccounts.push({
              section: match,
              modifier: 'friends_internal',
              fields: {
                secret: account.fields.secret,
                nat: 'force_rport,comedia',
                context: 'anonymous_device',
                defaultuser: match
	      }
	    });
            await redis.hset('devicelist.' + extAccount, match, '1');
            await redis.set('extfordevice.' + match, extAccount);
            send('registered ' + match + ' to ' + extAccount, to);
	  }
	}
      } else {
        send('already registered', to);
      }
    }
    talkGhastly(to);
    return;
  }
  if (body.substr(0, "socialscan".length).toLowerCase() === "socialscan") {
    const match = body.match(/^socialscan\s+(.*$)/);
    if (match) {
      const search = match[1];
      send(JSON.stringify(await subprocesses.socialscan(search), null, 2), to);
      talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "whatsmyname".length).toLowerCase() === "whatsmyname") {
    const match = body.match(/^whatsmyname\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("web_accounts_list_checker.py -u " + search, to);
      send("wait for complete ...", to);
      send(await subprocesses.whatsmyname(search), to);
      talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "holehe".length).toLowerCase() === "holehe") {
    const match = body.match(/^holehe\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("holehe " + search, to);
      send("wait for complete ...", to);
      send(await subprocesses.holehe(search), to);
      talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "zgrep ".length).toLowerCase().trim() === "zgrep") {
    const match = body.match(/^zgrep\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send('zgrep -a "' + search + '"', to);
      send("wait for complete... (this takes a while)", to);
      send(await runZgrep(search, to), to);
      send("zgrep:" + search + ": done!", to);
    }
    return;
  }
  if (body.substr(0, "linkedin".length).toLowerCase().trim() === "linkedin") {
    const match = body.match(/^linkedin\s+(.*$)/i);
    if (match) {
      const search = match[1].toLowerCase();
      send('grep -r "' + search + '"', to);
      send("wait for complete... (this takes a while)", to);
      send(await runLinkedIn(search, to), to);
      send("linkedin:" + search + ": done!", to);
    }
    return;
  }
  if (
    body.substr(0, "zgrep-full ".length).toLowerCase().trim() === "zgrep-full"
  ) {
    const match = body.match(/^zgrep-full\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send('zgrep-full -a "' + search + '"', to);
      send("wait for complete... (this takes a while)", to);
      send(await runZgrepFull(search, to), to);
      send("zgrep-full:" + search + ": done!", to);
    }
    return;
  }
  if (body.substr(0, "truepeoplesearch".length).toLowerCase() === "truepeoplesearch") {
    const match = body.match(/^truepeoplesearch\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("truepeoplesearch-puppeteer " + search, to);
      send("wait for complete ...", to);
      send(JSON.stringify(await lookupTruePeopleSearchQuery(search), null, 2), to);
      talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "facebook".length).toLowerCase() === "facebook") {
    const match = body.match(/^facebook\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("facebook-recover-puppeteer " + search, to);
      send("wait for complete ...", to);
      send(JSON.stringify(await facebook.lookupPhone({ phone: search }), null, 2), to);
      talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "donotcall".length).toLowerCase() === "donotcall") {
    const match = body.match(/^donotcall\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("ghostmaker donotcall " + search, to);
      send("wait for complete ...", to);
      await (require('/root/ghostmaker')).addToDoNotCall(search);
      talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "searchdids".length).toLowerCase() === 'searchdids') {
    const match = body.match(/^searchdids\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("searchdids " + search, to);
      const dids = (await searchDIDs(search)).join(', ');
      send(dids, to);
    }
    return;
  }
  if (body.substr(0, "orderdid".length).toLowerCase() === 'orderdid') {
    const match = body.match(/^orderdid\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("orderdid " + search, to);
      try {
        await orderDID(search, to.split('@')[0])
        send('added!', to);
      } catch (e) {
        send(e.message, to);
      }
    }
    return;
  }
  if (body.substr(0, "faxvin".length).toLowerCase() === "faxvin") {
    const match = body.match(/^faxvin\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("faxvin-puppeteer " + search, to);
      send("wait for complete ...", to);
      send(JSON.stringify(await lookupFaxVinQuery(search), null, 2), to);
      talkGhastly(to);
    }
    return;
  }
  if (body.substr(0, "sherlock".length).toLowerCase() === "sherlock") {
    const match = body.match(/^sherlock\s+(.*$)/i);
    if (match) {
      const search = match[1];
      send("sherlock " + search + " --print-found", to);
      send("wait for complete ...", to);
      await subprocesses.sherlock(search, (data) => send(data, to));
      talkGhastly(to);
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
	      logger.info(data);
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
    if (body.length === 11) body = body.substr(1);
    body = "+1" + body;
    const twilioResults = await twilioLookup(body);
    const peopleDataLabsResults = deleteNullKeys(
      await peopledatalabs.personEnrich({ phone: body })
    );
    send(JSON.stringify({ twilioResults, peopleDataLabsResults }, null, 2), to);
    send("good luck ghost", to);
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
    talkGhastly(to);
  } else if (body.match(/^(?:SELECT|next)/g)) {
    await personSearch(to, body);
    talkGhastly(to);
  }
  if (body.substr(0, 'context:'.length) === 'context:') {
    await redis.set('context.' + to, body.substr('context:'.length));
    send('set', to);
    return;
  }
  if (body.substr(0, 'temperature:'.length) === 'temperature:') {
    await redis.set('temperature.' + to, body.substr('context:'.length));
    send('set', to);
    return;
  }
  if (body.substr(0, 'answer:'.length) === 'answer:') {
    await answerQuestion(body.substr('answer:'.length), to);
    return;
  }
};


export async function run() {
  xmpp = client({
    service: process.env.DOMAIN,
    resource: "dossi",
    username: "dossi",
    password: process.env.ROOT_PASSWORD || "password",
  });
  debug(xmpp, true);
  xmpp.on("online", () => {
    logger.info("online!");
    xmpp.send(xml("presence"));
  });
  xmpp.on("stanza", async (stanza) => {
    if (!stanza.is("message")) return;
    if (!stanza.getChild("body")) return;
    const to = stanza.attrs.from;
    let body = stanza.getChild("body").children[0].trim();
    await printDossier(body, to);
  });
  await xmpp.start();
  pullIncomingCalls();
}
