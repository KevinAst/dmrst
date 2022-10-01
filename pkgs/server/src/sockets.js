//***
//*** sockets.js ... manager of our websockets (socket.io)
//***

import {Server as SocketIO}             from 'socket.io';
import {preAuthenticate}                from './auth';
import registerAuthHandlers             from './auth'; // ?? new
//import registerUserHandlers             from './users'; ?? obsolete
//import registerClientSocketHandlers     from './clientSockets'; ?? obsolete
import registerLogFilterSocketHandlers  from './core/util/logger/filterLogsIOServer';
import registerChatHandlers             from './chat';
import registerSystemHandlers           from './systemIO';

import logger from './core/util/logger';
const  log = logger('vit:server:sockets');

// configure websocket initiation through our httpServer (socket.io)
export function initializeSockets(httpServer) {

  // establish our socket.io server
  // NOTE: this an integral part of our httpServer
  //       - it establishes a 'socket.io' route on the httpServer to handles the initial socket connection
  //         ex: http://{myUrl}/socket.io/bla-bla-bla
  const io = new SocketIO(httpServer, {
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
        'http://localhost:8086', // our SYS SPA ... http://localhost:8086/sys/
        'http://localhost:8080'  // both IDE/SYS SPA when using "npm start" manually (to test PROD builds)
                                 //                  ... http://localhost:8080/ide/
                                 //                  ... http://localhost:8080/sys/
      ],
  //? methods: ['GET', 'POST'], TODO: review more options
  //? allowedHeaders: ['my-custom-header'],
  //? credentials: true,
    },
  });

  // monitor client socket connections, registering ALL APP event listeners
  io.on('connection', async (socket) => {
    log(`server socket connection to client is now established: ${socket.id} / connected: ${socket.connected}`);

    // authenticate client user
    // ... once complete, the following is established: ?? verify this (and more)
    //     - socket.data.deviceId
    //       ... from Device, we have access to user
    //           getDevice(socket || socketId): Device
    //           getUser(socket || socketId):   User (i.e. device.user)
    await preAuthenticate(socket); // ??$$ NEW

    // wire up our event handlers for this socket/window
    registerAuthHandlers(socket);
//  registerUserHandlers(socket); ?? obsolete
//  registerClientSocketHandlers(socket);?? obsolete
    registerLogFilterSocketHandlers(socket);
    registerChatHandlers(socket);
    registerSystemHandlers(socket);

    // on socket disconnects - clean up our event handlers for this socket/window
    // ?? unclear if this is needed (to prevent memory leaks) -or- if it is done automatically
    // ?? RESEARCH: if we do this, it mat have ramifications to lower-level logic that is monitoring 'disconnect'
//? socket.on('disconnect', () => {
//?   socket.removeAllListeners();
//? }
  });



}
