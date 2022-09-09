<script>
 import logger from './core/util/logger';
 const  log = logger('vit:client:App');

 import SmartComp  from './core/domain/SmartComp'; // KJB: TEST core
 const myComp = new SmartComp({msg: 'WowWoo'});    // KJB: TEST core

 // FIRST TEST OF Socket.IO
 import socketIOClient from "socket.io-client";

 // MY FIRST ATTEMPT to connect to socket.io
 log('client now making initial socket connection to our server');
 const serverURL = "http://localhost:5000";
 const socket    = socketIOClient(serverURL); // make our socket connection ... will dynamically update socket obj when connected
 // I assume to determine if connection is made or NOT, you simply monitor 'connect'
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
   log(`client now socket connected to our server: ${socket.id}/${socket.connected}`);
   // AI: maintain state that our socket connetion is UP
 });
 socket.on('disconnect', () => {
   log(`client now socket connection is now lost: ${socket.id}/${socket.connected}`);
   // AI: maintain state that our socket connetion is DOWN
 });
 socket.on('greeting-from-server', (msg) => {
   log('received greeting-from-server: ', {msg});
   const msgToServer = { greeting: 'Hello Server' };
   log('sending msg to server: ', {msgToServer});
   socket.emit('greeting-from-client', msgToServer);
 });
</script>

<main>
  <h2>Hello {myComp.sayIt()}!</h2> <!-- KJB: TEST core -->
</main>

<style>
 main {
   padding: 1em;
   margin:  0 auto;
 }
 h2 {
   color: #ff3e00;
 }
</style>
