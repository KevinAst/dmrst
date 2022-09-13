import logger from './logger';
const  log = logger('vit:core:pause');

/**
 * An asynchronous pause for a specified amount of time.
 *
 * This utility is merely a promise-wrapped `setTimeout()`.
 *
 * @param {number} ms - the number of milliseconds to pause.
 *
 * @param {string} [errMsg] - an optional error message that when
 * supplied will result in an error resolution (once the pause has
 * expired).  This parameter is typically used in a diagnostic
 * utility.
 *
 * @return {string} an indication of what has transpired
 * (ex: '*** pause() *** paused ${ms} ms');
 *
 * @throws {Error} when errMsg is supplied.
 */
export default function pause(ms, errMsg=null) {
  return new Promise( (resolve, reject) => {
    const msg = `*** pause() *** pausing ${ms} ms`;
    log(msg + (errMsg ? ` ... culminating in an Error: ${errMsg}` : ''));
    setTimeout(() => {
      if (errMsg) {
        reject(new Error(errMsg));
      }
      else {
        resolve(msg);
      }
    }, ms);
  });
}
