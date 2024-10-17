//***
//*** sockets.js ... manager of our websockets (socket.io)
//***

import {Server as SocketIO}             from 'socket.io';
import {preAuthenticate,
        clearAuthenticate}              from './auth.js';
import registerAuthHandlers             from './auth.js';
import registerLogFilterSocketHandlers  from './core/util/logger/filterLogsIOServer.js';
import registerChatHandlers             from './chat.js';
import registerSystemHandlers           from './systemIO.js';

import logger from './core/util/logger/logger.js';
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
        'http://localhost:8085', // our DEV  IDE SPA ... http://localhost:8085
        'http://localhost:8095', // our PROD IDE SPA ... http://localhost:8095

        'http://localhost:8086', // our DEV  SYS SPA ... http://localhost:8086
        'http://localhost:8096', // our PROD SYS SPA ... http://localhost:8096

        'http://localhost:8080', // both PROD IDE/SYS SPAs ... testing PROD builds (using "npm run app:prodPreview")
                                 //                        ... http://localhost:8080/ide/
                                 //                        ... http://localhost:8080/sys/
        // ditto ABOVE with IP address
        'http://127.0.0.1:8085',
        'http://127.0.0.1:8095',
        'http://127.0.0.1:8086',
        'http://127.0.0.1:8096',
        'http://127.0.0.1:8080',
        // ditto ABOVE with IP address <<< for DEV ACCESS on external devices using my LAN's IP address to my DEV server
        'http://192.168.1.10:8085',
        'http://192.168.1.10:8095',
        'http://192.168.1.10:8086',
        'http://192.168.1.10:8096',
        'http://192.168.1.10:8080',
      ],
  //? methods: ['GET', 'POST'], TODO: review more options
  //? allowedHeaders: ['my-custom-header'],
  //? credentials: true,
    },
  });

  // monitor client socket connections, registering ALL APP event listeners
  io.on('connection', async (socket) => {
    log(`socket connection to client is now established: ${socket.id} / connected: ${socket.connected}`);

    // authenticate client user
    await preAuthenticate(socket);

    // wire up our event handlers for this socket/window
    registerAuthHandlers(socket);
    registerLogFilterSocketHandlers(socket);
    registerChatHandlers(socket);
    registerSystemHandlers(socket);

    // monitor client socket disconnects, cleaning the necessary app structures
    socket.on('disconnect', () => {
      log(`socket connection to client is now lost: ${socket.id} / connected: ${socket.connected} / deviceId: ${socket.data.deviceId}`);

      // clear our app structures tied to this socket
      // NOTE: even though disconnected, this socket still retains the data we setup on it's connection
      //       ... socket.data.deviceId (see log above)
      //       ... THIS IS GREAT, as we clean up our app structures appropriately!
      clearAuthenticate(socket);
      
      // clear our event handlers for this socket/window
      // ?? unclear if this is needed (to prevent memory leaks) -or- if it is done automatically
      // ?? RESEARCH: if we do this, it mat have ramifications to lower-level logic that is monitoring 'disconnect'
      // socket.removeAllListeners();
    });

  });

}
