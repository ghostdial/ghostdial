'use strict';

const request = require('request');
const path = require('path');

const SMS_SQLITE3_DATABASE = process.env.SMS_SQLITE3_DATABASE || path.join(process.env.HOME, '.sms_pipeline', 'sms.db');
const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: SMS_SQLITE3_DATABASE
  }
});
const lodash = require('lodash');

const stringToStream = require('string-to-stream');

const getJsonlForExtension () => {
  const messages = await knex('messages').select('messages.*');
  const jsonl = Object.values(lodash.groupBy(messages, (v) => [ v.from, v.to ].sort().join(''))).map((v) => v.map((u) => 'message from phone number ' + u.from ' to ' + u.to + ' at timestamp ' + String(u.timestamp) + ': ' + u.message + (u.attachments.length ? ' <image>' : '')).join('\n')).map((v) => JSON.stringify({ text: v, metadata: 'a thread of conversation between two individuals ' })).join('\n');
  const stream = stringToStream(jsonl).pipe(request({
	  url: 'https://beta.openai.com',
	  form: {
		  purpose: 'answers',
		  file: '
};
  
  return messages;
};
