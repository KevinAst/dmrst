//***
//*** main.js ... main entry point to our web server
//***

import logger from './core/util/logger';
const  log = logger('vit:server:main');

import http                 from 'http';
import express              from 'express';
import {Server as SocketIO} from 'socket.io';

const expressApp = express(); // our express app
const httpServer = http.createServer(expressApp); // our node http server (wrapped with an express app)

// establish our socket.io server
// NOTE: this an integral part of our httpServer
//       - it establishes a 'socket.io' route on the httpServer to handles the initial socket connection
//         ex: http://{myweburl}/socket.io/bla-bla-bla
//       - more
const ioServer = new SocketIO(httpServer, {
  cors: { // handle cors in development
    origin: 'http://localhost:8080', // AI: very temp for now ... need to glean more info on cors
          //? methods: ['GET', 'POST'],
          //? allowedHeaders: ['my-custom-header'],
          //? credentials: true,
  },
});
// listen for socket connections (coming from our client), and register our various socket event listeners
ioServer.on('connection', (socket) => {
  log(`Socket connection initiated from client socket.id: ${socket.id}`);

  // a very simple initial handshake
  const msgToClient = { greeting: 'Hello Client' };
  log('sending msg to client: ', {msgToClient});
  socket.emit('greeting-from-server', msgToClient);

  // AI: register various PROD socket event listeners ... https://socket.io/docs/v4/server-application-structure/
  socket.on('greeting-from-client', (msg) => {
    log('received greeting-from-client: ', {msg});
  });
});

// launch our http server with a simple express app (embelished with socket.io)
const PORT = process.env.PORT || 5000; // use either production port -or- 5000 for dev env
httpServer.listen(PORT, () => {
  log(`HTTP Server is connected to Port ${PORT}`);
});
