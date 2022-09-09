//***
//*** sockets.js ... maintain our client communication websockets (socket.io)
//***

import socketIOClient                        from "socket.io-client";
import {registerAuthSocketHandlers}          from './auth';
import {registerChatSocketHandlers}          from './chat';
import {registerSystemStoreSocketHandlers}   from './system';
import {registerSystemSocketHandlers}        from './systemIO';
import {registerLogFilterSocketHandlers}     from './core/util/logger/filterLogsIOClient';
import user                                  from './user';
import alert                                 from './alert';

import logger from './core/util/logger';
const  log = logger('vit:client:sockets');

// make our socket connection for this app/browser-window
// ... dynamically updates this socket obj when connected
log('client making socket connection to server');
const serverURL = "http://localhost:5000";
const socket    = socketIOClient(serverURL);

// NOTE: to determine if connection is made or NOT, simply monitor 'connect'
// ... test with 
//     1. server NOT running:    NEVER receive 'connect' event 
//                               WITH reoccuring console error:
//                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=Nxzv673 net::ERR_CONNECTION_REFUSED
//     2. server cors rejection: NEVER receive 'connect' event  <<< BASICALLY THE SAME THING
//                               WITH reoccuring console error:
//                                    Access to XMLHttpRequest at 'http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB' from origin 'http://localhost:8080' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
//                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB net::ERR_FAILED 200
// ... AI: what about error trapping?
socket.on('connect', () => {
  log(`client's socket connection to server is now up: ${socket.id} / connected: ${socket.connected}`);
  alert.display('Our server connection is now up and running.');
  // AI: maintain state that our socket connetion is UP
});
socket.on('disconnect', () => {
  log(`client's socket connection to server has been lost: ${socket.id} / connected: ${socket.connected}`);

  // notify user we have lost our connection to the server
  alert.display('Our server connection has been lost.');

  // our user is now deactivated (with no server)
  // NOTE: we keep our socket in-place because socket.io will auto-reconnect when the server is back up!
  user.deactivateUser(); // ... this is OK to do EVEN if the user is NOT currently signed-in

  // AI: maintain state that our socket connetion is DOWN
});

// register ALL APP socket event listeners
registerAuthSocketHandlers(socket);
registerChatSocketHandlers(socket);
registerSystemStoreSocketHandlers(socket);
registerSystemSocketHandlers(socket);
registerLogFilterSocketHandlers(socket);
// AI: more
