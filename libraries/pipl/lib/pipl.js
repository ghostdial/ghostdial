const request = require('request');
const url = require('url');

const BASE_URL = 'api.pipl.com';

const fetch = async (o) => await new Promise((resolve, reject) => request(o, (err, resp) => err ? reject(err) : resolve(resp)));

async function search(o) {
  return JSON.parse((await fetch({
    method: 'GET',
    url: url.format({
      hostname: BASE_URL,
      protocol: 'https:',
      pathname: '/search'
    }),
    qs: {
      ...o,
      key: process.env.PIPL_API_KEY
    }
  })).body);
}

async function personSearch(o) {
  return JSON.parse((await fetch({
    method: 'GET',
    url: url.format({
      hostname: BASE_URL,
      protocol: 'https:',
      pathname: '/search'
    }),
    qs: {
      person: JSON.stringify(o),
      key: process.env.PIPL_API_KEY
    }
  })).body);
}

module.exports.search = search;

module.exports.personSearch = personSearch;
