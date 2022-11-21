//***
//*** auth.js ... authentication module (and maintainer of user objects)
//***

/**
 * This module (auth.js) manages user authentication,
 * creating and retaining all active users.
 *
 * This module manages:
 *   - User objects
 *
 *   - Device objects
 *      * the Device holds a User object
 *        ... all sockets (browser windows) of a device have the same user and that authority
 *        ... and the sign-in/sign-out is synced across these sockets (browser windows)
 *      * Device data items:
 *        - deviceId:       the browser's logical device identifier (a virtual MAC so-to-speak) ... key to access the Device obj
 *        - user:           the user object associated to this device
 *        > following convenience (consolidation here is possible because we guarantee all sockets of a devices is from the SAME browser instance)
 *        - clientAccessIP: the internet access point for this client (think of as router/WiFi IP)
 *        ~ userAgent:      identifies the specific browser in use <<< NOT INCLUDED (too cryptic)
 *        - os:             the OS-version (via userAgent)
 *        - browser:        the browser-version (via userAgent)
 *
 *   - bi-directional relationship between Device(User)/Socket(window)
 *
 *      Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
 *
 *      * the relationship FROM Device TO Socket is maintained by a "room" (part of socket.io)
 *        - this means the dynamics of socket disconnects, is automatically maintained by socket.io
 *        - the sockets in the group represent the browser window of a given user
 *          * visualize-it automatically syncs user identity changes to all these windows
 *          * this grouping has a similar scope to that of the browser localStorage
 *
 *   - socket.data: ... contains a number of useful items
 *     * deviceId:       the browser's logical device identifier (a virtual MAC so-to-speak) ... key to access the Device obj
 *     * clientType:     'ide'/'sys'
 *     * clientAccessIP: the internet access point for this client (think of as router/WiFi IP)
 *     * userAgent:      identifies the specific browser in use
 *
 * Of Interest is our PUBLIC API:
 *   + getDevice(deviceId|device|socket|socketId):   Device
 *   + getUser(deviceId|device|socket|socketId):     User (same as: device.user)
 *   + getUserName(deviceId|device|socket|socketId): string
 */

import sendGridMail          from '@sendgrid/mail';
import {socketAckFn_timeout} from './core/util/socketIOUtils';
import {isDev}               from './util/env';
import {prettyPrint}         from './util/prettyPrint';
import {msgClient}           from './chat';
import crypto                from 'crypto'; //... the node.js built-in crypto library
import {encrypt, decrypt}    from './util/encryption';
import storage               from 'node-persist'; // AI: temp lib used to persist PriorAuthDB TILL we hook into DB
import UAParser              from 'ua-parser-js';
import logger from './core/util/logger';
const  logPrefix = 'vit:server:auth';
const  log = logger(`${logPrefix}`);

// initialize our persistent library
await storage.init({
  dir: 'PriorAuthDB', // relative path to persist
});

// the socket.io server in control
let io = null;

// register our SendGrid API key to the service object
sendGridMail.setApiKey(process.env.EMAIL_API_KEY);


