//***
//*** filterLogsIOServer.js ..... WebSocket binding supporting filtering of logs (server-side)
//***

import logger from './logger';
const  log = logger('vit:core:logger:filterLogsIOServer');

// register our socket.io handlers
export default function registerLogFilterSocketHandlers(socket) {

  log(`registerLogFilterSocketHandlers(for socket: ${socket.id})`);

  // handle setting server log filters
  socket.on('set-server-log-filters', (filter) => {
    log(`before enabling this filter, our vit:core:logger:filterLogsIOServer log enabled status is: log: ${log.enabled} ... debug: ${logger.isLogFilterEnabled('vit:core:logger:filterLogsIOServer')}`);
    logger.setLogFilters(filter);
    log.f(`server logging filter now set to: '${filter}'`);
    log(`after enabling this filter, our vit:core:logger:filterLogsIOServer log enabled status is: log: ${log.enabled} ... debug: ${logger.isLogFilterEnabled('vit:core:logger:filterLogsIOServer')}`);
  });

  // handle getting server log filters (request/response)
  socket.on('get-server-log-filters', (ack) => {

    // acknowledgment passes back our server log filter
    ack(logger.currentLogFilters());
  });

  // handle setting other client log filters
  socket.on('set-other-log-filters', (otherSocketId, filter) => {
    // pass-through to "other" client that will service the request
    // ... see NOTEs in 'get-other-log-filters' (below)
    const otherSocket = socket.server.sockets.sockets?.get(otherSocketId);
    if (otherSocket) {
      // NOTE: otherSocketId IS NEEDED (from client-server) but NOT NEEDED (in server-client)
      //       but maintained for consistancy (since we use the same event name)
      log(`Processing 'set-other-log-filters' event for otherSocketId: ${otherSocketId}, filter: ${filter}`);
      otherSocket.emit('set-other-log-filters', otherSocketId, filter);
    }
    else {
      log.f(`PROBLEM Processing 'set-other-log-filters' event for otherSocketId: ${otherSocketId}, filter: ${filter} ... otherSocketId NOT FOUND`);
    }
  });

  // handle getting other client log filters (request/response)
  socket.on('get-other-log-filters', (otherSocketId, ack) => {
    // pass-through to "other" client that will service the request
    // NOTE: We CANNOT issue: socket.to(otherSocketId).emit(...)
    //       BECAUSE we require a request/response callback acknowledgment
    //       AND socket.io does NOT support callbacks when broadcasting
    //       RATHER we fetch the other client's socket and emit to it
    //       ALLOWING our request/response callback acknowledgment
    // NOTE: 1st sockets: alias to the main namespace(/)
    //       2nd sockets: map of socket instances ... Map<SocketId, Socket>
    const otherSocket = socket.server.sockets.sockets?.get(otherSocketId);
    if (!otherSocket) {
      // CRUDE ERROR pass-back (return string begins with ERROR)
      ack(`ERROR: Server Out-Of-Sync - refresh browser or re-login (otherSocketId '${otherSocketId}' does NOT exist)`);
    }
    else {
      otherSocket.emit('get-other-log-filters', (otherLogFilters) => {
        // acknowledgment passes back our other client log filter
        ack(otherLogFilters);
      });
    }
  });

}
