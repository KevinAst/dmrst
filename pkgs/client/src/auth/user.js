//***
//*** the current app's user (always available - even when NOT signed in)
//***

import {writable, get} from 'svelte/store';
import alert           from '../util/alert';
import {getDeviceId,
        resetDeviceId} from './device';
import {socketAckFn}   from '../core/util/socketIOUtils';
import logger          from '../core/util/logger';
const  log = logger('vit:client:user');

// AI: these notes need updating (I think)
// NOTE: ALL user state is gleaned from our server
//       - EITHER via a direct sign-in process
//       - OR our preAuthenticate handshake protocol
// NOTE: For auto-authentication, this state is seeded from localStorage (indirectly)
//       - localStorage items:
//         * deviceId:  string
//         * token:     encrypted string
//       - HOWEVER we DO NOT seed this localStorage state directly here
//         * It is an "indirect process"
//         * PASSING through our server
//           ... through our preAuthenticate handshake protocol
//         * BECAUSE all user state MUST be in-sync with our server AI: discuss dynamics

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

  // for registered guests (that are NOT signed-in) ...
  guestName: '',

  // during sign-in process, waiting for verification to occur
  // ... technically contains the email that is pending verification
  // ... can be used as a boolean too (empty string yields falsy)
  inSignInVerificationPhase: '',

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

    // register a guest user
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
    registerGuest: async (guestName) => {
      log(`registerGuest with guestName: ${guestName}`);

      // request our server to process request
      // ... allow Error to pass-through to client
      //     via RegisterGuest.svelte invoker ... ex: invalid guest name
      const {userState, token} = await registerGuest(guestName);

      // NOTE: subsequent steps represent successful sign-in (i.e. NO Error was thrown)
      log(`successful guest registration with guestName: ${userState.guestName} ... userState: `, userState);

      // reflexively update our custom store to reflect this successful sign-in
      update(state => ({...state, ...userState}));

      // retain sign-in token (in support of auto-authentication)
      localStorage.setItem('token', token);

      // that's all folks
      alert.display(`Welcome ${get(user).getUserName()} :-)`);
    },

    // sign-in user (Phase I - request email verification to be sent)
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
    signIn: async (email) => {
      log(`signIn user with email: ${email}`);

      // request our server to process request
      // ... allow Error to pass-through to client
      //     via SignIn.svelte invoker ... ex: invalid email
      await signIn(email);

      // reflexively update our custom store to reflect that we are inSignInVerificationPhase
      update(state => ({...state, inSignInVerificationPhase: email}));

      // that's all folks
      alert.display(`A sign-in verification code has been sent to your email: ${email}`);
    },

    // sign-in-verification of user (Phase II - verify email verification code)
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
    signInVerification: async (verificationCode) => {
      log(`signInVerification of user's email`);

      // request our server to process request
      // ... allow Error to pass-through to client
      //     via SignIn.svelte invoker ... ex: invalid email
      const {userState, token} = await signInVerification(verificationCode);

      // NOTE: subsequent steps represent successful sign-in (i.e. NO Error was thrown)
      log(`successful signInVerification user with email: ${userState.email} ... userState: `, userState);

      // reflexively update our custom store to reflect this successful sign-in
      update(state => ({...state, ...userState, inSignInVerificationPhase: ''}));

      // retain sign-in token (in support of auto-authentication)
      localStorage.setItem('token', token);

      // that's all folks
      alert.display(`Welcome ${get(user).getUserName()} :-)`);
    },

    // resend code for sign-in-verification of user
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: hmmm)
    signInVerificationResendCode: async () => {
      log(`resend code for signInVerification of user's email`);

      // request our server to process request
      // ... allow Error to pass-through to client
      //     via SignIn.svelte invoker ... ex: hmmm
      await signInVerificationResendCode();

      // NOTE: subsequent steps represent successful code resend (i.e. NO Error was thrown)
      log(`successful resend of signInVerification code`);

      // that's all folks
      alert.display(`A sign-in verification code has been RE-SENT to your email: ${get(user).inSignInVerificationPhase}`);
    },

    // cancel sign-in verification
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: not signed in)
    signInVerificationCancel: () => {
      // reflexively update our custom store to reflect that we are NO LONGER inSignInVerificationPhase
      update(state => ({...state, inSignInVerificationPhase: ''}));

      // NOTE: Currently we do NOT notify the server of this
      //       - we use the KISS principle
      //       - the important thing is the client is reset
      //       - the server will automatically expire this verification in a short time
      //         * likewise, that expiration does NOT sync with the client
      //           ... the client will discover this when they attempt to verify,
      //               and the user can explicitly cancel the operation.
    },

    // sign-out user
    // RETURN: void <promise>
    // THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: not signed in)
    signOut: async () => {
      log(`signOut user`);

      // request our server to process request
      // ... allow Error to pass-through to client
      //     via Router.svelte invoker ... ex: not signed in
      const {userState, token} = await signOut();

      // NOTE: subsequent steps represent successful sign-out (i.e. NO Error was thrown)
      log(`successful signOut user ... userState: `, userState);

      // reflexively update our custom store to reflect this successful sign-out
      update(state => ({...state, ...userState}));

      // retain sign-out token (in support of auto-authentication)
      // ... even though we are signed-out, the token will contain guestName (optional) and deviceId
      localStorage.setItem('token', token);

      // that's all folks
      alert.display(`You have now been signed out - you are now a guest ... ${get(user).getUserName()}.`);
    },

    // sync user changes from another app instance with the same device/window (browser instance)
    userAuthChanged: (userState) => {
      // reflexively update our custom store to reflect these changes
      update(state => ({...state, ...userState}));

      // that's all folks
      alert.display(`Your user identity has been synced from another app instance in a separate browser window.`);
    },

    // sync user changes from 'pre-authentication' event
    preAuthComplete: (userState, userMsg) => {
      // reflexively update our custom store to reflect these changes
      update(state => ({...state, ...userState}));

      // display welcome message
      alert.display(userMsg);
    },

	};
}

