//***
//*** sockets.js ... maintain our client communication websockets (socket.io)
//***

import io                                    from "socket.io-client";
import {registerUserSocketHandlers}          from './auth/user';
import {registerChatSocketHandlers}          from './chat/chat';
import {registerSystemStoreSocketHandlers}   from './sys/system';
import {registerSystemSocketHandlers}        from './sys/systemIO';
import {registerLogFilterSocketHandlers}     from './core/util/logger/filterLogsIOClient';
import {isDev}                               from './util/env';
import user                                  from './auth/user';
import alert                                 from './util/alert';

import logger from './core/util/logger';
const  log = logger('vit:client:sockets');

// ********************************************************************************
// setup our socket connection to the server
// RETURN: void
export default function setupSocketConnection(clientType) { // 'ide' or 'sys'

  // define the serverURL used for our socket connection
  //   - for dev  env: we explicitly point to our well-known dev server/port
  //     ... http://localhost:5000
  //   - for prod env: we defer to socket.io default (undefined) 
  //     WHICH is the production host server of our client (e.g. window.location)
  //     ... https://dmrst.herokuapp.com/
  const serverURL = isDev ? "http://localhost:5000" : undefined;

  log.f(`setupSocketConnection() making client socket connection to server: ${serverURL || 'production host of our client'}, using clientType: '${clientType}'`);
  
  // create our socket connection for this app/browser-window
  // ... this socket object is initially a shell, but is dynamically updated when connected
  const socket = io(serverURL, {
    // we communicate static info needed for our socket connection
    // using socket.io's standard auth structure (supplied at client socket creation time).
    // NOTE: For auto-authorization, we bypass this technique, utilizing a
    //       programmatic server2client handshake which accommodates
    //       the dynamics of the deviceId changing.
    auth: {             
      clientType,
      // ... standard technique for auto authorization (however NOT dynamic enough for us)
      // token: 'whatever', // NO: see NOTE above
    }
  });

  // determine when connection is made, by monitoring the 'connect' event
  // ... test with 
  //     1. server NOT running:    NEVER receive 'connect' event 
  //                               WITH reoccurring console error:
  //                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=Nxzv673 net::ERR_CONNECTION_REFUSED
  //     2. server cors rejection: NEVER receive 'connect' event  <<< BASICALLY THE SAME THING
  //                               WITH reoccurring console error:
  //                                    Access to XMLHttpRequest at 'http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB' from origin 'http://localhost:8080' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
  //                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB net::ERR_FAILED 200
  socket.on('connect', () => {
    log(`client's socket connection to server is now established: ${socket.id} / connected: ${socket.connected}`);
    alert.display('Our server connection is now up and running.');
  });

  // when our socket connection has been lost:
  // - either, we have LOST our client network connection
  // - or the server is down
  // NOTE: socket.io will auto-reconnect when the problem is resolved
  //       USING the same client-side socket object instance (with a different socket.id)
  //       AS OPPOSED TO the server-side, which is a brand new socket object instance
  socket.on('disconnect', (reason) => {
    log(`client's socket connection to server has been lost: ${socket.id} / connected: ${socket.connected} ???? reason: ${reason}`);
    alert.display('Our server connection has been lost.');
  });

  // register ALL APP socket event listeners
  registerUserSocketHandlers(socket);
  registerChatSocketHandlers(socket);
  registerSystemStoreSocketHandlers(socket);
  registerSystemSocketHandlers(socket);
  registerLogFilterSocketHandlers(socket);
}
