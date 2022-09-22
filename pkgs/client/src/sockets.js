//***
//*** sockets.js ... maintain our client communication websockets (socket.io)
//***

import io                                    from "socket.io-client";
import {registerAuthSocketHandlers}          from './auth';
import {registerChatSocketHandlers}          from './chat';
import {registerSystemStoreSocketHandlers}   from './system';
import {registerSystemSocketHandlers}        from './systemIO';
import {registerLogFilterSocketHandlers}     from './core/util/logger/filterLogsIOClient';
import {isDev}                               from './util/env';
import user                                  from './user';
import alert                                 from './alert';

import logger from './core/util/logger';
const  log = logger('vit:client:sockets');

// make our socket connection for this app/browser-window
// ... serverURL:
//     - for dev  env: we explicitly point to our well-known dev server/port ... http://localhost:5000
//     - for prod env: we defer to socket.io default (undefined) WHICH is the production host server of our client (e.g. window.location) ... https://dmrst.herokuapp.com/
const serverURL = isDev ? "http://localhost:5000" : undefined;
// ... socket:
//     - this socket object is initially a shell, but is dynamically updated when connected
log.f(`our client is now making a socket.io connection to our server: ${serverURL || 'THE PRODUCTION HOST SERVER of our CLIENT'}`);
const socket = io(serverURL);


// NOTE: to determine if connection is made or NOT, simply monitor 'connect'
// ... test with 
//     1. server NOT running:    NEVER receive 'connect' event 
//                               WITH reoccurring console error:
//                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=Nxzv673 net::ERR_CONNECTION_REFUSED
//     2. server cors rejection: NEVER receive 'connect' event  <<< BASICALLY THE SAME THING
//                               WITH reoccurring console error:
//                                    Access to XMLHttpRequest at 'http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB' from origin 'http://localhost:8080' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
//                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB net::ERR_FAILED 200
// ... AI: what about error trapping?
socket.on('connect', () => {
  log(`client's socket connection to server is now up: ${socket.id} / connected: ${socket.connected}`);
  alert.display('Our server connection is now up and running.');
  // AI: maintain state that our socket connection is UP
});
socket.on('disconnect', () => {
  log(`client's socket connection to server has been lost: ${socket.id} / connected: ${socket.connected}`);

  // notify user we have lost our connection to the server
  alert.display('Our server connection has been lost.');

  // our user is now deactivated (with no server)
  // NOTE: we keep our socket in-place because socket.io will auto-reconnect when the server is back up!
  user.deactivateUser(); // ... this is OK to do EVEN if the user is NOT currently signed-in

  // AI: maintain state that our socket connection is DOWN
});

// register ALL APP socket event listeners
registerAuthSocketHandlers(socket);
registerChatSocketHandlers(socket);
registerSystemStoreSocketHandlers(socket);
registerSystemSocketHandlers(socket);
registerLogFilterSocketHandlers(socket);
// AI: more
