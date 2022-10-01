//***
//*** clientSockets.js ... manager of all active client socket connections
//***

// ?? NOW mostly obsolete ... no longer register this

/**
 *  A "client" is a visualize-it web application instance in a given
 *  browser window.
 * 
 *  Each client has it's own socket connection, initially WITHOUT any
 *  user association, UNTIL the client decides to sign-in (which is
 *  completely optional).
 *
 *  A user sign-in is initiated through a specific client.  When complete,
 *  that user is associated to the clientSocket (e.g. browser window).
 *
 *  This module (clientSockets.js) retains all client socket
 *  connections (one for each client).  The user.js module in turn
 *  manages user sessions and interacts with clientSockets.js to
 *  maintain the bi-directional association between sockets and users.
 */

import {befriendUsers} from './users.js';
const {syncUserOnSocketDisconnect} = befriendUsers();

import {prettyPrint} from './util/prettyPrint';

import logger from './core/util/logger';
const  log = logger('vit:server:clientSockets');

// all client socket connections, one for each app instance (e.g. browser window)
//   a Map:
//   socketId<key>: ClientSocket<value>
//                  - socket   <socket.io>
//                  - userId   <string> ... null when user is NOT signed-in to the given browser window
const clientSockets = new Map();

// promote a human-readable array containing all active clientSockets: [{socketId, userId}, ...]
// ?? logger optimize (may want to retain it when clientSockets change) ... review ALL usage
const allEntries = () => Array.from(clientSockets.values()).map(cs => ({socketId: cs.socket.id, userId: cs.userId || 'not-signed-in'}) );

// register our socket.io handlers
export default function registerClientSocketHandlers(socket) {

  log(`registerClientSocketHandlers(for socket: ${socket.id})`);

  // maintain our rudimentary clientSockets map
  // ... this is maintained here because we are invoked as part of the io 'connection' event
  const before = log.v.enabled && allEntries();
  clientSockets.set(socket.id, {socket, userId: null});
  const after = log.v.enabled && allEntries();
  log.v.enabled && log.v(`clientSocket connection established for id: ${socket.id}`, prettyPrint({clientSockets: {before, after}}));

  // handle socket disconnect event
  socket.on('disconnect', () => {
    const before = log.v.enabled && allEntries();
    const userId = getClientSocket(socket.id)?.userId; // userId implied by socket (will be null if NOT signed-in)
    clientSockets.delete(socket.id);
    const after = log.v.enabled && allEntries();
    log.v.enabled && log.v(`clientSocket connection DISCONNECTED for id: ${socket.id} (userId: ${userId})`, prettyPrint({clientSockets: {before, after}}));

    // synchronize the user's socket reference (when user is signed-in)
    if (userId) {
      syncUserOnSocketDisconnect(socket.id, userId);
    }
  });
}

// return the clientSocket for the supplied socketId - undefined for NOT-FOUND
export function getClientSocket(socketId) {
  return clientSockets.get(socketId);
}

// expose needed "private" utilities to "friends"
// ... these functions can be promoted through a normal export, but this is more explicit in it's intent
export function befriendClientSockets() {
  return {

    // a private function that syncs clientSocket user reference, on user sign-in (via users.js module)
    syncClientSocketOnUserSignIn: (socketId, userId) => {
      const clientSocket = getClientSocket(socketId);
      const before = log.v.enabled && allEntries();
      clientSocket.userId = userId; // maintain authorized user in this client connection
      clientSocket.socket.data.userId = userId; // EXPERIMENTAL: try syncing userId DIRECTLY in the socket
      const after = log.v.enabled && allEntries();
      log.v.enabled && log.v(`syncClientSocketOnUserSignIn(socketId: ${socketId}, userId: ${userId})`, prettyPrint({clientSockets: {before, after}}));
    },

    // a private function that syncs clientSocket user reference, on user sign-out (via users.js module)
    syncClientSocketOnUserSignOut: (socketId) => {
      const clientSocket = getClientSocket(socketId);
      const before = log.v.enabled && allEntries();
      clientSocket.userId = null; // this client connection no longer authorized by prior user
      clientSocket.socket.data.userId = null; // EXPERIMENTAL: try syncing userId DIRECTLY in the socket
      const after = log.v.enabled && allEntries();
      log.v.enabled && log.v(`syncClientSocketOnUserSignOut(socketId: socketId)`, prettyPrint({clientSockets: {before, after}}));
    },

  };
}
