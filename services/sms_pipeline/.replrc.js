
var VoipmsClient = require('./lib/voipms')

var client = new VoipmsClient({
  username: 'voipms@bishgan.anonaddy.com',
  password: 'Ymx2bnra!!'
});

var redis = new (require('ioredis'))();
