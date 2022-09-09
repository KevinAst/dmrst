//***
//*** chat.js ... manager of chat - private messages between two users
//***             NOTE: This server implementation is a stateless pass-through
//***                   ... all chat state is maintained in the client (for each party side :-)
//***


import {getClientSocket} from './clientSockets';

import logger from './core/util/logger';
const  log = logger('vit:server:chat'); 

// socketId waiting for connection to other party
let socketIdInWaiting = null;
let timeout           = null;

function clearInWaiting() {
  log(`connection request - socketId ${socketIdInWaiting} CLEARED from waiting for connection to 2nd party`);
	clearTimeout(timeout);
  socketIdInWaiting = null;
  timeout           = null;
}

// register our socket.io handlers
export default function registerChatHandlers(socket) {

  log(`registerChatHandlers(for socket: ${socket.id})`);

  // handle private-msg solicitation request
  socket.on('private-msg-solicit', () => {

    // connect two users, when we have a connection request waiting
    if (socketIdInWaiting) {

      const socketId1 = socketIdInWaiting;
      const socketId2 = socket.id;
      clearInWaiting();

      const userId1 = getClientSocket(socketId1)?.userId;
      const userId2 = getClientSocket(socketId2)?.userId;

      // connection is technically managed by the client
      // ... communicating other socket.id to EACH client
      log(`connection request - connecting two parties ... socketIds ${socketId1}/${socketId2}`);
      socket.server.to(socketId1).emit('private-msg-connect', socketId2, userId2);
      socket.server.to(socketId2).emit('private-msg-connect', socketId1, userId1);
    }

    // when NO waiting connection request, place this socketId in waiting
    else {
      log(`connection request - socketId ${socket.id} waiting for connection to 2nd party`);

      socketIdInWaiting = socket.id;

      // only wait for 10 seconds to get 2nd party
		  timeout = setTimeout(() => {
        log(`connection request - socketId ${socketIdInWaiting} TIMED OUT from waiting for connection to 2nd party`);
        clearInWaiting();
      }, 10000);
    }
  });

  // handle send private-msg request
  socket.on('private-msg', (toSocketId, fromSocketId, msg) => {
    log(`send msg: '${msg}' toSocketId: ${toSocketId}, fromSocketId: ${fromSocketId}`);
    socket.server.to(toSocketId).emit('private-msg', toSocketId, fromSocketId, msg);
  });

  // handle chat disconnect request
  // ... communicating to the other party that our chat has been disconnected
  socket.on('private-msg-disconnect', (toSocketId, fromSocketId) => {
    log(`inform other party (${toSocketId}) that our chat has been disconnected`);
    socket.server.to(toSocketId).emit('private-msg-disconnect', fromSocketId);
  });
}
