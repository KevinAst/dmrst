//***
//*** auth.js ... various authorization utilities
//***

import {socketAckFn} from './core/util/socketIOUtils';

import logger from './core/util/logger';
const  log = logger('vit:client:auth'); 

let socket;  // our active socket (to be used in this module)

export function registerAuthSocketHandlers(_socket) {
  log('here we are in registerAuthSocketHandlers');

  // expose socket to this module
  socket = _socket;

  // AI: may also have some listeners to register too
}

// convenience signIn utility wrapping the socket protocol with an async request/response
// RETURN: promise string (user error msg, falsy for successfully signed-in)
export function signIn(userId, pass) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-in' socket request to our server
    socket.emit('sign-in', userId, pass, socketAckFn(resolve, reject));
  });
}

// convenience signOut utility wrapping the socket protocol with an async request/response
// RETURN: promise void
export function signOut() {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-out' socket request to our server
    socket.emit('sign-out', (errMsg) => {
      // within our acknowledgment callback
      //   response: errMsg <string>, where:
      //    - 'any' - NOT signed-out, errMsg to be wrapped in Error (unexpected condition)
      //    - ''    - falsey: sign-out successful
      if (errMsg) {
        reject(new Error(errMsg)); // an unexpected error
      }
      else {
        resolve(undefined); // successful sign-out ... void (i.e. undefined)
      }
    });
  });
}
