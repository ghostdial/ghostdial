"use strict";

const request = require("request");
if (process.env.NODE_ENV === "development") require("request-debug")(request);

const fns = require("./fns");
const qs = require("query-string");

class VoipmsClient {
  static fromEnv() {
    return new this({ username: process.env.VOIPMS_USERNAME, password: process.env.VOIPMS_PASSWORD });
  }
  constructor({ username, password }) {
    this.config = {
      username,
      password,
    };
    Object.assign(
      this,
      fns.reduce((r, v) => {
        r[v] = {
          get: async (o) => {
            return await this._requestGet({
              ...o,
              method: v,
            });
          },
          post: async (o) => {
            return await this._requestPost({
              ...o,
              method: v,
            });
          },
        };
        return r;
      }, {})
    );
  }
  async _requestGet(o) {
    return new Promise((resolve, reject) => {
      request(
        {
          method: "GET",
          url: `https://voip.ms/api/v1/rest.php?api_username=${
            this.config.username
          }&api_password=${this.config.password}&${qs.stringify({
            ...o,
            content_type: "json",
          })}`,
          headers: this.makeHeaders()
        },
        (err, response) => {
          if (err) return reject(err);
          try {
            try {
              const result = JSON.parse(response.body);
              resolve(result);
            } catch (e) {
              if (process.env.NODE_ENV === "development")
                console.error(response.body);
              throw Error("failed to parse JSON from voip.ms");
            }
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }
  makeHeaders() {
    return {
      Host: "voip.ms",
      Referer: 'https://voip.ms/m/api.php',
      Origin: 'voip.ms',
      'User-Agent': 'curl/7.68.0'
    };
  } 
  async _requestPost(o) {
    return new Promise((resolve, reject) => {
      request(
        {
          method: "POST",
          url: "https://voip.ms/api/v1/rest.php",
          headers: this.makeHeaders(),
          json: {
            api_username: this.config.username,
            api_password: this.config.password,
            ...o,
            content_type: "json",
          },
        },
        (err, response) => {
          try {
            return err ? reject(err) : resolve(JSON.parse(response.body));
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }
}

Object.assign(
  VoipmsClient.prototype,
  fns.reduce((r, v) => {}, {})
);

module.exports = VoipmsClient;
