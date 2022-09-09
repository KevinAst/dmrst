//***
//*** systemIO.js ... WebSocket bindings of visualize-it system (client-side)
//***

import {socketAckFn} from './core/util/socketIOUtils';

import logger from './core/util/logger';
const  log = logger('vit:client:systemIO'); 

let socket;  // our active socket (to be used in this module)

export function registerSystemSocketHandlers(_socket) {
  log('here we are in registerSystemSocketHandlers');

  // expose socket to this module
  socket = _socket;

  //***
  //*** register our system-based client-side event listeners
  //***

  // NOTE: currently all system-based client-side event listeners are
  //       registered directly in the system store (see system.js)

}

// launch/create a system, allowing participants to join (a request/response API)
// ... invoked by host
// ... this is a convenience function wrapping the socket protocol with an async request/response
// RETURN: void ... successful creation of new system
// ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
export function launchSystem(sysId,      // system identifier -and- alias to room (must be unique on server or will error)
                             accessCode, // access key to be able to join system (a lite password)
                             model) {    // our data model (JSON key/value)
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'launch-system' socket request to our server
    socket.emit('launch-system', sysId, accessCode, model, socketAckFn(resolve, reject));
  });
}

// join a system, by participants other than host (a request/response API)
// ... invoked by non-host
// ... this is a convenience function wrapping the socket protocol with an async request/response
// RETURN: model ... the data model (JSON key/value) of successfully joined system
// ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
export function joinSystem(sysId,        // system identifier -and- alias to room (must be unique on server or will error)
                           accessCode) { // access key to be able to join system (a lite password)
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'join-system' socket request to our server
    socket.emit('join-system', sysId, accessCode, socketAckFn(resolve, reject));
  });
}

// start a system running
// ... invoked by either host or non-host
// ... this is a convenience function wrapping the socket protocol with an async request/response
// RETURN: void
// ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
export function runSystem(sysId) { // system identifier
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'run-system' socket request to our server
    socket.emit('run-system', sysId, socketAckFn(resolve, reject));
  });
}

// pause a running system
// ... invoked by either host or non-host
// ... this is a convenience function wrapping the socket protocol with an async request/response
// RETURN: void
// ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
export function pauseSystem(sysId) { // system identifier
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'pause-system' socket request to our server
    socket.emit('pause-system', sysId, socketAckFn(resolve, reject));
  });
}