//*-----------------------------------------------------------------------------
//* register our socket.io handlers
//*-----------------------------------------------------------------------------
export default function registerAuthHandlers(socket) {

  log(`registerAuthHandlers(for socket: ${socket.id})`);

  // retain our socket.io server
  if (!io) { // ... do the first time only (all subsequent sockets would be duplicate
    io = socket.server;
  }

  //*---------------------------------------------------------------------------
  //* handle client register-guest request (a request/response API)
  //* RETURN: (via ack):
  //*           {
  //*             userState, // to update client user object
  //*             token,     // to be retained on client (for preAuthenticate)
  //*           }
  //* THROW:  Error (via ack) with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid guestName)
  //*---------------------------------------------------------------------------
  socket.on('register-guest', async (guestName, ack) => {
    const log = logger(`${logPrefix}:register-guest`);
    log(`Servicing 'register-guest' request/response on socket: ${socket.id}`);

    // convenience util
    function userErr(userMsg) {
      log.v(userMsg)
      ack({errMsg: '*** USER ERROR *** in "register-guest" event',
           userMsg});
    }

    // currently we allow blank entry to clear any prior guest name
    // if (!guestName) {
    //   return userErr('Guest Name must be supplied');
    // }

    // KEY: user register-guest successful - NOW update our server state

    // obtain the user associated to this socket -AND- update it's key aspects
    // ... NOTE: our basic socket/device/user structure is pre-established via preAuthenticate()
    // ... NOTE: we mutate this object :-)
    const user     = getUser(socket);
    user.guestName = guestName;
    populateUserProfile(user); // ... re-populate all other user state (via user profile / enablements)

    // broadcast the latest userState to all clients of this device
    // ... this will change the user/authentication for ALL apps running on this device (all app windows of this browser instance)
    const userState = extractUserState(user);
    broadcastUserAuthChanged(socket/*deviceRef*/, userState, socket/*exclude from broadcast*/);

    // generate the token to be sent to our client
    const token = encodeUserToken(user);

    // acknowledge 'register-guest' success
    // ... for the initiating client, this is how it is updated
    //     >>> it knows to update localStorage too
    // ... for other clients of this device, they are updated via the broadcast event (above)
    return ack({value: {
      userState,
      token,
    }});

  });

  //*---------------------------------------------------------------------------
  //* handle client sign-in request (a request/response API)
  //* RETURN: (via ack): void (i.e. a verification code has been emailed)
  //* THROW:  Error (via ack) with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
  //*---------------------------------------------------------------------------
  socket.on('sign-in', async (email, ack) => {
    const log = logger(`${logPrefix}:sign-in`);
    log(`Servicing 'sign-in' request/response on socket: ${socket.id}`);

    // convenience util
    function userErr(userMsg) {
      log.v(userMsg)
      ack({errMsg: '*** USER ERROR *** in "sign-in" event',
           userMsg});
    }

    // convenience util
    function validEmail(emailStr) {
      var re = /\S+@\S+\.\S+/; // VERY SIMPLISTIC ... anystring@anystring.anystring
      return re.test(emailStr);
    }

    // transform the email to a trimmed lowercase value
    // ... KEY: this is critical to assure consistent comparison and matching
    email = email.trim().toLowerCase();

    // validate request params
    if (!email) {
      return userErr('email must be supplied');
    }
    if (!validEmail(email)) {
      return userErr('Email is invalid');
    }

    // generate and send email to user with verification code
    try {
      generateEmailVerificationCode(socket, email);
      await sendEmailVerificationCode(socket);
    }
    catch(e) {
      log.f(`*** ERROR *** Problem sending email verification code`, e);
      if (e.response) {
        log.f(`response: `, e.response.body)
      }
      ack({
        errMsg: `Unexpected condition in sending email verification code ... ${e}`,
      });
    }

    // acknowledge 'sign-in' success (i.e. a verification code has been emailed)
    return ack();
  });

  //*---------------------------------------------------------------------------
  //* handle client sign-in verification request (a request/response API)
  //* RETURN: (via ack):
  //*           {
  //*             userState, // to update client user object
  //*             token,     // to be retained on client (for preAuthenticate)
  //*           }
  //* THROW:  Error (via ack) with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
  //*---------------------------------------------------------------------------
  socket.on('sign-in-verification', async (verificationCode, ack) => {
    const log = logger(`${logPrefix}:sign-in-verification`);
    log(`Servicing 'sign-in-verification' request/response on socket: ${socket.id}`);

    // convenience util
    function userErr(userMsg) {
      log.v(userMsg)
      ack({errMsg: '*** USER ERROR *** in "sign-in" event',
           userMsg});
      }

    // insure the verificationCode has been supplied
    if (!verificationCode) {
      return userErr('the Verification Code must be supplied');
    }

    // insure the sign-in period has NOT expired
    // ... technically, the client should NOT allow this (just for good measure)
    if (!socket.data.verification) {
      return userErr(`the sign-in verification time has expired ... please cancel and sign-in again`);
    }

    // limit the number of verification attempts to 5
    socket.data.verification.attempts++;
    if (socket.data.verification.attempts > 5) {
      clearSignInVerification(socket);
      return userErr(`you have exceeded the maximum number of verification attempts ... please cancel and sign-in again`);
    }

    // VERY TEMP DEV PROCESS that reveals the code
    // AI: IMPORTANT: REMOVE THIS for production release
    //                ... for good measure
    //                ... even though it should NOT be active in prod (due to differences in env for prod deployment)
    if (process.env.VERIFY_EASTER_EGG && verificationCode === process.env.VERIFY_EASTER_EGG) {
      return userErr(`try: ${socket.data.verification.code}`);
    }

    // verify the correct code has been supplied
    if (verificationCode !== socket.data.verification.code) {
      return userErr(`invalid Verification Code`);
    }

    // ***
    // *** KEY: user sign-in successful - NOW update our server state
    // ***

    // obtain the user associated to this socket -AND- update it's key aspects
    // ... NOTE: our basic socket/device/user structure is pre-established via preAuthenticate()
    // ... NOTE: we mutate this object :-)
    const user = getUser(socket);
    user.email = socket.data.verification.email;
    populateUserProfile(user); // ... re-populate all other user state (via user profile / enablements)

    // clear the verification info found in our socket
    clearSignInVerification(socket);

    // broadcast the latest userState to all clients of this device
    // ... this will change the user/authentication for ALL apps running on this device (all app windows of this browser instance)
    const userState = extractUserState(user);
    broadcastUserAuthChanged(socket/*deviceRef*/, userState, socket/*exclude from broadcast*/);

    // persist verification of user (email) on device / client access point
    // ... NO NEED to wait (await keyword) for this async function to complete
    addPriorAuthDB(user.email,
                   socket.data.deviceId,
                   socket.data.clientAccessIP);

    // generate the token to be sent to our client
    const token = encodeUserToken(user);

    // log all devices AFTER sign-in-verification is complete
    logAllDevices(`All Devices AFTER 'sign-in-verification' of socket: ${socket.id}, device: ${socket.data.deviceId}:`, log);

    // acknowledge 'sign-in-verification' success
    // ... for the initiating client, this is how it is updated
    //     >>> it knows to update localStorage too
    // ... for other clients of this device, they are updated via the broadcast event (above)
    return ack({value: {
      userState,
      token,
    }});
  });

  //*---------------------------------------------------------------------------
  //* handle client sign-in verification request (a request/response API)
  //* RETURN: (via ack): void
  //* THROW:  Error (via ack) with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
  //*---------------------------------------------------------------------------
  socket.on('sign-in-verification-resend-code', async (ack) => {
    const log = logger(`${logPrefix}:sign-in-verification-resend-code`);
    log(`Servicing 'sign-in-verification-resend-code' request/response on socket: ${socket.id}`);

    // convenience util
    function userErr(userMsg) {
      log.v(userMsg)
      ack({errMsg: '*** USER ERROR *** in "sign-in resend code" event',
           userMsg});
    }

    // insure the sign-in period has NOT expired
    // ... technically, the client should NOT allow this (just for good measure)
    if (!socket.data.verification) {
      return userErr(`the sign-in verification time has expired ... please cancel and sign-in again`);
    }

    // send email to user with verification code
    try {
      await sendEmailVerificationCode(socket);
    }
    catch(e) {
      log.f(`*** ERROR *** Problem resending email verification code`, e);
      if (e.response) {
        log.f(`response: `, e.response.body)
      }
      ack({
        errMsg: `Unexpected condition in resending email verification code ... ${e}`,
      });
    }

    // acknowledge 'sign-in-verification-resend-code' success (i.e. a verification code has been emailed)
    return ack();

  });


  //*---------------------------------------------------------------------------
  //* handle sign-out request (a request/response API)
  //* NOTE: We sign-out the user associated to THIS socket
  //* RETURN: (via ack):
  //*           {
  //*             userState, // to update client user object
  //*             token,     // to be retained on client (for preAuthenticate)
  //*           }
  //* THROW:  Error (via ack) with optional e.userMsg (when e.isExpected()) for expected user error (ex: User NOT signed-in)
  //*---------------------------------------------------------------------------
  socket.on('sign-out', async (ack) => {
    const log = logger(`${logPrefix}:sign-out`);
    log(`Servicing 'sign-out' request/response via socket: ${socket.id}`);

    // convenience util
    function userErr(userMsg) {
      log.v(userMsg)
      ack({errMsg: '*** USER ERROR *** in "sign-out" event',
           userMsg});
    }

    // test userError
    // return userErr('sign-out ... this is a test of an EXPECTED userError FROM the server');
    // test UNEXPECTED Error
    // return ack({errMsg: 'sign-out ... this is a test of an UNEXPECTED Error FROM the server'});

    // obtain the user associate to this socket
    // ... NOTE: our basic socket/device/user structure is pre-established via preAuthenticate()
    // ... NOTE: we mutate this object :-)
    const user = getUser(socket); // ... we mutate this object (below)

    // verify this user is signed in
    // ... client should NOT allow this to happen (just for good measure)
    if (!user.isSignedIn()) {
      return userErr(`Cannot sign-out user ${user.getUserName()}, USER IS NOT signed-in.`);
    }

    // ***
    // *** KEY: user sign-out successful - update our server state
    // ***

    // clear DB of prior verification of user (email) for ALL device / client access point
    // ... NO NEED to wait (await keyword) for this async function to complete
    clearPriorAuthDB(user.email);

    // force cross-device sign-out of this email account
    // ... NOTE: our user object is updated (i.e. mutated)
    signOutCrossDevice(socket);

    // reset our device (i.e. it's deviceId)
    // ... this is an opportune time, since all accounts of this email are now signed-out
    //     GOAL: minimize deviceId theft
    //     NOTE: this is reflected BOTH on the client -and- server
    //           REMEMBER: the device connection out-lives the user sign-in (it is part of the socket/window/app)
    await resetDevice(socket);

    // generate the userState/token to be sent to our client
    // ... NOTE: the user object has been updated (mutated) by signOutCrossDevice() (above)
    const userState = extractUserState(user);
    const token     = encodeUserToken(user);

    // log all devices AFTER sign-in-verification is complete
    logAllDevices(`All Devices AFTER 'sign-out' of socket: ${socket.id}, device: ${socket.data.deviceId}:`, log);

    // acknowledge 'sign-out' success
    // ... for the initiating socket, this return value is how it is informed/updated
    //     >>> KEY: it knows to update localStorage too
    // ... for other clients of various devices, they are updated
    //     via a broadcast event, initiated from signOutCrossDevice() (above)
    return ack({value: {
      userState,
      token,
    }});
  });

} // end of ... registerAuthHandlers()


//******************************************************************************
//******************************************************************************
//* Email Authentication related code
//******************************************************************************
//******************************************************************************

// PriorAuthDB: currently mimicking localStorage till we have a full DB implementation
//   key:   email
//   value: [deviceId+clientAccessIP, ...] <<< all devices/clientAccessIPs previously authenticated on

//*---------------------------------------------------------
//* DB Op:
//* Has given email been previously authenticated on the
//* supplied identifiers (per our persistent user-DB registry)?
//* RETURN: boolean
//*---------------------------------------------------------
async function hasPriorAuthDB(email,
                              deviceId,
                              clientAccessIP) {
  // return true; // DO THIS - for hardcoded rendition
  const combinedValue = combineDeviceIdAndClientAccessIP(deviceId, clientAccessIP);
  const allDevices    = await storage.getItem(email) || [];
  return allDevices.includes(combinedValue);
}

