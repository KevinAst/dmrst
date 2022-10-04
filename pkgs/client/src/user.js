//***
//*** the current app's user (always available - even when NOT signed in)
//***

import {writable}    from 'svelte/store';
import alert         from './alert';
import {getDeviceId} from './device';
import {socketAckFn} from './core/util/socketIOUtils';
import logger        from './core/util/logger';
const  log = logger('vit:client:user');

// ?? DO THIS:
// NOTE: ALL user state is gleaned from our server
//       - EITHER via a direct sign-in process
//       - OR our auto-authenticate handshake protocol
// NOTE: For auto-authentication, this state is seeded from localStorage (indirectly)
//       - localStorage items:
//         * token:     email#/#pass (encrypted)
//         * guestName: 'Petree'
//       - HOWEVER we DO NOT seed this localStorage state directly here
//         * It is an "indirect process"
//         * PASSING through our server
//           ... through our auto-authenticate handshake protocol
//         * BECAUSE all user state MUST be in-sync with our server

// setup our initial store value
const initialStoreValue = {

  // *******************
  // *** value state ***
  // *******************

  // when authenticated (signed-in) ... ALWAYS populated from verified server (indirectly gleaned from localStorage on auto-authentication)
  email: '', // email (user authentication ID)
  name:  '', // name of user (from server profile)

  enablement: { // various enablements (from server)
    admin: false,
  },

  // ?? NOT NEEDED, because authenticated values ALWAYS reflect verified server interaction
  // authenticated: false, // server reflection of authentication (true: above email/name is verified)

  // for registered guests (that are NOT signed-in) ...
  guestName: '',

  // ***********************************************
  // *** value-added methods of our value object ***
  // ***********************************************

  // is user an authenticated signed-in user
  //   true:  user is signed-in
  //   false: user is a guest (NOT signed-in)
  isSignedIn() {
    return !!this.email;
  },

  // is user a guest?
  //   true:  user is a guest (NOT signed-in)
  //   false: user is signed-in
  isGuest() {
    return !this.isSignedIn();
  },

  // is user registered (either signed-in or registered as a guest)
  isRegistered() {
    return this.isSignedIn() || !!this.guestName;
  },

  // return human interpretable user name
  // ... conveniently reason over various conditions
  // EX: - "Kevin" ... for authenticated signed-in user
  //     - "Petree (Guest)" ... for registered guest
  //     - "Guest" ... for unregistered guest
  // AI: alternate: user/visible/clear/shown/revealed/convey/divulge/disclosed
  getUserName() {
    if (this.isSignedIn()) {   // signed-in user
      return this.name;
    }
    else if (this.guestName) { // registered guest user
      return `${this.guestName} (Guest)`;
    }
    else {                      // un-registered user
      return 'Guest';
    }
  },
};

// internal function that creates our one-and-only user custom store
// ... this same object instance will reflectively change content over time
//     with signIn(), signOut(), etc.
function createUser() {

	const {subscribe, set, update} = writable(initialStoreValue);

  // our user custom store
	return {
		subscribe,

    // sign-in user
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid password)
    signIn: async (email, pass) => {

      log(`signIn user with email: ${email}`);

      // request our server to process request
      // ... allow Error to pass-through to client (ex: invalid password)
      const auth = await signIn(email, pass);

      // NOTE: subsequent steps represent successful sign-in (i.e. NO Error was thrown)
      log(`successful signIn user with email: ${email} ... auth: `, auth);

      // reflexively update our custom store to reflect this successful sign-in
      update(state => ({...state, ...auth}));

      // retain sign-in token (in support of auto-authentication)
      localStorage.setItem('token', `${email}#/#${pass}`); // ?? encrypt this

      // that's all folks
      alert.display(`Welcome ${auth.name} :-)`);
    },

    // sign-out user
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid password)
    signOut: async () => {

      log(`signOut user`);

      // request our server to process request
      // ... allow Error to pass-through to client (ex: invalid password)
      const auth = await signOut();

      // NOTE: subsequent steps represent successful sign-out (i.e. NO Error was thrown)
      log(`successful signOut user ... auth: `, auth);

      // reflexively update our custom store to reflect this successful sign-out
      update(state => ({...state, ...auth}));

      // remove sign-out token (in support of auto-authentication)
      localStorage.removeItem('token');

      // that's all folks
      alert.display(`You have now been signed out - please come back soon :-)`);
    },

    // sync user changes from another app instance with the same device/window (browser instance)
    userAuthChanged: (userAuthChanges) => {
      // reflexively update our custom store to reflect these changes
      update(state => ({...state, ...userAuthChanges}));

      // that's all folks
      alert.display(`Your user identity has been synced from another app instance in a separate browser window.`);
    },

	};
}

// our current active user
// ... a Svelte custom store
// ... a SINGLETON (for this client session)
const user = createUser();
export default user;

// ?? NO NO NO ... this is KRAP-O-LA
// auto sign-in if userId retained in localStorage
// ... keeps server in-sync
// ... very crude for now
// ... timeout is crude way of allowing our socket initialization to stabilize :-(
//? setTimeout(() => {
//?   const userId = localStorage.getItem('vitUserId'); // userId retained in localStorage
//?   if (userId) {
//?     log(`found persistent userId: ${userId} in localStorage ... activating auto sign-in.`);
//?     signIn(userId, 'a'); // hack: this is async, however we know it "should be" successful
//?     user.activateUser(userId);
//?   }
//? }, 1); // very short time (1 ms), supporting next event cycle



//***
//*** our bindings to the server
//***

let socket;  // our active socket (to be used in this module)

export function registerUserSocketHandlers(_socket) {
  log(`registerUserSocketHandlers(socket)`);

  // expose socket to this module
  socket = _socket;

  // service the 'get-device-id' request (from the server)
  // RETURN (via ack): deviceId <string>
  socket.on('get-device-id', (ack) => {
    return ack({value: getDeviceId()});
  });

  // service the 'pre-authentication' event (from the server)
  // ... this happens on app initialization
  // RETURN void ... this is a push event only - no response is possible
  socket.on('pre-authentication', (userAuth) => {
    user.userAuthChanged(userAuth);
  });

  // service the 'user-auth-changed' broadcast notification (from the server)
  // ... this happens when the user credentials change from another app instance
  //     within the same device (browser instance)
  // RETURN void ... this is a broadcast event - no response is possible
  socket.on('user-auth-changed', (userAuthChanges) => {
    user.userAuthChanged(userAuthChanges);
  });
}

// convenience signIn utility wrapping the socket protocol with an async request/response
// RETURN: auth structure (PROMISE):
//           {
//             email: string,
//             name:  string,
//             enablement: {
//               admin: boolean,
//             },
//           }
// THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid password)
function signIn(email, pass) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-in' socket request to our server
    socket.emit('sign-in', email, pass, socketAckFn(resolve, reject));
  });
}

// convenience signOut utility wrapping the socket protocol with an async request/response
// RETURN: auth structure (PROMISE):
//           {
//             email: '',
//             name:  '',
//             enablement: {
//               admin: false,
//             },
//           }
// THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid password)
function signOut() {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-out' socket request to our server
    socket.emit('sign-out', socketAckFn(resolve, reject));
  });
}
