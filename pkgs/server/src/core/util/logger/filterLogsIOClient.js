//***
//*** filterLogsIOClient.js ..... WebSocket binding supporting filtering of logs (client-side)
//***

import logger from './logger';
const  log = logger('vit:core:logger:filterLogsIOClient');

let socket;  // our active socket (to be used in this module)

export function registerLogFilterSocketHandlers(_socket) {
  log('here we are in registerLogFilterSocketHandlers');

  // expose socket to this module
  socket = _socket;

  // handle getting other client log filters (request/response)
  // NOTE: The server does a pass-through to other client (i.e. this process).
  //       BECAUSE we are "listening" to this event (not emitting it), we are the "other" client.
  socket.on('get-other-log-filters', (ack) => {
    ack(logger.currentLogFilters());
  });

  // handle setting other client log filters
  // NOTE: The server does a pass-through to other client (i.e. this process).
  //       BECAUSE we are "listening" to this event (not emitting it), we are the "other" client.
  // NOTE: otherSocketId IS NEEDED (from client-server) but NOT NEEDED (in server-client - THIS PROCESS)
  //       but maintained for consistancy (since we use the same event name)
  socket.on('set-other-log-filters', (otherSocketId, filter) => {
    logger.setLogFilters(filter);
    log.f(`our logging filter has been REMOTELY set set to: '${filter}'`);
  });
}

// convenience setServerLogFilters(filter) wrapping the socket protocol
// RETURN: void
export function setServerLogFilters(filter) {
  socket.emit('set-server-log-filters', filter);
}

// convenience getServerLogFilters() utility wrapping the socket protocol with an async request/response
// RETURN: promise string
export function getServerLogFilters() {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'get-server-log-filters' socket request to our server
    socket.emit('get-server-log-filters', (serverLogFilters) => {
      // within our acknowledgment callback
      resolve(serverLogFilters);
    });
  });
}

// convenience setOtherLogFilters(otherSocketId, filter) wrapping the socket protocol
// RETURN: void
export function setOtherLogFilters(otherSocketId, filter) {
  socket.emit('set-other-log-filters', otherSocketId, filter);
}

// convenience getOtherLogFilters(otherSocketId) utility wrapping the socket protocol with an async request/response
// RETURN: promise string
export function getOtherLogFilters(otherSocketId) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'get-other-log-filters' socket request to the other client
    socket.emit('get-other-log-filters', otherSocketId, (otherLogFilters) => {
      if (otherLogFilters.startsWith('ERROR')) {
        reject(otherLogFilters);
      }
      else {
        resolve(otherLogFilters);
      }
    });
  });
}
