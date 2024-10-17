//***
//*** main.js ... main entry point to our web server
//***

import './core/util/ErrorExtensionPolyfill.js'; // value-added Error extensions, providing ability to handle ALL errors more generically
import './util/dotenvConfig.js';                // configure dotenv EARLY in our startup process

import http                from 'http';
import express             from 'express';
import {initializeSockets} from './sockets.js'

import logger from './core/util/logger/logger.js';
const  log = logger('vit:server:main');

// define our express app
const expressApp = express();

// configure our static resources to be served
// ... found in our public directory
// ... also stages our SPA built scripts (public/ide, public/sys)
expressApp.use(express.static('public')); // AI: investigate 2nd param: options

// define our node http server (wrapped with our express app)
const httpServer = http.createServer(expressApp);

// configure websocket initiation through our httpServer (socket.io)
initializeSockets(httpServer);

// launch our http server via a simple express app (embellished with socket.io - above)
// ... use either production port -or- 5000 for dev env
//     NOTE: heroku deployment auto sets this PORT env variable
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  log.f(`Express HTTP Server listening on Port ${PORT}`);
});
