'use strict';

const _request = require('request');
const url = require('url');


const urlParams = {
  hostname: 'api.peopledatalabs.com',
  protocol: 'https:',
  port: 443
};

const makeUrl = (pathname) => url.format({
  ...urlParams,
  pathname
});

const request = async (o) => await new Promise((resolve, reject) => _request(o, (err, resp) => err ? reject(err) : resolve(resp)));

class PeopleDataLabsClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.PEOPLEDATALABS_API_KEY;
  }
  _makeParams(o) {
    return {
      ...o,
      api_key: this.apiKey
    };
  }
  async _get(pathname, params = {}) {
    return await request({
	    url: makeUrl(pathname),
	    method: 'GET',
	    qs: this._makeParams(params)
    });
  }
  async personEnrich(o) {
    return JSON.parse((await this._get('/v5/person/enrich', o)).body);
  }
  async personSearch(o) {
    return JSON.parse((await this._get('/v5/person/search', o)).body);
  }
}

module.exports = PeopleDataLabsClient;
