//***
//*** Reusable socket.io utilities
//***

import logger from './logger';
const  log = logger('vit:core:socketIOUtils'); 

/**
 * socketActFn(): Emits a re-usable function (with access to the
 *                supplied resolve/reject promise artifacts) that
 *                provides a standard way to acknowledge a return
 *                value (and errors) within an asynchronous promise
 *                wrapping a socket.io event (i.e. implementing an
 *                asynchronous request/response API)
 *
 * return:        function ack({value, errMsg, userMsg}): void
 *                - all named params are mutually exclusive
 *                  * value:   emits the supplied value
 *                  * errMsg:  throws an "unexpected" error
 *                  * userMsg: throws an "expected" error (with an embedded userMsg)
 *                - when ALL params are omitted:
 *                  * a void value is emitted (i.e. undefined)
 *
 * USAGE:         CLIENT (sign-in sample):
 *                  export function signIn(userId, pass) {
 *                    // promise wrapper of our socket message protocol
 *                    return new Promise((resolve, reject) => {
 *                      // issue the 'sign-in' socket request to our server
 *                      socket.emit('sign-in', userId, pass, socketAckFn(resolve, reject));
 *                    });
 *                  }
 *                SERVER (sign-in sample):
 *                  socket.on('sign-in', (userId, pass, ack) => {
 *                    ... snip snip (app-specific logic)
 *                    
 *                    // report expected user msg
 *                    return ack({userMsg: 'password incorrect',
 *                                errMsg:  'User Error in sign-in process'});
 *                    
 *                    // report unexpected error
 *                    return ack({errMsg: 'a bad thing happened'});
 *                    
 *                    // communicate successful value
 *                    return ack({value: myResult});
 *                    
 *                    // communicate void value
 *                    return ack();
 *                  });
 * 
 * NOTE:          This utility REQUIRES the activation of ErrorExtensionPolyfill.js
 *                (see Error#defineUserMsg() usage - below).
 */
export function socketAckFn(resolve, reject) {

  // confirm that ErrorExtensionPolyfill has been enabled
  if (!Error.prototype.defineUserMsg) {
    throw new Error('*** ERROR *** socketAckFn() requires the activation of ErrorExtensionPolyfill.js');
  }

  // emit our socket acknowledgment function
  return ({value=undefined, errMsg=undefined, userMsg=undefined}={}) => {
    commonPayloadHandler(resolve, reject, value, errMsg, userMsg);
  }
}


// WITH TIMEOUT:
//      When timeout is used, socket.io introduces an additional pipe (so to speak)
//      where the payload parameter is passed as the 2nd param (timeout errors as the 1st param)
//      SOOO: the returned function is identical to socketAckFn() EXCEPT it introduces a new 1st param: err
export function socketAckFn_timeout(resolve, reject) {

  // confirm that ErrorExtensionPolyfill has been enabled
  if (!Error.prototype.defineUserMsg) {
    throw new Error('*** ERROR *** socketAckFn_timeout() requires the activation of ErrorExtensionPolyfill.js');
  }

  // emit our socket acknowledgment function
  return (err, {value=undefined, errMsg=undefined, userMsg=undefined}={}) => {
    // log(`IN socketAck_timeout(err, {value,errMsg,userMsg}): `, {err, value, errMsg, userMsg});
    // handle timeout errors
    if (err) {
      reject(err);
    }
    // handle our normal app-specific payload (can be errors too)
    else {
      commonPayloadHandler(resolve, reject, value, errMsg, userMsg);
    }
  }
}

function commonPayloadHandler(resolve, reject, value, errMsg, userMsg) {
  // emit an "expected" error (with .defineUserMsg())
  // ... in addition to userMsg, this will supplement any supplied errMsg
  if (userMsg) {
    reject( new Error(errMsg || 'Expected User Defined Condition').defineUserMsg(userMsg) );
  }
  // emit an "unexpected" error
  else if (errMsg) {
    reject( new Error(errMsg) );
  }
  // emit a successful value
  // ... can be an undefined value (for void)
  else {
    resolve(value);
  }
}