//*---------------------------------------------------------
//* DB Op:
//* Add supplied identifiers to given email (create on first usage) as being previously authenticated
//* (per our persistent user-DB registry).
//* RETURN: void
//*---------------------------------------------------------
async function addPriorAuthDB(email,
                              deviceId,
                              clientAccessIP) {
  // return; // DO THIS - for hardcoded rendition (no-op)
  const combinedValue = combineDeviceIdAndClientAccessIP(deviceId, clientAccessIP);
  const allDevices    = await storage.getItem(email) || [];

  // add if not already there
  if (!allDevices.includes(combinedValue)) {
    await storage.setItem(email, [...allDevices, combinedValue]);
  }
}

//*---------------------------------------------------------
//* DB Op:
//* Clear given email entry as being authenticated on any
//* prior identifier (per our persistent user-DB registry).
//* RETURN: void
//*---------------------------------------------------------
async function clearPriorAuthDB(email) {
  // return;  // DO THIS - for hardcoded rendition (no-op)
  const allDevices = await storage.getItem(email);

  // remove if exists
  if (allDevices) {
    await storage.removeItem(email);
  }
}

//*---------------------------------------------------------
//* DB Op (support):
//* Combine the supplied deviceId/clientAccessIP
//* RETURN: string
//*---------------------------------------------------------
function combineDeviceIdAndClientAccessIP(deviceId, clientAccessIP) {
  return deviceId + '@/@' + clientAccessIP;
}

//*---------------------------------------------------------
//* Generate a "stringified" cryptographically strong random number between the supplied min/max.
//* RETURN: <string> stringified random number between min/max
//*---------------------------------------------------------
function randomNumberStr(min, max) {
  // generate a cryptographically strong random number
  const arr = new Uint32Array(1);
  crypto.webcrypto.getRandomValues(arr);

  // convert our random integer to a floating point from 0-1
  const randomFloat = arr[0] / (0xffffffff + 1);

  // convert to a stringified integer within range
  const randomStr = Math.floor(randomFloat * (max - min + 1) + min) + '';

  // that's all folks :-)
  return randomStr;
}

//*---------------------------------------------------------
//* Generate a verification code for the supplied email,
//* retaining authentication info in the supplied socket.
//* RETURN: void (promise)
//* ERROR:  via (promise) - unsuccessful operation (to be handled by invoker)
//*---------------------------------------------------------
function generateEmailVerificationCode(socket, email) {

  // generate the random verification code (between 100,000 and 999,999)
  const verificationCode = randomNumberStr(100000, 999999);
  // log(`verificationCode: ${verificationCode}`); // NO NO: info is too sensitive

  // expire verification code in 5 mins
  const timeout = 5 * 60 * 1000;
  const timeoutID = setTimeout(() => {
    clearSignInVerification(socket);
  }, timeout);

  // retain authentication info in the supplied socket
  socket.data.verification = {
    code:       verificationCode,
    attempts:   0,
    timeoutID,
    email,
  };
}


//*---------------------------------------------------------
//* Email verification code to the email defined in the supplied socket.
//* RETURN: void (promise)
//* ERROR:  via (promise) - unsuccessful operation (to be handled by invoker)
//*---------------------------------------------------------
async function sendEmailVerificationCode(socket) {

  // no-op in a dev environment, when it has an alternate way to obtain the verification code
  // AI: IMPORTANT: REMOVE THIS for production release
  //                ... for good measure
  //                ... even though it should NOT be active in prod (due to differences in env for prod deployment)
  if (isDev && process.env.VERIFY_EASTER_EGG) {
    return;
  }

  // no-op when sign-in period has expired
  // ... technically, the client should NOT allow this (just for good measure)
  if (!socket.data.verification) {
    return;
  }

  // send the verification code to the email defined in the supplied socket
  // ... define the verification message to be sent
  const emailContent = {
    to:      socket.data.verification.email,
    bcc:     'kevin@appliedsofttech.com', // AI: IMPORTANT: very temporary for now (monitor all sign-in activity IN the early days)
    from:    'kevin@appliedsofttech.com', // AI: use the email address or domain you verified with SendGrid
    subject: 'Verification Code from visualize-it',
    text:    `You have requested to access a visualize-it account through this email address\n\n` +
             `To complete this process, enter the code below in your visualize-it verification screen:\n\n ${socket.data.verification.code}\n\n` +
             `This code will expire after 10 minutes.\n\n` +
             `Didn't request this code from visualize-it?  Someone may be attempting to use your email address as an account identifier.\n\n` +
             `This is a system generated email. Replies will not be read or forwarded for handling.`,
  };
  // ... send the email
  //     NOTE: ANY ERROR should be handled by our invoker
  await sendGridMail.send(emailContent);
}

//*---------------------------------------------------------
//* Clear out the sign-in verification info found in the supplied socket
//* 
//* There are four contexts in which this function "could" be invoked:
//* 
//*  1. successful verification <<< this clear function IS invoked (server-side)
//*     Here the client SignIn screen will explicitly reset itself
//* 
//*  2. user cancels the sign-in verification <<< this clear function is currently NOT invoked (client-side)
//*     Here the client SignIn screen will explicitly reset itself.
//*     We use the KISS principle, and do NOT notify the server,
//*     as it will automatically expire in a short time.
//* 
//*  3. sign-in verification expires <<< this clear function IS invoked (server-side)
//*     Here the clear function is invoked BY a server-initiated process (via timeout).
//*     We employ a KISS principle, and DO NOT notify the client.
//*     The client will discover this when they attempt to verify,
//*     and the user can explicitly cancel the operation.
//* 
//*  4. user has exceeded the max number of "invalid" verification attempts.
//*     ... similar to #3
//* 
//* RETURN: void
//*---------------------------------------------------------
function clearSignInVerification(socket) {
  // clear out socket.data.verification
  // ... indicating that we are NO LONGER in a sign-in verification phase
  if (socket.data.verification) {
    clearTimeout(socket.data.verification.timeoutID);
    socket.data.verification = null;
  }
}


//******************************************************************************
//******************************************************************************
//* User related code
//******************************************************************************
//******************************************************************************


