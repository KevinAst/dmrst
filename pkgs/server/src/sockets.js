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
  //         ex: http://{myUrl}/socket.io/bla-bla-bla
  const ioServer = new SocketIO(httpServer, {
    // configure cors for our development servers
    // IN PRODUCTION:  our client socket requests are coming from the same domain
    //                 ... the localhost urls (found below) are NOT used
    //                     they are irrelevant: because the localhost is that of the host server
    // IN DEVELOPMENT: our client and server are on different domains (localhost ports are different)
    //                 ... the localhost ports below are what is being used by our client SPA
    //                 ... this is the reason we need this cors configuration!
    cors: {
      origin: [
        'http://localhost:8085', // our IDE SPA ... http://localhost:8085/ide/
        'http://localhost:8086'  // our SYS SPA ... http://localhost:8086/sys/
      ],
  //? methods: ['GET', 'POST'], TODO: review more options
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
