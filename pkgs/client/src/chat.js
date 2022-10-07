//***
//*** a chat store, containing private-msgs to another user
//*** ... current support: multi-session with two parties per session
//***

import {writable, get} from 'svelte/store';
import alert      from './alert';
import beep       from './util/beep';
import logger     from './core/util/logger';
const  log = logger('vit:client:chat');

// the store "session" structure (one for each session)
// SESSION:
// {
//   otherSocketId: 'aSocketId', // the other-user socketId
//   otherUserId:   'aUserId',   // the other-user userId
//   msgs: [                     // all the messages in this session
//     {       // one of many messages
//       when: date,
//       who:  boolean, // true: other-user, false: me
//       msg:  'hello world',
//     },
//     ...
//   ],
// }

// our initial store value (defining our value methods)
const initialChat = {
  session: { // SESSION map
    // otherSocketId1: SESSION, // ... one of many sessions BETWEEN self and this "other" user
    // otherSocketId2: SESSION, // ... ditto
    // ...
  },

  //***
  //*** adorned properties (based on SESSION map - above)
  //***

  sessions: [],    // SESSION[] ... array rendition of SESSION map (sorted by otherUserId)
  isActive: false, // are their active sessions
};

// internal function that maintains the adorned properties
// RETURN: new chat value object
function adorn(sessionMap) {
  const sessions = Object.values(sessionMap) // extract session array
                         .sort((a,b) => a.otherUserId.localeCompare(b.otherUserId)); // sorted by otherUserId
  const isActive = sessions.length > 0;
  return {
    session: sessionMap,
    sessions,
    isActive,
  };
}

function createChat() {
	const {subscribe, update} = writable(initialChat);

	return {
		subscribe,

    // solicit a private message (initiation)
    solicitPrivateMsg: () => { // ... invoked by: client Easter Egg (see: Router.svelte)
      log(`solicit a private message to server ... emitting socket private-msg-solicit`);
      socket.emit('private-msg-solicit');
      alert.display(`Requesting chat :-)`);
    },

    // connect our chat with another user
    connect: (otherSocketId, userId, msg) => { // ... invoked by 'private-msg-connect' event (below)
      // default params appropriatly
      userId = userId || 'Guest';
      msg    = msg    || `Hello from ${userId}`;

      // connect our chat
      log(`connecting chat with: ${userId}, msg: "${msg}"`);
      update(state => adorn({...state.session,
                             [otherSocketId]: {
                               ...state.session[otherSocketId], // for good measure (not really needed since we are injecting all properties)
                               otherSocketId,
                               otherUserId:   userId,
                               // preserve session content when already active
                               // ... WITH protection (via empty array) when NOT already active
                               msgs: [...(state.session[otherSocketId]?.msgs || []), {when: new Date(), who: true, /* other-user */ msg}],
                             }} ));
      alert.display(`Chat now available with ${userId} (see Chat tab)`);
    },

    // send a message to the other party of the given session
    sendMsg: (msg, otherSocketId) => {

      // obtain the designated session that we will be communicating with
      const session = get(chat).session[otherSocketId];

      // send the message
      log(`sending msg: "${msg}" TO: ${session.otherUserId}`);
      //                         TO:                    FROM:
      socket.emit('private-msg', session.otherSocketId, socket.id,  msg);

      // update this local message in our state
      update(state => adorn({...state.session,
                             [otherSocketId]: {
                               ...state.session[otherSocketId],
                               msgs: [...(state.session[otherSocketId]?.msgs || []), {when: new Date(), who: false, /* me */ msg}],
                             }} ));
    },

    // receive a message
    receiveMsg: (msg, otherSocketId) => {

      // obtain the designated session that is communicating with us
      const session = get(chat).session[otherSocketId];

      log(`receiving msg: "${msg}" FROM: ${session.otherUserId}`);

      // update this message in our state
      update(state => adorn({...state.session,
                             [otherSocketId]: {
                               ...state.session[otherSocketId],
                               msgs: [...(state.session[otherSocketId]?.msgs || []), {when: new Date(), who: true, /* other-user */ msg}],
                             }} ));

      // notify user new chat message has arrived
      beep();
    },

    // disconnect chat
    // ... this initiates the disconnect
    disconnect: (otherSocketId) => { // ... invoked by: client chat screen

      // obtain the designated session to disconnect
      const session = get(chat).session[otherSocketId];

      log(`disconnect our chat session with ${session.otherUserId}`);

      // update our state to reflect a disconnect
      // ... remove the session completely
      update(state => {
        const {[otherSocketId]: removedSession, ...rest} = state.session;
        return adorn(rest);
      });

      // communicate to the other side that we are disconnected
      //                                    SEND-TO        THEIR-OTHER
      socket.emit('private-msg-disconnect', otherSocketId, socket.id);
    },

    // our chat has been disconnected
    // ... from the other party
    disconnected: (otherSocketId) => {
      log(`our chat session has been disconnected (from the other party)`);

      // obtain the designated session to disconnect
      const session = get(chat).session[otherSocketId];

      if (session) { // can be undefined WHEN chat to self
        log(`chat session with ${session.otherUserId} has been disconnected (by them)`);

        // update our state to reflect a disconnect
        // ... remove the session completely
        update(state => {
          const {[otherSocketId]: removedSession, ...rest} = state.session;
          return adorn(rest);
        });
      }
    },
	};
}

// our current active chat
// ... a Svelte store
const chat = createChat();
export default chat;






// our active socket (to be used in this module)
let socket;

export function registerChatSocketHandlers(_socket) {
  log('here we are in registerChatSocketHandlers');

  // expose socket to this module
  socket = _socket;

  // handle private-msg connection request
  socket.on('private-msg-connect', (otherSocketId, userId) => {
    chat.connect(otherSocketId, userId);
  });

  // receive private-msg
  // ... receiving BECAUSE we are on the client side
  socket.on('private-msg', (toSocketId, fromSocketId, msg) => {
    chat.receiveMsg(msg, fromSocketId);
  });

  // handle disconnect request from other side
  socket.on('private-msg-disconnect', (otherSocketId) => {
    chat.disconnected(otherSocketId);
  });

  // handle generic message from server-2-client
  // ... this is a generic utility ... not really chat related
  socket.on('msg-from-server', (msg, errMsg) => {
    if (errMsg) {
      log.f(errMsg);
    }
    alert.display(msg);
  });
}