//*-------------------------------------------------
//* Create new user object using supplied parameters.
//* DEFAULT: unregistered guest user
//* RETURN:  newly created User
//*-------------------------------------------------
function createUser({email='', name='', admin=false, guestName=''}={}) {

  // closely mimic client-side user object (a reflexive svelte store)
  const user = {
    email, // email (user authentication ID)
    name, // name of user (from server profile)

    // various enablements (from server)
    // ... populated from DB
    enablement: {
      admin,
    },

    // for registered guests (NOT signed-in) ...
    guestName,

    // ***************************
    // *** value-added methods ***
    // ***************************

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

  return user;
}


//*---------------------------------------------------------
//* Populate user state from our user profile / enablements
//* ... as simulated from DB
//* ... per usr.email (which must be pre-set)
//* ... NOTE: the supplied user object is mutated
//*---------------------------------------------------------
function populateUserProfile(user) {
  // establish various values from our "simulated" user profile
  if (user.email) {
    const [name] = user.email.split('@'); // AI: simulated user profile
    user.name = name;
  }
  else {
    user.name = '';
  }
  user.enablement.admin = user.name.toLowerCase() === 'kevin' ? true : false; // AI: simulated authorization process
}

const tokenDelim = '#/#';

//*---------------------------------------------------------
//* Generate an encrypted user token from the supplied user
//* ... suitable to be retained on the client
//* ... and used in our preAuthenticate process
//* RETURN: encrypted user token
//*---------------------------------------------------------
function encodeUserToken(user) {
  // encoding: guestName#/#email
  // ... placing email SECOND
  //     making it more obscure to manually inject (since we DO support un-encrypted plain text)
  const token = user.guestName + tokenDelim + user.email;

  // encrypt
  // ... currently do NOT handle error from internal encryption problem
  const encryptedToken = encrypt(token);

  return encryptedToken;
}

//*---------------------------------------------------------
//* Extract contents of the supplied encrypted user token
//* ... provided by our client
//* ... and used in our preAuthenticate process
//* RETURN: {email, guestName}
//*---------------------------------------------------------
function decodeUserToken(token) {

  // decrypt token
  // ... we explicitly handle errors (since this token is coming from the client)
  let plainToken = tokenDelim;
  try {
    plainToken = decrypt(token);
  }
  catch(e) {
    let errMsg = `***WARNING** a problem occurred during decryption of token: '${token}'`
    // accept plain text (un-encrypted tokens)
    if (token.includes(tokenDelim)) {
      plainToken = token;
      errMsg += ` ... the token WAS NOT encrypted (so we used it as-is)`;
    }
    else {
      errMsg += ` ... punting and NOT using the token :-(`;
    }
    log.f(errMsg, e);
  }

  // encoding: guestName#/#email
  // ... placing email SECOND
  //     making it more obscure to manually inject (since we DO support un-encrypted plain text)
  const [guestName, email] = plainToken.split(tokenDelim);

  return {email, guestName};
}

//*-------------------------------------------------
//* Extract the state from the supplied user object
//* ... suitable to be communicated to our client
//*     (i.e. NO sensitive or internal data)
//* RETURN: {
//*           email,
//*           name,
//*           enablement: {
//*             admin,
//*           },
//*           guestName,
//*         }
//*-------------------------------------------------
function extractUserState(user) {
  return {
    email: user.email,
    name:  user.name,
    enablement: {
      admin: user.enablement.admin,
    },
    guestName: user.guestName,
  };
}


//*-------------------------------------------------
//* return the user associate to the supplied deviceId|device|socket|socketId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: User ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getUser(ref) {
  return getDevice(ref)?.user;
}


//*-------------------------------------------------
//* return the user name associate to the supplied deviceId|device|socket|socketId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: userName ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getUserName(ref) {
  return getUser(ref)?.getUserName();
}


//*-------------------------------------------------
//* broadcast user authorization changes to all clients of a device
//* ... initiated BY server TO client
//* ... this will change the user/authentication for ALL apps running on the supplied device
//*     (all windows of this browser instance)
//* ... because this is a "broadcast" event
//*     NO response is possible, therefore we DO NOT wrap this in a promise
//* ... this is a convenience function wrapping the socket protocol
//* RETURN: void
//*-------------------------------------------------
function broadcastUserAuthChanged(deviceRef,       // the device reference, specifying the clients to broadcast to
                                                   // ... deviceId|device|socket|socketId (one in the same)
                                  userState,       // the current user state to broadcast
                                  excludeSocket) { // an optional initiating socket to be excluded from this broadcast
                                                   // ... CONTEXT: the initiating socket has already communicated/handled this change (typically via return semantics)
  const device   = getDevice(deviceRef);
  const deviceId = device.deviceId;
  const deviceRm = deviceRoom(deviceId);

  // broadcast the 'user-auth-changed' event to all clients of the supplied device
  log(`broadcastUserAuthChanged() ... broadcast 'user-auth-changed' event - deviceId: '${deviceId}', userState: `, userState);
  if (excludeSocket) { // ... to ALL room members EXCLUDING socket (API driven by socket)
    excludeSocket.to(deviceRm).emit('user-auth-changed', userState);
  }
  else { // ... to ALL room members (API driven by the socket.io server)
    io.in(deviceRm).emit('user-auth-changed', userState);
  }
}


//*-------------------------------------------------
//* send pre-authentication results to the supplied client (socket)
//* ... initiated BY server TO client
//* ... this is an push event only - NO response is supported
//* RETURN: void
//*-------------------------------------------------
function sendPreAuthentication(socket,     // the initiating socket
                               userState,  // the current data for user object
                               userMsg) {  // the message to display to our user
  // emit the 'pre-authentication' event to the supplied client (socket)
  log(`sendPreAuthentication() ... emit 'pre-authentication' event - socket: '${socket.id}': `, {userState, userMsg});
  socket.emit('pre-authentication', userState, userMsg);
}

//*-------------------------------------------------
//* Force a cross-device sign-out of an email account.
//*
//* BOTH the email account and device are implied through the supplied initiatingSocket.
//* 
//* NOTE: The sign-out process is the only one that crosses device boundaries.
//*       Even though it is a bit broad in scope, this is done to safeguard ID theft.
//*       - ANY hackers with stolen deviceId/token will NOT be able to refresh and auto 
//*         preAuthenticate(), BECAUSE:
//*           1. the deviceId has changed -and-
//*           2. the PriorAuthDB has been cleared of prior verified access points for this user (email)
//*       Typically, in normal usage, this will NEVER be seen by most users.
//* 
//* RETURN: void
//*-------------------------------------------------
function signOutCrossDevice(initiatingSocket) { // the initiating socket identifies the email to sign-out

  const initiatingDevice = getDevice(initiatingSocket);
  const emailToSignOut   = initiatingDevice.user.email;

  //***
  //*** Force a cross-device sign-out of an email account
  //***

  // iterate over all active devices
  const allDevices = Array.from(devices.values());
  for (const device of allDevices) {
    const user = device.user;

    // exclude devices NOT authenticated with our target account (email)
    if (user.email !== emailToSignOut) {
      continue;
    }

    // update the device's user object to be signed-out
    user.email = '';
    populateUserProfile(user); // ... re-populate all other user state (via user profile / enablements)

    // broadcast the latest userState to all clients of this device
    // ... this will change the user/authentication for ALL apps running on this device (all app windows of this browser instance)
    const userState = extractUserState(user);
    if (device === initiatingDevice) {
      // exclude initiatingSocket from this broadcast BECAUSE it get's it's notification from our invoker's return value
      broadcastUserAuthChanged(device, userState, initiatingSocket/*exclude from broadcast*/);
    }
    else {
      broadcastUserAuthChanged(device, userState);
    }
  }
}


//******************************************************************************
//******************************************************************************
//* clientAccessIP related code
//******************************************************************************
//******************************************************************************


//*-------------------------------------------------
//* Return the clientAccessIP associated to the supplied socket header.
//* 
//* This IP is used by our authentication process in an attempt to
//* identify nefarious usage (by hackers).
//*
//* Keep in mind that it is an access IP (i.e. a router), so it is NOT
//* unique to a client (presumably low-level internals vary port to
//* get to a specific client).  As a result, it must be supplemented
//* by deviceId to gain the uniqueness quality we desire.
//* 
//* RETURN: clientAccessIP <string> ... ex: '72.61.152.131'
//*-------------------------------------------------
function gleanClientAccessIPFromHeader(socket) {
  // found in the http header where the socket was created
  // ... X-Forwarded-For MAY CONTAIN: <client>, <proxy1>, <proxy2>
  //     HOWEVER, I am not accounting for proxy at this time
  //     ... socket.handshake.headers['x-forwarded-for'].split(',')[0];
  //     ... because of socket.request.connection.remoteAddress fallback usage
  let clientAccessIP = socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;

  // ALL following techniques get the same thing on localhost: '::1'
  // ... https://stackoverflow.com/questions/6458083/get-the-clients-ip-address-in-socket-io
  // ... https://github.com/socketio/socket.io/issues/1387
  //? log(`clientAccessIP: ${clientAccessIP}`);
  //? log(`socket.handshake.address: `, socket.handshake.address);
  //? log(`UNDEFINED: socket.handshake.address. address/port: `, {address: socket.handshake.address.address, port: socket.handshake.address.port});
  //? log(`socket.request.connection.remoteAddress: `, socket.request?.connection?.remoteAddress);

  // normalize '::1' to '127.0.0.1' (localhost)
  // ... '::1' is the loopback address in ipv6
  //     equivalent to 127.0.0.1 in ipv4
  //     see: https://en.wikipedia.org/wiki/Localhost
  if (clientAccessIP === '::1') {
    clientAccessIP = '127.0.0.1';
  }

  // AI: there is some phenomenon under "some circumstances" where the 'x-forwarded-for' header is undefined
  //     - I have seen this randomly in dev localhost
  //     - just refreshing the browser puts the header back
  //     - NOT sure what is going on here
  if (clientAccessIP.includes('ffff')) {
    log.f(` `);
    log.f(`************* `);
    log.f(`************* the '::ffff:' phenomenon just occurred:`, {
      header:        socket.handshake.headers['x-forwarded-for'],
      remoteAddress: socket.request.connection.remoteAddress
    });
    log.f(`************* `);
    log.f(` `);

    // for now I FIX the "very narrow" case of dev here
    // ... I assume this is a more broad problem (for production IPs)
    if (clientAccessIP === '::ffff:127.0.0.1') {
      clientAccessIP = '127.0.0.1';
      log.f(`************* converting '::ffff:127.0.0.1' TO '127.0.0.1'`);
    }
  }

  return clientAccessIP;
}


