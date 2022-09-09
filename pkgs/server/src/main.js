//***
//*** main.js ... main entry point to our web server
//***

import './core/util/ErrorExtensionPolyfill'; // value-added Error extensions, providing ability to handle ALL errors more generically

import logger from './core/util/logger';
const  log = logger('vit:server:main');

import http                from 'http';
import express             from 'express';
import {initializeSockets} from './sockets.js'

const expressApp = express(); // our express app
const httpServer = http.createServer(expressApp); // our node http server (wrapped with an express app)

// configure websocket initiation through our httpServer (socket.io)
initializeSockets(httpServer);

// launch our http server via a simple express app (embellished with socket.io)
const PORT = process.env.PORT || 5000; // use either production port -or- 5000 for dev env
httpServer.listen(PORT, () => {
  log.f(`Express HTTP Server listening on Port ${PORT}`);
});
