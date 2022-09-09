//***
//*** users.js ... manager of user sign-in
//***

/**
 * This module (users.js) manages user sign-in authentication,
 * retaining all active users.
 *
 * It also synchronizes active users to their corresponding
 * clientSocket - the application instance through a browser window
 * (see clientSockets.js module).
 *
 * The user/clientSocket association is a 1:M relationship, due to the
 * potential of multiple client browser windows.
 *
 *              user --1:M--< clientSocket
 */

import {getClientSocket, befriendClientSockets} from './clientSockets';
const  {syncClientSocketOnUserSignIn,
        syncClientSocketOnUserSignOut} = befriendClientSockets();

import {prettyPrint} from './util/prettyPrint';

import logger from './core/util/logger';
const  log = logger('vit:server:users');

// all active signed-in users
//   a Map:
//   userId<key>: User<value>
//                - userId
//                - name        ... AI: future example
//                - socketIds[] ... 1:M ClientSockets due to multi-window
const users = new Map();

// promote a human-readable array containing all active users: [{userId, socketIds}, ...]
// NOTE: We have to clone internal structure (see .map()) to facilitate before/after semantics
const allEntries = () => Array.from(users.values()).map(user => ({userId: user.userId, socketIds: [...user.socketIds]}) );

// register our socket.io handlers
export default function registerUserHandlers(socket) {

  log(`registerUserHandlers(for socket: ${socket.id})`);

  // handle sign-in event (a request/response API)
  // ... very rudimentary for our test
  socket.on('sign-in', (userId, pass, ack) => {
  
    log(`Servicing 'sign-in' request/response via socket: ${socket.id}`);

    // convenience util
    function userErr(userMsg) {
      log.v(userMsg)
      ack({errMsg: '*** USER ERROR *** in "sign-in" event',
           userMsg});
    }

    // validate request params
    if (!userId) {
      return userErr('userId must be supplied');
    }
    if (!pass) {
      return userErr('password must be supplied');
    }
    if (pass !== 'a') {
      return userErr('invalid password ... try "a"');
    }

    // N/A: verify NOT already signed-in
    //      BECAUSE user can sign-in on multiple clientSockets!
    // if (getUser(userId)) {
    //   return userErr(`user ${userId} is already signed-in`);
    // }

    // user sign-in successful - update our server state
    const before = log.v.enabled && allEntries();
    const user = getUser(userId);
    if (user) { // ... previously signed in with other browser window (add to it)
      user.socketIds.push(socket.id); // AI: is mutation OK with JS Maps?
    }
    else { // ... first sign-in (add new entry)
      users.set(userId, {userId, socketIds: [socket.id]});
    }
    const after = log.v.enabled && allEntries();
    log.v.enabled && log.v(`user '${userId}' SIGNED-IN through clientSocket: ${socket.id}`, prettyPrint({users: {before, after}}));

    // synchronize our clientSockets to reflect this user sign-in
    syncClientSocketOnUserSignIn(socket.id, userId);
    
    // acknowledge success
    return ack();
  });

  // handle sign-out event (a request/response API)
  // NOTE: We sign-out the user associated to THIS socket
  // ... very rudementary for our test
  socket.on('sign-out', (ack) => {
  
    // NOTE: acknowledgment callback passed following
    //   response: errMsg <string>, where:
    //    - 'any' - NOT signed-out, errMsg to be wrapped in Error (unexpected condition)
    //    - ''    - falsey: sign-out successful
    log(`Servicing 'sign-out' request/response via socket: ${socket.id}`);
  
    // NOTE: user is implied by our socket
    const userId = getClientSocket(socket.id)?.userId;

    // verify this user exists
    // ... TECHNICALLY NO LONGER NEEDED: user should ALWAYS exist
    //     - BECAUSE we keep our client/server user data in-sync
    //     - even with loss of server and it's connections
    // ... KEEP for good defensive measure :-)
    if (!userId) {
      const errMsg = `ERROR: Cannot sign-out user ${userId} (found in ${socket.id} connection), USER IS NOT signed-in.`;
      log.f(errMsg);
      ack(errMsg); // Generate Client Error
      return;
    }

    // sign-out the user
    const before = log.v.enabled && allEntries();
    purgeSocketFromUser(socket.id, userId);
    const after = log.v.enabled && allEntries();
    log.v.enabled && log.v(`User $userId SIGNED-OUT from clientSocket: ${socket.id}`, prettyPrint({users: {before, after}}));

    // synchronize our clientSockets to reflect this user sign-out
    syncClientSocketOnUserSignOut(socket.id);
  
    // acknowledge success
    ack('');
  });
}

// internal utility function to remove socket association from supplied userId
// ... this will implicitly sign-out the user when ALL client connections have been closed
function purgeSocketFromUser(socketId, userId) {

  // get the user object from the supplied userId
  const user = getUser(userId);

  // no-op when user NOT FOUND (we can't purge a non-existent user)
  // ... this used to happen on server restart (where users state is re-set)
  //     TEST AS FOLLOWS:
  //     1. sign-in a user
  //     2. restart server
  //     3. navigate off app (i.e. leave page NOT sign-out)
  //        ... this disconnects the socket, and we previously did NOT keep the client in-sync
  //            SO the client thought it was still signed-in
  // ... TECHNICALLY NO LONGER NEEDED: user should ALWAYS exist
  //     - BECAUSE we keep our client/server user data in-sync
  //     - even with loss of server and it's connections
  // ... KEEP for good defensive measure :-)
  if (!user) {
    log.f(`WARNING: NO-OP purgeSocketFromUser(socketId: ${socketId}, userId: ${userId}) ... user NOT found (suspect server re-start where users state is lost)`);
    return;
  }

  // purge the supplied socketId from our set of sockets
  const socketIds = user.socketIds.filter( (_socketId) => _socketId !== socketId);

  // update our module state
  if (socketIds.length === 0) {
    // remove entire user entry on last client connection
    users.delete(userId);
  }
  else {
    // remove this socket association to the user
    // AI: is mutation OK with JS Maps?
    user.socketIds = socketIds;
  }
}

// return the user for the supplied userId - undefined for NOT-FOUND
export function getUser(userId) {
  return users.get(userId);
}

// expose needed "private" utilities to "friends"
// ... these functions can be promoted through a normal export, but this is more explicit in it's intent
export function befriendUsers() {
  return {

    // a private function that syncs the user's socket reference, 
    // on socket disconnect (via clientSockets.js module)
    syncUserOnSocketDisconnect: (socketId, userId) => {
      const before = log.v.enabled && allEntries();
      purgeSocketFromUser(socketId, userId);
      const after = log.v.enabled && allEntries();
      log.v.enabled && log.v(`syncUserOnSocketDisconnect(socketId: ${socketId}, userId: ${userId})`, prettyPrint({users: {before, after}}));
    },

  };
}