//******************************************************************************
//******************************************************************************
//* Device related code
//******************************************************************************
//******************************************************************************

// all active devices
//   a Map:
//   deviceId<key>: Device<value>           Room('device-{deviceId}') ---1:M--< socket
//                   - deviceId<string> primary key
//                   - user<Device>
const devices = new Map();

// diagnostic logging utility
async function logAllDevices(msg='ALL DEVICES', myLog=log) {
  if (myLog.enabled) {
    const allDevices = Array.from(devices.values());
    const allEntries = [
      // { 
      //   "device": {
      //     "deviceId": "26de8f7b-c125-486b-a919-6002e32e1c0f",
      //     "user": {
      //       "email": "kevin@wiibridges.com",
      //       "name": "kevin",
      //       "enablement": {
      //         "admin": true
      //       },
      //       "guestName": "Petree"
      //     },
      //     "clientAccessIP": "127.0.0.1",
      //     "os": "Windows-10",
      //     "browser": "Chrome-107.0.0.0"
      //   },
      //   "socketIds": [
      //     "cTI2QOdwzt_K6TDcAAAB - clientType: ide",
      //     "2YT1FTCr68gT-nISAAAE - clientType: ide"
      //   ]
      // }
      // ...
    ];
    for (const device of allDevices) {
      const entry = {device};
      const sockets   = await getSocketsInDevice(device);
      entry.socketIds = sockets.map(socket => `${socket.id} - clientType: ${socket.data.clientType}`);
      allEntries.push(entry);
    }
    myLog(`${msg} ... total: ${allDevices.length} ... `, prettyPrint(allEntries));
  }
}

//*-------------------------------------------------
//* return the device associate to the supplied deviceId|device|socket|socketId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: Device ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getDevice(ref) {
  const deviceId = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  let   device = devices.get(deviceId);
  if (!device) { // as a last resort, interpret ref as a socketId
    const socket = io.sockets.sockets.get(ref);
    device = devices.get(socket?.data?.deviceId);
  }
  return device;
}

//*-------------------------------------------------
//* create/catalog new device object using supplied parameters
//* RETURN: Device ... newly created
//*-------------------------------------------------
function createDevice(deviceId, user, clientAccessIP, userAgent) {

  // prevent the creation of a duplicate device key
  // ... we do NOT want to cover up the prior device
  // ... NOTE: based on current logic, should NEVER happen (just for good measure)
  if (getDevice(deviceId)) {
    throw new Error(`***ERROR*** createDevice() cannot create duplicate device with key: ${deviceId}`);
  }

  // convert userAgent to OS/browser
  const uaParser = new UAParser(userAgent);
  const uaResult = uaParser.getResult();
  const os      = uaResult.os.name      + '-' + uaResult.os.version;
  const browser = uaResult.browser.name + '-' + uaResult.browser.version;

  // create our new device
  const device = {
    deviceId,       // primary key
    user,
    // ... following convenience (consolidation here is possible because we guarantee all sockets of a devices is from the SAME browser instance)
    clientAccessIP,
//  userAgent, ... too cryptic
    os,
    browser,
  };

  // catalog our new device
  devices.set(deviceId, device);

  // that's all folks
  return device;
}

//*-------------------------------------------------
//* remove the device associate to the supplied socket/device/deviceId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: boolean ... true: removed, false: no-op (device NOT cataloged)
//*-------------------------------------------------
function removeDevice(ref) {
  const deviceId = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  return devices.delete(deviceId);
}

//*-------------------------------------------------
//* return all sockets associated to a given device.
//* PARM:   ref: deviceId | Device | socket
//* RETURN: socket[] VIA promise
//*-------------------------------------------------
async function getSocketsInDevice(ref) {
  const deviceId  = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  const deviceSockets = await io.in(deviceRoom(deviceId)).fetchSockets(); // ... an array of sockets[]
  return deviceSockets;
}

//*-------------------------------------------------
//* Reset the device (i.e it's deviceId), defined from the supplied socket
//* 
//* Both client and server data structures reflect this change.
//* 
//* PARM:   socket: identifies the device to reset -and- is used in client request to reset the deviceId
//* RETURN: void VIA promise
//*-------------------------------------------------
async function resetDevice(socket) {

  const device = getDevice(socket);

  // define the "old" room, using the "old" deviceId (which needs to be cleaned-up)
  const oldRoom = deviceRoom(device.deviceId);

  // reset the deviceId on our client
  // ... the client actually establishes/retains the new deviceId (a random string)
  const newDeviceId = await resetDeviceIdFromClient(socket);

  // un-catalog the device object (since it's key IS GOING TO change)
  devices.delete(device.deviceId);

  // reflect the new deviceId in our device object
  device.deviceId = newDeviceId;

  // update ALL socket back-references within the NEW deviceId
  // ... this step CAN be done after mutating the device
  //     BECAUSE we use socket to seed getSocketsInDevice() (which hasn't changed yet)
  //     RATHER than seeding it with device (which is mutated in our prior step)
  const sockets = await getSocketsInDevice(socket);
  sockets.forEach(socket => {
    // for complete cleanup, need to leave the "old" room
    // ... not critical but it is never used :-)
    socket.leave(oldRoom);

    // our common utility sets up the room and socket back-references
    setupDeviceSocketRelationship(device, socket);
  });

  // re-catalog the device object (since it's key has changed)
  devices.set(device.deviceId, device);
}

//*-------------------------------------------------
//* return  the socket.io room, defining the Device TO Socket relationship
//* PARM:   deviceId
//* RETURN: socket.io room <string>
//*-------------------------------------------------
const deviceRoom = (deviceId) => `device-${deviceId}`;


/********************************************************************************
 * Pre-Authenticate user upon the initial client socket connection.
 *
 * This process establishes the baseline structure for the
 * device/user/socket that is assumed throughout all service requests.
 *
 * The resulting user may either be 
 * - authenticated (i.e. signed-in) ... per a client-retained authentication token
 * - or a registered guest user
 * - or a unregistered guest user
 *
 * The following structure is established by this function at the initialization
 * of the socket connection:
 * - Device(user) object is established, either newly created or existing reference.
 * - A bi-directional relationship between Device(User)/Socket(window) is setup
 *    Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
 *      ... see notes at the top of this module!
 *
 * Once complete, the following PUBLIC API is available:
 *   + getDevice(deviceId|device|socket|socketId):   Device
 *   + getUser(deviceId|device|socket|socketId):     User (same as: device.user)
 *   + getUserName(deviceId|device|socket|socketId): string
 *********************************************************************************/
