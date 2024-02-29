import { Storage } from "@google-cloud/storage";
export const storage = new Storage();
export const BUCKET_NAME = process.env.VOICEMAIL_BUCKET || ((process.env.DOMAIN || 'ghostdial.net').replace(/\./g, '-') + '-voicemail-bucket');
