//***
//*** chat.js ... manager of chat - private messages between two users
//***             NOTE: This server implementation is a stateless pass-through
//***                   ... all chat state is maintained in the client (for each party side :-)
//***


// import {getClientSocket} from './clientSockets'; ?? NO NO 
import {getUserName} from './auth';
import {isString}    from './core/util/typeCheck';

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

// the socket.io server in control
let io = null;

// register our socket.io handlers
export default function registerChatHandlers(socket) {

  log(`registerChatHandlers(for socket: ${socket.id})`);

  // retain the socket.io server
  if (!io) { // do the first time only (all subsequent sockets would be duplicate)
    io = socket.server;
  }

  // handle private-msg solicitation request
  socket.on('private-msg-solicit', () => {

    // connect two users, when we have a connection request waiting
    if (socketIdInWaiting) {

      const socketId1 = socketIdInWaiting;
      const socketId2 = socket.id;
      clearInWaiting();

      // ?? NO NO NO NO
      // const userId1 = getClientSocket(socketId1)?.userId;
      // const userId2 = getClientSocket(socketId2)?.userId;
      // ?? YES YES YES
      const userName1 = getUserName(socketId1);
      const userName2 = getUserName(socketId2);


      // connection is technically managed by the client
      // ... communicating other socket.id to EACH client
      log(`connection request - connecting two parties ... socketIds ${socketId1}/${socketId2}`);
      socket.server.to(socketId1).emit('private-msg-connect', socketId2, userName2);
      socket.server.to(socketId2).emit('private-msg-connect', socketId1, userName1);
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


//*-------------------------------------------------
//* send a message to the supplied client
//* ... initiated BY server TO client
//* ... this is an push event only - NO response is supported
//* RETURN: void
//*-------------------------------------------------
export function msgClient(to,          // either the client socket -or- a room
                          msg,         // the message to send
                          errMsg='') { // optional errMsg (to log)
  // emit the 'msg-from-server' event
  // ... either broadcast to a room
  if (isString(to)) {
    io.in(to).emit('msg-from-server', msg, errMsg);
  }
  // ... or to a socket
  else {
    to.emit('msg-from-server', msg, errMsg);
  }
}