export async function preAuthenticate(socket) {
  const log = logger(`${logPrefix}:preAuthenticate`);

  log(`processing client socket(${socket.id})`);

  // retain our socket.io server
  // ... this is a duplicate of registerAuthHandlers() ... above
  //     BECAUSE preAuthenticate( is invoked EVEN prior to registerAuthHandlers()
  if (!io) { // ... do the first time only (all subsequent sockets would be duplicate
    io = socket.server;
  }

  // adorn our socket obj with the following standard items
  // ... clientType: 'ide'/'sys' - supplied by client app
  socket.data.clientType = socket.handshake.auth.clientType
  log(`using clientType (gleaned from client app): ${socket.data.clientType}`);
  // ... userAgent: browser identification (from socket header)
  //     EX: Chrome Browser:
  //         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
  //     NOTE: currently NOT used, because we have a definitive way to confirm the same browser instances in a device
  socket.data.userAgent = socket.handshake.headers['user-agent'];
  log(`using userAgent (gleaned from socket header): ${socket.data.userAgent}`);

  // NOTE: For deviceId and token, we do NOT use socket.io's standard
  //       auth.token (supplied at client socket creation time).
  //       Rather we use an interactive server-2-client handshake
  //       for our initialization protocol.  The reason for this is:
  //       - Our client socket is long-lived.  It is created at the
  //         client app startup, and can span multiple users (via
  //         sign-out/sign-in).
  //         NOTE: this alone rules out auth.token for BOTH deviceId -and- token
  //       - Because of this, we need the dynamics of a run-time API
  //         (initiated from server to client) that can accommodate changes
  //         in user identity, and even changes in the deviceId (used
  //         to thwart malicious activity).
  //       - The standard socket.io auth.token is static in nature (defined 
  //         at socket creation time) and therefore does NOT accommodate
  //         these dynamics).

  // working vars scoped outside of try/catch block for error processing recovery
  let clientAccessIP   = '';        // the client IP (access point ... i.e. router)
  let deviceId         = undefined; // the client-managed logical deviceId (a persisted random num via localStorage) <<< the device Key
  let device           = undefined; // the device obj, containing user, and managing concurrent client sessions (i.e. sockets - alias to browser window)
  let user             = undefined; // contained in device
  let userMsg          = '';        // the message to send to the user upon completion (defaults to a Welcome msg)
  let issueEmail       = '';        // an email to send an issue to
  let processRestarted = false;     // prevent finally block from running (on restart scenario)

  // NOTE: the goal of this try/catch block is to fully define the working vars (above) - to be used in subsequent steps
  try { // ... try/catch preventing errors from crashing our server (some errors may be from our client)

    // TEST ERROR CONDITION: 
    // ... also try NOT responding on client 'get-device-id' event (see client/src/user.js)
    //     resulting in time-out error
    // if (1===1) throw new Error('Test error in preAuthenticate');

    // obtain the clientAccessIP associated to the supplied socket header
    clientAccessIP = gleanClientAccessIPFromHeader(socket);
    log(`using clientAccessIP (gleaned from socket header): ${clientAccessIP}`);
    // ... as a convenience hold the clientAccessIP in the socket directly
    socket.data.clientAccessIP = clientAccessIP;

    // obtain the deviceId of this client
    deviceId = await getDeviceIdFromClient(socket);
    log(`using deviceId (gleaned from client app): ${deviceId}`);

    // AUTO-ACCESS-1: for a pre-existing device, the user is automatically accepted in this existing session
    //                PROVIDING the SAME browser instance is being used (definitively confirmed)!
    //                ... in other words, they are already running our app in a separate browser window,
    //                    and we accept those credentials
    //     RISK:      there is NO risk in this scenario BECAUSE we confirm the same browser instance is in-use
    //     CONTEXT:   if there were NO confirmation of same browser, a hacker could steal the deviceId
    //                and gain access providing the real user was active.
    //     SIDE-BAR:  there is a slight chance that the existing session is a hacker (and this new request is the real user)
    //                WHEN the hacker was active first (from AUTO-ACCESS-2 below)
    //                - this is less likely, but still a possibility
    //                  BECAUSE: the hacker would need to be on a previously validated access point of the real user (or inside the same router of the real user)
    //                - if that happens, the real user can regain control (ousting the hacker) by simply: sign-in/sign-out:
    //                  AI: consider creating a "restoration" process that does this automatically for the user (so they don't have to do a sign-in/sign-out
    //                  AI: the following summary promotes too much insight (should the hacker look at this code)
    //                  0. in this scenario the hacker is actively signed-in (see: AUTO-ACCESS-2 below)
    //                     >>> for this to happen, they have to:
    //                         a. steal both the deviceId/token
    //                            ... this theft is thought to rare, as it requires physical access to the computer's localStorage
    //                                (assuming all XSS doors have been shut)
    //                            ... remember, the deviceId changes frequently (on sign-out)
    //                         b. access the system when the real user is NOT actively signed-in
    //                     AND the real user starts out as a Guest (because the hacker has stolen their identity and is actively signed-in)
    //                     ... with a device with the temporary key
    //                  1. sign-in (verifying you own the email account)
    //                     ... this is still using the device with a temporary key
    //                     ... we now have two sessions with the same account (the hacker and the real user)
    //                  2. sign-out immediately (this forces the active hacker to be signed-out, in such a way that they can no longer regain access, in their current state)
    //                     ... forces sign-out of the hacker
    //                     ... clears previously validated access points
    //                     ... resets the real user deviceId
    //                         ... the reset process also reactivates the device with a legit key (of the newly reset deviceId)
    //                         >>> a hacker browser refresh will NO LONGER provide access to the account
    //                             MSG: you must explicitly sign-in because you have not authenticated from this internet access point 
    //                  3. everything is now back to normal (and has been re-secured)
    //                     go ahead and sign-in as you normally would
    //                     >>> for the hacker to regain access, they would need to repeat their prior steps 
    //                         a. re-steal both the deviceId/token
    //                            ... this theft is thought to rare, as it requires physical access to the computer's localStorage
    //                                (assuming all XSS doors have been shut)
    //                            ... remember, the deviceId changes frequently (on sign-out)
    //                         b. access the system when the real user is NOT actively signed-in
    device = getDevice(deviceId);
    if (device) {
      log(`device ${deviceId} pre-existed ... checking to insure the same browser is being used`);

      // confirm the requesting browser instance is the same as the existing browsers of this device!
      const sockets = await getSocketsInDevice(device);
      const existingSessionSocket = sockets[0]; // ... only need to check the first socket (all will have the same browser characteristic)
      const tempKey = 'TEMP-' + randomNumberStr(100000, 999999); // ... convert to string for easy comparison
      const tempVal = randomNumberStr(100000, 999999) + '';      //     ditto

      await setTempEntryOnClient(existingSessionSocket, tempKey, tempVal);            // set temp entry on existing session
      const tempValOnPendingSession = await getTempEntryFromClient(socket, tempKey);  // get temp entry on new session (if same browser, should be the same)

      // THIS IS IT: a definitive determination of if both sessions are from the same browser!
      // Even though the value is stored/retrieved on different sessions (sockets),
      // because the browser localStorage is used (in the client implementation),
      // the value retrieved should be the value stored
      // PROVIDING the two sessions are on the same browser!!!
      // NOTE: Technically we cannot determine if the hacker is the existing session -or- the new request
      //       BECAUSE: the hacker could be active first (via: AUTO-ACCESS-2 ... see below)
      //                ... this is less likely, but still a possibility
      if (tempVal !== tempValOnPendingSession) {
        log.f(`***************** STOLEN IDENTITY DETECTED: `, {
          key:                        tempKey,
          sentToExistingSession:      tempVal,
          receivedFromPendingSession: tempValOnPendingSession
        });
        issueEmail = device.user.email; // ... may be '' if device is NOT signed in ... typically this will be the real user ... however if the hacker is IN first and they have signed-in on their account, the email will go to them :-(
        throw new Error('STOLEN IDENTITY DETECTED'); // ... see special logic in catch (of try/catch)
      }

      //***
      //*** KEY: We have proven that the new session is on the same browser as the existing device!
      //***

      // THIS IS IT (for AUTO-ACCESS-1):
      // the user is automatically accepted in this existing session
      log(`device ${deviceId} pre-existed (re-used): `, prettyPrint({device}));
      user = device.user;
    }

    // CREATE a new user/device, on first-use (for a not-previously active user/device)
    // ... potentially pre-authenticated from saved client credentials (an auth token - if any)
    else {
      log(`device ${deviceId} did NOT pre-exist (was not active) ... creating a new one`);

      // create our new user DEFAULTING to an unregistered guest user
      user = createUser();

      // attempt to authenticate from saved client credentials (an auth token - if any)
      const token = await getAuthTokenFromClient(socket); // email/guestName
      if (token) {
        const {email: emailFromToken, guestName: guestNameFromToken} = decodeUserToken(token);
        log(`client token: `, {email: emailFromToken, guestName: guestNameFromToken});

        // we conditionally accept the token credentials
        // ... see comments (below)
        let acceptToken = false;
        let logMsg      = 'auth token message to-be-defined (should never see this unless problem in logic)';

        // when this token represents a signed-in user, having a user account (i.e. email)
        if (emailFromToken) {
          // AUTO-ACCESS-2: accept account credentials when the account has been previously authenticated on given deviceId/clientAccessIP
          // NOTE: This will THWART "most" nefarious hackers (where deviceId/token are stolen through various techniques)
          //       BECAUSE they are NOT automatically granted access when they are in a different location.
          // RISK: if hacker steals BOTH the deviceId/token
          //       -AND- the hacker is on a previously authenticated clientAccessIP (either an insider in a company, or an access point previously used by real user)
          //       -THEN- they ARE IN (without any other checks)
          //       ALSO NOTE: The hacker will be "ousted" when a sign-out occurs for this user
          //                  (typically the "real" user) BECAUSE 
          //                  - ALL sessions for that user will be signed-out
          //                  - and the deviceId will be reset (on the initiating client)
          //                  - and all persistent PriorAuthDB are cleared (meaning users have to re-authenticate)
          //                  > to get back in, the hacker would need to re-steal the deviceId/token (once real user signs back in)
          if (await hasPriorAuthDB(emailFromToken, deviceId, clientAccessIP)) {
            acceptToken = true;
            logMsg      = `auth token ACCEPTED for previously signed-in user (email: ${emailFromToken}), because of prior authentication on clientAccessIP: ${clientAccessIP}`;
          }
          else {
            acceptToken = false;
            logMsg      = `auth token "NOT" ACCEPTED for previously signed-in user (email: ${emailFromToken}), because they were NEVER previously authenticated on clientAccessIP: ${clientAccessIP}`;
            userMsg     = 'you must explicitly sign-in because you have not authenticated from this internet access point';
          }
        }

        // unconditionally accept any token for signed-out users
        // ... it contains nothing sensitive (only guestName)
        else {
          acceptToken = true;
          logMsg      = `auth token ACCEPTED for signed-out user ... no sensitive data here (only guestName): ${guestNameFromToken})`;
        }

        // THIS IS IT: conditionally pull the trigger on token acceptance
        if (acceptToken) {
          user.email     = emailFromToken;
          user.guestName = guestNameFromToken;
        }

        // log what just happened
        log(logMsg, {
          socket: socket.id,
          clientAccessIP,
          deviceId,
          token: {
            email:     emailFromToken, 
            guestName: guestNameFromToken,
          },
          userMsg,
        });

      } // ... end of token processing ... for NO token we use the unregistered guest user

      // NOW: finish the setup of the newly created user

      // re-populate all other user state (via user profile / enablements)
      populateUserProfile(user);

      // create our new device (containing our newly created user)
      try {
        device = createDevice(deviceId, user, clientAccessIP, socket.data.userAgent);
      }
      catch(e) { // ... ERROR: we attempted to create a duplicate device key
        // Restart our entire preAuthenticate() process to resolve this race condition
        // RACE CONDITION:
        //  - multiple windows are competing to join the same device
        //  - typically this happens during a server restart WHEN multiple windows from the same browser are running
        //  - because TWO or MORE windows are setting up communication concurrently
        //    * due to the async nature of preAuthenticate()
        //    * they BOTH may think they are the first one in, and are attempting to create the device
        // >> FIX: Very simply, we start all over, allowing the 2nd attempt to pick up the existing device correctly
        //         NOTE: This has been tested and it works!
        //               We are NOT concerned with an infinite loop here,
        //               BECAUSE the 2nd attempt will immediately recognize the existing device :-)
        log.f(`***************** RACE CONDITION DETECTED resolving a race condition (competing with multiple window startup) trying to create the same device ... FIX: restart our process`, e);
        processRestarted = true; // ... prevent finally block from running in this process (since we have restarted)
        return await preAuthenticate(socket); // ... this restart is very simple - just call it (no need for a timeout)
      }

    } // ... end of: CREATE a new user/device, on first-use (for a not-previously active user/device)

  } // ... end of: try

  catch(e) { // ... try/catch preventing errors from crashing our server (some errors may be from our client)

    // log this error (on server)
    const errMsg = `*** ERROR *** Unexpected error in preAuthenticate - socket: '${socket.id}' ... ERROR: ${e}`;
    log.f(errMsg, e);

    // EVEN ON ERROR, we must INSURE this critical structure has been established
    // ... this structure is assumed throughout our code, and is therefore critical
    // NOTE: this logic mimics that of a successful preAuthenticate (see above)

    // NOTE: With all the conditional logic (above) in establishing this structure, 
    //       it is thought to be MORE appropriate to start from scratch (using an unregistered Guest user),
    //       rather than a miss-mash of re-use of state from non-error block (above).
    //       ... it would be confusing when (in the rare case) where multiple windows are signed-in
    //           and errors causes the re-use of device/user

    // start from scratch and use content that will create temporary device/user that is an unregistered guest user
    // NOTE: this client/user will ALWAYS be in a device of one TILL they refresh (disconnecting/reconnecting their socket)
    deviceId     = 'SOCKET-FROM-ERROR-' + socket.id; // ... use socket.id (very temporary ... it's all we have)
    user         = createUser(); // ... defaults to: unregistered guest user
    device       = createDevice(deviceId, user, clientAccessIP, socket.data.userAgent);

    // notify user of problem
    if (e.message === 'STOLEN IDENTITY DETECTED') {
      userMsg = 'Our pre-authentication process has detected an identity theft of this account. ' +
                'If you are the real user of this account, an email has been sent to you, with instructions on how to rectify this issue. ' +
                'Hackers are NOT WELCOME in visualize-it.  We have recorded this event and are watching your activity closely!';

      // send email to user with instructions on how to rectify this issue
      if (issueEmail) {
        const emailContent = {
          to:      issueEmail,
          bcc:     'kevin@appliedsofttech.com', // monitor all identity theft
          from:    'kevin@appliedsofttech.com', // AI: use the email address or domain you verified with SendGrid
          subject: 'visualize-it Malicious Activity Detected',
          html:    `<p>We have recently detected suspicious activity <i>(a possible identity theft)</i> of the <b>visualize-it</b> account using this email.</p>
                    <p>You may regain control <i>(ousting the potential hacker)</i> by simply <b>"signing in"</b> and <b>"signing out"</b> of your <b>visualize-it</b> account.</p>
                    <ol>
                    <li>By <b>signing-in</b>, you verify that you own this email account
                    <li>By <b>signing-out</b> immediately, this forces the sign-out of the active hacker ... <i>in such a way that they can no longer regain access <b>(in their current state)</b></i>
                    </ol>
                    <p>Once this is accomplished, you will have regained control <i>(i.e. everything has been re-secured)</i>.</p>
                    <p>You may sign-in as you normally would.</p>
                    <p>Sincerely,<br/>Your visualize-it Support Team</p>`,
        };
        // ... NO NEED to wait (await keyword) for this async function to complete
        sendGridMail.send(emailContent);
      }
    }
    else {
      userMsg = 'An issue occurred in our pre-authentication process:  ' +
                'For the moment, you may continue as a "Guest" user, or explicitly sign-in to your account.  ' +
        // NO:  'You can also try to reconnect at a later point by refreshing your browser.  ' +
                'If this problem persists, reach out to our support staff.  ' +
                `... ${e}`;
    }
  }

  finally { // ... finish up setting up our critical structures (common to BOTH non-error and error block)

    // AI: consider error conditions in this code

    // do NOT run this finally block when our process has been restarted
    if (!processRestarted) {
      // setup the bi-directional relationship between Device(User)/Socket(window)
      setupDeviceSocketRelationship(device, socket);

      // warn user if this connection results in multiple IDE apps for a given device/user
      // ... NOTE: At first glance you may think this check is needed on sign-in
      //           since it propagates identity change to other windows of a browser instance (see: broadcastUserAuthChanged)
      //           HOWEVER, this is NOT correct - these windows had already been using multiple IDE apps (sign-in didn't change that)
      const sockets      = await getSocketsInDevice(device);
      const numOfIDEs    = sockets.reduce((count, sock) => count + (sock.data.clientType === 'ide' ? 1 : 0), 0);
      const warnMultiIDE = socket.data.clientType === 'ide' && numOfIDEs > 1;

      // communicate the pre-authentication to this client (socket)
      const userState = extractUserState(user);
      userMsg = userMsg || `Welcome ${user.getUserName()}`; // ... default userMsg if not explicitly set
      if (warnMultiIDE) {
        userMsg += '  ... WARNING: it is NOT recommended to run multiple IDEs for a given account (NO synchronization occurs between model changes in multiple IDEs.';
      }
      sendPreAuthentication(socket, userState, userMsg);

      // log all devices AFTER setup is complete
      logAllDevices(`All Devices AFTER preAuthenticate() of socket: ${socket.id}, device: ${socket.data.deviceId}:`, log);
    }
  }
}


