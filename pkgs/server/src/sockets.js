//***
//*** sockets.js ... manager of our websockets (socket.io)
//***

import {Server as SocketIO}             from 'socket.io';
import registerUserHandlers             from './users';
import registerClientSocketHandlers     from './clientSockets';
import registerLogFilterSocketHandlers  from './core/util/logger/filterLogsIOServer';
import registerChatHandlers             from './chat';
import registerSystemHandlers           from './systemIO';

// configure websocket initiation through our httpServer (socket.io)
export function initializeSockets(httpServer) {

  // establish our socket.io server
  // NOTE: this an integral part of our httpServer
  //       - it establishes a 'socket.io' route on the httpServer to handles the initial socket connection
  //         ex: http://{myweburl}/socket.io/bla-bla-bla
  //       - more
  const ioServer = new SocketIO(httpServer, {
    cors: { // handle cors in development
      origin: ['http://localhost:8080', 'http://127.0.0.1:8887'], // AI: very temp for now SUPPORTING DEVELOPMENT ... need to glean more info on cors
  //? methods: ['GET', 'POST'],
  //? allowedHeaders: ['my-custom-header'],
  //? credentials: true,
    },
  });

  // monitor client socket connections, registering ALL APP event listeners
  ioServer.on('connection', (socket) => {
    registerUserHandlers(socket);
    registerClientSocketHandlers(socket);
    registerLogFilterSocketHandlers(socket);
    registerChatHandlers(socket);
    registerSystemHandlers(socket);
  });

}
