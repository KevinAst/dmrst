/**
 * Simple encryption utility.
 *
 * Uses Symmetric Encryption - where only ONE key is needed.
 * - when multiple parties are involved, the both parties need the key.
 * - in our usage however, there is ONLY ONE party:
 *   * because the server performs both encrypt/decrypt operations
 *   * the client merely retains the data
 *
 * REFERENCES:
 * - Node Crypto docs
 *   ... https://nodejs.org/api/crypto.html
 * - Cryptography Concepts for Node.js Developers
 *   ... https://fireship.io/lessons/node-crypto-examples/
 * - Data Encryption and Decryption in Node.js using Crypto
 *   ... https://www.section.io/engineering-education/data-encryption-and-decryption-in-node-js-using-crypto/#nodejs-crypto-module
 * - How to encrypt and decrypt data in Node.js
 *   ... https://attacomsian.com/blog/nodejs-encrypt-decrypt-data
 */

import {createCipheriv, randomBytes, createDecipheriv} from 'crypto'; //... the node.js built-in crypto library

import check       from '../core/util/check';
import {isString}  from '../core/util/typeCheck';

// import logger from '../core/util/logger';   // NOT USED ... to sensitive to log
// const  log    = logger('vit:server:util/encryption');

// various encoding directives
const ALGORITHM       = 'aes256';
const INPUT_ENCODING  = 'utf8';
const OUTPUT_ENCODING = 'hex';

// our Private Security Key
// - originally generated as:
//     console.log(`Place this in .env ... ENCRYPTION_KEY = ${randomBytes(32).toString(OUTPUT_ENCODING)}`);
// - persisted in our environment (because it is a secret), AND it must be consistently retained/used
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, OUTPUT_ENCODING);


//*-------------------------------------------------
//* Encrypt the supplied text.
//* PARM:   text: the text string to encrypt
//* RETURN: hash: encrypted result
//* ERROR:  invalid text supplied
//*-------------------------------------------------
export function encrypt(text) {

  // validate parameters
  const checkParam = check.prefix('encrypt() parameter violation: ');
  checkParam(isString(text), `text must be a string`);

  // our Initialization Vector
  // - provides randomness to our result
  // - encode this in encoded in result (for decrypt usage)
  const iv    = randomBytes(16);
  const ivHex = iv.toString(OUTPUT_ENCODING);
  // log(`iv (randomBytes(16): '${iv}'`); // TEMP (too sensitive to log)

  // create a cipher to perform the encryption
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  // encrypt
  // ... embed Initialization Vector to support decryption
  const hash = ivHex + cipher.update(text, INPUT_ENCODING, OUTPUT_ENCODING) + cipher.final(OUTPUT_ENCODING);
  // log(`encrypt('${text}'): '${hash}'`); // TEMP (too sensitive to log)

  // beam me up Scotty :-)
  return hash;
}


//*-------------------------------------------------
//* Decrypt the supplied hash.
//* PARM:   hash: the encrypted has to decrypt
//* RETURN: text: the text string result
//* ERROR:  invalid hash supplied
//*-------------------------------------------------
export function decrypt(hash) {

  const indxBrk = 32; // 16 bytes in hex

  // validate parameters
  const checkParam = check.prefix('decrypt() parameter violation: ');
  checkParam(hash,                   'hash is required');
  checkParam(isString(hash),         'hash must be a string');
  checkParam(hash.length > indxBrk, 'invalid hash (NOT encrypted with this utility)');

  // pull out our Initialization Vector (needed for decrypt)
  // - provides randomness to our result
  // - pull out of result (for decrypt usage)
  const ivHex   = hash.substring(0, indxBrk); // 1st part: the iv
  const iv      = Buffer.from(ivHex, OUTPUT_ENCODING);

  // reconstitute the hash (separate from the IV)
  hash = hash.substring(indxBrk); // 2nd part: real hash

  // create a decipher to perform the decryption
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  // decrypt
  let text = decipher.update(hash, OUTPUT_ENCODING, INPUT_ENCODING) + decipher.final(INPUT_ENCODING);
  text = text.toString(INPUT_ENCODING);
  // log(`decrypt('${hash}'): '${text}'`); // TEMP (too sensitive to log)

  // that's all folks :-)
  return text;
}