/********************************************************************************
 * Clear the structures established by preAuthenticate() 
 * WHEN client socket connection is lost.
 *
 * Clearing the following (as needed):
 *   - User object
 *   - Device object
 *   - bi-directional relationship between Device(User)/Socket(window)
 *      Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
 *        ... see notes at the top of this module!
 *********************************************************************************/
export async function clearAuthenticate(socket) {
  const log = logger(`${logPrefix}:clearAuthenticate`);

  // NOTE: this is the corollary to setupDeviceSocketRelationship()

  // NOTE: even though disconnected, this socket still retains the data we setup on it's connection
  //       ... socket.data.deviceId
  //       ... THIS IS GREAT, as it is needed to do our clean up

  // NOTE: socket.io infrastructure dynamically reflects the room association when the socket is disconnected

  // THEREFORE: the only thing left for us to do is:
  //            remove the associated device when it no longer has any socket/window association
  const sockets = await getSocketsInDevice(socket);  
  if (sockets.length === 0) {
    removeDevice(socket);
  }

  // that's all folks
  logAllDevices(`All Devices AFTER clearAuthenticate() ... disconnect of socket: ${socket.id}, device: ${socket.data.deviceId}:`, log)
}


/********************************************************************************
 * setup the bi-directional relationship between Device(User)/Socket(window)
 *
 *   Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
 *     ... see notes at the top of this module!
 *
 * RETURN: void
 *********************************************************************************/
