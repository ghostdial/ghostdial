"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUCKET_NAME = exports.storage = void 0;
const storage_1 = require("@google-cloud/storage");
exports.storage = new storage_1.Storage();
exports.BUCKET_NAME = process.env.VOICEMAIL_BUCKET || ((process.env.DOMAIN || 'ghostdial.net').replace(/\./g, '-') + '-voicemail-bucket');
//# sourceMappingURL=storage.js.map