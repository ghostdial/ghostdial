var request = require('request');
var str = require('string-to-stream');

const OPENAI_API_URL = 'https://api.openai/v1/files';
var uploadFileToOpenAI = async (filename, text, metadata = '') => {
  return new Promise((resolve, reject) => {
    var stream = str(JSON.stringify({ text, metadata })).pipe(request({
      method: 'POST',
      url: 'https://api.openai.com/v1/files',
      qs: {
        file: '@' + filename,
        purpose: 'answers'
      }
    }));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
};

//const retrieveFileFromOpenAI = async (