// our current active user
// ... a Svelte custom store
// ... a SINGLETON (for this client session)
const user = createUser();
export default user;


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

  // service the 'reset-device-id' request (from the server)
  // RETURN (via ack): deviceId <string>
  socket.on('reset-device-id', (ack) => {
    return ack({value: resetDeviceId()});
  });

  // service the 'get-auth-token' request (from the server)
  // RETURN (via ack): token <string>
  socket.on('get-auth-token', (ack) => {
    return ack({value: localStorage.getItem('token')});
  });

  // service the 'pre-authentication' event (from the server)
  // ... this happens on app initialization
  // RETURN void ... this is a push event only - no response is possible
  socket.on('pre-authentication', (userState, userMsg) => {
    user.preAuthComplete(userState, userMsg);
  });

  // service the 'user-auth-changed' broadcast notification (from the server)
  // ... this happens when the user credentials change from another app instance
  //     within the same device (browser instance)
  // RETURN void ... this is a broadcast event - no response is possible
  socket.on('user-auth-changed', (userState) => {
    user.userAuthChanged(userState);
  });

  // service the 'set-temp-entry' request (from the server)
  // RETURN (via ack): token <string>
  socket.on('set-temp-entry', (key, val, ack) => {
    localStorage.setItem(key, val);
    setTimeout(() => { // clear temporary entry after 20 seconds
      localStorage.removeItem(key);
    }, 20*1000);
    return ack();
  });

  // service the 'get-temp-entry' request (from the server)
  // RETURN (via ack): token <string>
  socket.on('get-temp-entry', (key, ack) => {
    let value = localStorage.getItem(key);

    // if we have a value, we are good-to-go
    if (value) {
      return ack({value});
    }

    // There are rare/sporadic cases where there is some timing issue
    // - PRESUMABLY with localStorage - where it needs a bit of time to stabilize
    // - the server process has been checked and double checked - confirming
    //   it is properly blocking (between 'set-temp-entry' and 'get-temp-entry')
    // - I'm not exactly sure what the problem is (the code seems to be fine)
    // This was typically seen (before this fix/workaround) 
    // - with server restarts (or client restarts - on dev client)
    // - when multiple windows were running the app
    // BEFORE we return a null, which is a big deal (indicating identity theft)
    // we give it a bit of time to settle down:
    // - 20 mils:
    //   * long enough
    //     - to be effective (in my tests)
    //   * short enough to work within the confines of:
    //     - user wait time
    //     - the server timeout for this request (2 secs)
    //     - the clearing of "temp" localStorage entries in 'set-temp-entry' (above - ?? secs)
    setTimeout(() => {
      value = localStorage.getItem(key);
      value && log.f(`'get-temp-entry' FALSE-POSITIVE identity theft AVOIDED ... for key: '${key}', returning: '${value}'`);
      return ack({value});
    }, 20);
  });
}

// convenience registerGuest utility wrapping the socket protocol with an async request/response
// RETURN: void (PROMISE):
// THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid guestName)
function registerGuest(guestName) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'register-guest' socket request to our server
    socket.emit('register-guest', guestName, socketAckFn(resolve, reject));
  });
}

// convenience signIn utility wrapping the socket protocol with an async request/response
// RETURN: void (PROMISE):
// THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
function signIn(email) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-in' socket request to our server
    socket.emit('sign-in', email, socketAckFn(resolve, reject));
  });
}

// convenience signInVerification utility wrapping the socket protocol with an async request/response
// RETURN: auth structure (PROMISE):
//           {
//             email: string,
//             name:  string,
//             enablement: {
//               admin: boolean,
//             },
//           }
// THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid verification code)
function signInVerification(verificationCode) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-in-verification' socket request to our server
    socket.emit('sign-in-verification', verificationCode, socketAckFn(resolve, reject));
  });
}

// convenience signInVerificationResendCode utility wrapping the socket protocol with an async request/response
// RETURN: void (PROMISE):
// THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid verification code)
function signInVerificationResendCode() {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-in-verification-resend-code' socket request to our server
    socket.emit('sign-in-verification-resend-code', socketAckFn(resolve, reject));
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
// THROW:  Error with optional e.userMsg (when e.isExpected()) for expected user error (ex: not signed in)
function signOut() {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'sign-out' socket request to our server
    socket.emit('sign-out', socketAckFn(resolve, reject));
  });
}