function setupDeviceSocketRelationship(device, socket) {
  // utilize socket.io room to collect all socket/window of this device
  // ... NOTE: socket.io infrastructure dynamically updates this collection on socket disconnect
  socket.join( deviceRoom(device.deviceId) );

  // define the back-reference from the socket/window TO device
  socket.data.deviceId = device.deviceId;
}


/********************************************************************************
 * Obtain the unique deviceId from our client.  A device technically
 * identifies a browser instance.  In other words the same deviceId is
 * expected for multiple windows within the same browser instance
 * (e.g. chrome, edge, safari, etc.)
 *
 * RETURN: deviceId (via promise)
 *
 * THROW: Error: an unexpected error from client, or NO response (timeout)
 *********************************************************************************/
function getDeviceIdFromClient(socket) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'get-device-id' request to our client
    // ... we use a timeout, so our client CANNOT lock-up the entire process
    const event = 'get-device-id';
    socket.timeout(2000).emit(event, socketAckFn_timeout(resolve, reject, `process client event: '${event}'`));
  });
}


/********************************************************************************
 * Reset the unique deviceId on our client.  A device technically
 * identifies a browser instance.  In other words the same deviceId is
 * expected for multiple windows within the same browser instance
 * (e.g. chrome, edge, safari, etc.)
 *
 * RETURN: deviceId (via promise) ... the newly reset id
 *
 * THROW: Error: an unexpected error from client, or NO response (timeout)
 *********************************************************************************/
function resetDeviceIdFromClient(socket) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'reset-device-id' request to our client
    // ... we use a timeout, so our client CANNOT lock-up the entire process
    const event = 'reset-device-id';
    socket.timeout(2000).emit(event, socketAckFn_timeout(resolve, reject, `process client event: '${event}'`));
  });
}


/********************************************************************************
 * Obtain the auth token from our client (if any).
 *
 * RETURN: token (undefined for none)
 *
 * THROW: Error: an unexpected error from client, or NO response (timeout)
 *********************************************************************************/
function getAuthTokenFromClient(socket) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'get-auth-token' request to our client
    // ... we use a timeout, so our client CANNOT lock-up the entire process
    const event = 'get-auth-token';
    socket.timeout(2000).emit(event, socketAckFn_timeout(resolve, reject, `process client event: '${event}'`));
  });
}


/********************************************************************************
 * Set a temporary entry on the client (defined by the supplied socket).
 *
 * A temporary entry is retained on the client for only a short period of time.
 * ... the client will clear it after a short time
 *
 * Because the client implementation uses localStorage, this can be
 * used (in conjunction with getTempEntryFromClient()) as a definitive
 * determination of whether multiple client sockets are from the same
 * browser instance!
 *
 * RETURN: void (via promise)
 *
 * THROW: Error: (via promise) an unexpected error from client, or NO response (timeout)
 *********************************************************************************/
function setTempEntryOnClient(socket, key, val) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'set-temp-entry' request to our client
    // ... we use a timeout, so our client CANNOT lock-up the entire process
    const event = 'set-temp-entry';
    socket.timeout(2000).emit(event, key, val, socketAckFn_timeout(resolve, reject, `process client event: '${event}'`));
  });
}

/********************************************************************************
 * Get a temporary entry on the client (defined by the supplied socket).
 *
 * SEE: setTempEntryOnClient() docs
 *
 * RETURN: string (via promise)
 *
 * THROW: Error: (via promise) an unexpected error from client, or NO response (timeout)
 *********************************************************************************/
function getTempEntryFromClient(socket, key) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'get-temp-entry' request to our client
    // ... we use a timeout, so our client CANNOT lock-up the entire process
    const event = 'get-temp-entry';
    socket.timeout(2000).emit(event, key, socketAckFn_timeout(resolve, reject, `process client event: '${event}'`));
  });
}
