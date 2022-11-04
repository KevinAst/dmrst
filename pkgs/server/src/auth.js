//***
//*** auth.js ... authentication module (and maintainer of user objects)
//***

/**
 * This module (auth.js) manages user authentication,
 * creating and retaining all active users.
 *
 * This module manages:
 *   - User objects
 *   - Device objects
 *   - bi-directional relationship between Device(User)/Socket(window)
 *
 *      Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceIdFull
 *
 *      * the relationship FROM Device TO Socket is maintained by a "room" (part of socket.io)
 *        - this means the dynamics of socket disconnects, is automatically maintained by socket.io
 *        - the sockets in the group represent the browser window of a given user
 *          * visualize-it automatically syncs user identity changes to all these windows
 *          * this grouping has a similar scope to that of the browser localStorage
 *
 *      * socket.data: ... contains a number of useful items
 *         - deviceIdFull:   the key to access the Device object (a back reference of our bi-directional relationship)
 *         - deviceId:       the browser's logical device identifier (a virtual MAC so-to-speak) ...... part of deviceIdFull
 *         - clientAccessIP: the internet access point for this client (think of as router/WiFi IP) ... part of deviceIdFull
 *         - clientType:     'ide'/'sys'
 *         - userAgent:      identifies the specific browser in use
 *
 * Of Interest is our PUBLIC API:
 *   + getDevice(deviceIdFull|device|socket|socketId):   Device
 *   + getUser(deviceIdFull|device|socket|socketId):     User (same as: device.user)
 *   + getUserName(deviceIdFull|device|socket|socketId): string
 */

import sendGridMail          from '@sendgrid/mail';
import {socketAckFn_timeout} from './core/util/socketIOUtils';
import {prettyPrint}         from './util/prettyPrint';
import {msgClient}           from './chat';
import randomNumber          from 'random-number-csprng';
import storage               from 'node-persist'; // AI: temp lib used to persist PriorAuthDB TILL we hook into DB
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

    // acknowledge success
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

    // validate request params
    if (!email) {
      return userErr('email must be supplied');
    }
    if (!validEmail(email)) {
      return userErr('Email is invalid');
    }

    // generate and send email to user with verification code
    try {
      await generateEmailVerificationCode(socket, email);
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

    // acknowledge success (i.e. a verification code has been emailed)
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

    // limit the number of verification attempts to 10
    socket.data.verification.attempts++;
    if (socket.data.verification.attempts > 10) {
      clearSignInVerification(socket);
      return userErr(`you have exceeded the maximum number of verification attempts ... please cancel and sign-in again`);
    }

    // VERY TEMP DEV PROCESS that reveals the code
    // AI: IMPORTANT: ?? REMOVE THIS
    if (verificationCode === 'showme') {
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
    logAllDevices(`All Devices AFTER 'sign-in-verification' of socket: ${socket.id}, device: ${socket.data.deviceIdFull}:`, log);

    // acknowledge success
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

    // acknowledge success (i.e. a verification code has been emailed)
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
    logAllDevices(`All Devices AFTER 'sign-out' of socket: ${socket.id}, device: ${socket.data.deviceIdFull}:`, log);

    // acknowledge success
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
//   value: [deviceIdFull, ...] <<< all devices previously authenticated on

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
  const deviceIdFull = encodeDeviceIdFull(deviceId, clientAccessIP);
  const allDevices   = await storage.getItem(email) || [];
  return allDevices.includes(deviceIdFull);
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
  const deviceIdFull = encodeDeviceIdFull(deviceId, clientAccessIP);
  const allDevices   = await storage.getItem(email) || [];

  // add if not already there
  if (!allDevices.includes(deviceIdFull)) {
    await storage.setItem(email, [...allDevices, deviceIdFull]);
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
//* Generate a verification code for the supplied email,
//* retaining authentication info in the supplied socket.
//* RETURN: void (promise)
//* ERROR:  via (promise) - unsuccessful operation (to be handled by invoker)
//*---------------------------------------------------------
async function generateEmailVerificationCode(socket, email) {

  // generate verification code
  // ... see: https://blog.logrocket.com/building-random-number-generator-javascript-nodejs/
  //          Generate Cryptographically Secure Pseudo-Random Numbers
  //          https://www.npmjs.com/package/random-number-csprng
  //          $ npm install --save random-number-csprng
  const verificationCode = await randomNumber(100000, 999999) + '' /* convert to string for easy comparison */;
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

  // no-op when sign-in period has NOT expired
  // ... technically, the client should NOT allow this (just for good measure)
  if (!socket.data.verification) {
    return;
  }

  // email verification code to the email defined in the supplied socket
  // ... define our message to be email
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
  //     ANY ERROR should be handled by our invoker
  // await sendGridMail.send(emailContent); // AI: IMPORTANT: ?? activate this ... for now just rely on "showme" to minimize email traffic in DEV
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
//* RETURN: void
//*---------------------------------------------------------
function encodeUserToken(user) {
  const token = user.email + tokenDelim + user.guestName;
  // AI: encrypt
  return token;
}

//*---------------------------------------------------------
//* Extract contents of the supplied encrypted user token
//* ... provided by our client
//* ... and used in our preAuthenticate process
//* RETURN: {email, guestName}
//*---------------------------------------------------------
function decodeUserToken(token) {
  // AI: decrypt token
  const [email, guestName] = token.split(tokenDelim);
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
//* return the user associate to the supplied deviceIdFull|device|socket|socketId (one in the same).
//* PARM:   ref: deviceIdFull | Device | socket
//* RETURN: User ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getUser(ref) {
  return getDevice(ref)?.user;
}


//*-------------------------------------------------
//* return the user name associate to the supplied deviceIdFull|device|socket|socketId (one in the same).
//* PARM:   ref: deviceIdFull | Device | socket
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
                                                   // ... deviceIdFull|device|socket|socketId (one in the same)
                                  userState,       // the current user state to broadcast
                                  excludeSocket) { // an optional initiating socket to be excluded from this broadcast
                                                   // ... CONTEXT: the initiating socket has already communicated/handled this change (typically via return semantics)
  const device       = getDevice(deviceRef);
  const deviceIdFull = device.deviceIdFull;
  const deviceRm     = deviceRoom(deviceIdFull);

  // broadcast the 'user-auth-changed' event to all clients of the supplied device
  log(`broadcastUserAuthChanged() ... broadcast 'user-auth-changed' event - deviceIdFull: '${deviceIdFull}', userState: `, userState);
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
// ??$$ currently NEVER used with token ... this may change if/when used by other processes ... if so, we should rename sendPreAuthentication() ... if NOT, we should remove token (and client processing)
function sendPreAuthentication(socket,     // the initiating socket
                               userState,  // the current data for user object
                               token) {    // the token to reset on the client (only when supplied)
  // emit the 'pre-authentication' event to the supplied client (socket)
  log(`sendPreAuthentication() ... emit 'pre-authentication' event - socket: '${socket.id}', userState: `, userState);
  socket.emit('pre-authentication', userState, token);
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

  // normalize '::1' to '127.0.0.1' (localhost)
  // ... '::1' is the loopback address in ipv6
  //     equivalent to 127.0.0.1 in ipv4
  //     see: https://en.wikipedia.org/wiki/Localhost
  if (clientAccessIP === '::1') {
    clientAccessIP = '127.0.0.1';
  }

  return clientAccessIP;
}


const deviceIdDelim = '@/@';

//*---------------------------------------------------------
//* Generate the deviceIdFull from the supplied deviceId/clientAccessIP
//* RETURN: void
//*---------------------------------------------------------
function encodeDeviceIdFull(deviceId, clientAccessIP) {
  return deviceId + deviceIdDelim + clientAccessIP;
}


//******************************************************************************
//******************************************************************************
//* Device related code
//******************************************************************************
//******************************************************************************

// all active devices
//   a Map:
//   deviceIdFull<key>: Device<value>           Room('device-{deviceIdFull}') ---1:M--< socket
//                       - deviceIdFull<string> primary key
//                       - deviceId<string>       ... strictly convenience (part of deviceIdFull)
//                       - clientAccessIP<string> ... strictly convenience (part of deviceIdFull)
//                       - user<Device>
const devices = new Map();

// diagnostic logging utility
async function logAllDevices(msg='ALL DEVICES', myLog=log) {
  if (myLog.enabled) {
    const allDevices = Array.from(devices.values());
    const allEntries = [
      // { 
      //   device,
      //   socketIds,
      // }
      // ...
    ];
    for (const device of allDevices) {
      const entry = {device};
      const sockets   = await getSocketsInDevice(device);
      entry.socketIds = sockets.map(socket => socket.id);
      allEntries.push(entry);
    }
    myLog(`${msg} ... total: ${allDevices.length} ... `, prettyPrint(allEntries));
  }
}

//*-------------------------------------------------
//* return the device associate to the supplied deviceIdFull|device|socket|socketId (one in the same).
//* PARM:   ref: deviceIdFull | Device | socket
//* RETURN: Device ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getDevice(ref) {
  const deviceIdFull = ref?.data?.deviceIdFull /*socket*/ || ref?.deviceIdFull /*device*/ || ref /*deviceIdFull*/;
  let   device = devices.get(deviceIdFull);
  if (!device) { // as a last resort, interpret ref as a socketId
    const socket = io.sockets.sockets.get(ref);
    device = devices.get(socket?.data?.deviceIdFull);
  }
  return device;
}

//*-------------------------------------------------
//* create/catalog new device object using supplied parameters
//* RETURN: Device ... newly created
//*-------------------------------------------------
function createDevice(deviceIdFull, deviceId, clientAccessIP, user) {
  const device = {
    deviceIdFull,   // primary key
    deviceId,       // ... strictly convenience (part of deviceIdFull)
    clientAccessIP, // ... strictly convenience (part of deviceIdFull)
    user};
  devices.set(deviceIdFull, device);
  return device;
}

//*-------------------------------------------------
//* remove the device associate to the supplied socket/device/deviceIdFull (one in the same).
//* PARM:   ref: deviceIdFull | Device | socket
//* RETURN: boolean ... true: removed, false: no-op (device NOT cataloged)
//*-------------------------------------------------
function removeDevice(ref) {
  const deviceIdFull = ref?.data?.deviceIdFull /*socket*/ || ref?.deviceIdFull /*device*/ || ref /*deviceIdFull*/;
  return devices.delete(deviceIdFull);
}

//*-------------------------------------------------
//* return all sockets associated to a given device.
//* PARM:   ref: deviceIdFull | Device | socket
//* RETURN: socket[] VIA promise
//*-------------------------------------------------
async function getSocketsInDevice(ref) {
  const deviceIdFull  = ref?.data?.deviceIdFull /*socket*/ || ref?.deviceIdFull /*device*/ || ref /*deviceIdFull*/;
  const deviceSockets = await io.in(deviceRoom(deviceIdFull)).fetchSockets(); // ... an array of sockets[]
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
  const oldRoom = deviceRoom(device.deviceIdFull);

  // reset the deviceId on our client
  // ... the client actually establishes/retains the new deviceId (a random string)
  const newDeviceId = await resetDeviceIdFromClient(socket);

  // un-catalog the device object (since it's key IS GOING TO change)
  devices.delete(device.deviceIdFull);

  // reflect the new deviceId in our device object
  device.deviceIdFull = encodeDeviceIdFull(newDeviceId, device.clientAccessIP);
  device.deviceId     = newDeviceId;

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
  devices.set(device.deviceIdFull, device);
}

//*-------------------------------------------------
//* return  the socket.io room, defining the Device TO Socket relationship
//* PARM:   deviceIdFull
//* RETURN: socket.io room <string>
//*-------------------------------------------------
const deviceRoom = (deviceIdFull) => `device-${deviceIdFull}`;


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
 *    Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceIdFull
 *      ... see notes at the top of this module!
 *
 * Once complete, the following PUBLIC API is available:
 *   + getDevice(deviceIdFull|device|socket|socketId):   Device
 *   + getUser(deviceIdFull|device|socket|socketId):     User (same as: device.user)
 *   + getUserName(deviceIdFull|device|socket|socketId): string
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
  //     ??## use this in analyses
  socket.data.clientType = socket.handshake.auth.clientType
  log(`using clientType (gleaned from client app): ${socket.data.clientType}`);
  // ... userAgent: browser identification (from socket header)
  //     EX: Chrome Browser:
  //         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
  //     ??## use this in analyses
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
  let clientAccessIP = '';        // the client IP (access point ... i.e. router)
  let deviceId       = undefined; // the client-managed logical deviceId (a persisted random num via localStorage)
  let deviceIdFull   = undefined; // device key (combining deviceId/clientAccessIP)
  let device         = undefined; // the device obj, containing user, and managing concurrent client sessions (i.e. sockets - alias to browser window)
  let user           = undefined; // contained in device

  // NOTE: the goal of this try/catch block is to fully define the working vars (above) - to be used in subsequent steps
  try { // ... try/catch preventing errors from crashing our server (some errors may be from our client)

    // TEST ERROR CONDITION: 
    // ... also try NOT responding on client 'get-device-id' event (see client/src/user.js)
    //     resulting in time-out error
    // if (1==1) throw new Error('Test error in preAuthenticate');

    // obtain the clientAccessIP associated to the supplied socket header
    clientAccessIP = gleanClientAccessIPFromHeader(socket);
    log(`using clientAccessIP (gleaned from socket header): ${clientAccessIP}`);

    // obtain the deviceId of this client
    deviceId = await getDeviceIdFromClient(socket);
    log(`using deviceId (gleaned from client app): ${deviceId}`);

    // define deviceIdFull (combination of deviceId/clientAccessIP)
    deviceIdFull = encodeDeviceIdFull(deviceId, clientAccessIP);

    // for a pre-existing device, the user is automatically accepted in this existing session
    // ... in other words, they are already running our app in a separate browser window,
    //     and we accept those credentials
    //     RISK: if hacker steals the deviceId (the token is irrelevant in this case)
    //           -AND- is on same clientAccessIP (i.e. an insider in a company, etc.)
    //           -AND- the real user is active (i.e. has an active Device object in-memory)
    //           -THEN- they are IN LIKE FLYNN (without any other checks)
    //           AI: analyzeNefariousActivity() can potentially detect this
    //               IF they have different userAgent (i.e. browser)
    //               BECAUSE: a different browser SHOULD NOT have the same deviceId
    //                        (it has been stolen)
    //               HOWEVER: if the hacker is running the same browser/version,
    //                        then this is NOT detectable
    //           ALSO NOTE: The hacker will be "ousted" when a sign-out occurs for this user
    //                      (typically the "real" user) BECAUSE 
    //                      - ALL sessions for that user will be signed-out
    //                      - and the deviceId will be reset (on the initiating client)
    //                      - and all persistent PriorAuthDB are cleared
    //                      > to get back in, the hacker would need to re-steal the deviceId
    device = getDevice(deviceIdFull);
    if (device) {
      log(`device ${deviceIdFull} pre-existed (re-used): `, prettyPrint({device}));
      user = device.user;
    }

    // CREATE a new user/device, on first-use (for a not-previously active user/device)
    // ... potentially pre-authenticated from saved client credentials (an auth token - if any)
    else {
      log(`device ${deviceIdFull} did NOT pre-exist (was not active) ... creating a new one`);

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
        let userMsg     = '';

        // when this token represents a signed-in user, having a user account (i.e. email)
        if (emailFromToken) {
          // only accept signed-in users when the account has been previously authenticated on given deviceId/clientAccessIP
          // NOTE: This will THWART "most" nefarious hackers (where deviceId/token are stolen through various techniques)
          //       BECAUSE they are automatically granted access when they are in a different location.
          // RISK: if hacker steals BOTH the deviceId/token
          //       -AND- is on same clientAccessIP (i.e. an insider in a company, etc.)
          //       -THEN- they are IN LIKE FLYNN (without any other checks)
          //       AI: analyzeNefariousActivity() NOT sure this is detectable
          //           NOT CORRECT: other than concurrent user in different locations (either they shared their email or a hacker)
          //       ALSO NOTE: The hacker will be "ousted" when a sign-out occurs for this user
          //                  (typically the "real" user) BECAUSE 
          //                  - ALL sessions for that user will be signed-out
          //                  - and the deviceId will be reset (on the initiating client)
          //                  - and all persistent PriorAuthDB are cleared
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

        // communicate to user (when needed)
        if (userMsg) {
          msgClient(socket, userMsg);
        }

        // log what just happened
        log(logMsg, {
          socket: socket.id,
          clientAccessIP,
          deviceId,
          deviceIdFull,
          token: {
            email:     emailFromToken, 
            guestName: guestNameFromToken,
          },
        });

      } // ... end of token processing ... for NO token we use the unregistered guest user

      // NOW: finish the setup of the newly created user

      // re-populate all other user state (via user profile / enablements)
      populateUserProfile(user);

      // create our new device (containing our newly created user)
      device = createDevice(deviceIdFull, deviceId, clientAccessIP, user);

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
    deviceId     = 'SOCKET-FROM-ERROR-' + socket.id; // ... use socket.id (very temporary ... it's all we have)
    deviceIdFull = encodeDeviceIdFull(deviceId, clientAccessIP);
    user         = createUser(); // ... defaults to: unregistered guest user
    device       = createDevice(deviceIdFull, deviceId, clientAccessIP, user);

    // notify user of problem
    const usrMsg = 'A problem occurred in our pre-authentication process (see logs).  ' +
                   'For the moment, you may continue as a "Guest" user.  ' +
                   'Try to reconnect at a later point by refreshing your browser.  ' +
                   'If this problem persists, reach out to our support staff.';
    msgClient(socket, usrMsg, errMsg);
  }

  finally { // ... finish up setting up our critical structures (common to BOTH non-error and error block)

    // AI: consider error conditions in this code

    // setup the bi-directional relationship between Device(User)/Socket(window)
    setupDeviceSocketRelationship(device, socket);

    // communicate the pre-authentication to this client (socket)
    const userState = extractUserState(user);
    sendPreAuthentication(socket, userState); // ... NO token is supplied, so it is NOT updated on client

    // log all devices AFTER setup is complete
    logAllDevices(`All Devices AFTER preAuthenticate() of socket: ${socket.id}, device: ${socket.data.deviceIdFull}:`, log);
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
 *      Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceIdFull
 *        ... see notes at the top of this module!
 *********************************************************************************/
export async function clearAuthenticate(socket) {
  const log = logger(`${logPrefix}:clearAuthenticate`);

  // NOTE: this is the corollary to setupDeviceSocketRelationship()

  // NOTE: even though disconnected, this socket still retains the data we setup on it's connection
  //       ... socket.data.deviceIdFull
  //       ... THIS IS GREAT, as it is needed to do our clean up

  // NOTE: socket.io infrastructure dynamically reflects the room association when the socket is disconnected

  // THEREFORE: the only thing left for us to do is:
  //            remove the associated device when it no longer has any socket/window association
  const sockets = await getSocketsInDevice(socket);  
  if (sockets.length === 0) {
    removeDevice(socket);
  }

  // that's all folks
  logAllDevices(`All Devices AFTER clearAuthenticate() ... disconnect of socket: ${socket.id}, device: ${socket.data.deviceIdFull}:`, log)
}


/********************************************************************************
 * setup the bi-directional relationship between Device(User)/Socket(window)
 *
 *   Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceIdFull
 *     ... see notes at the top of this module!
 *
 * RETURN: void
 *********************************************************************************/
function setupDeviceSocketRelationship(device, socket) {
  // utilize socket.io room to collect all socket/window of this device
  // ... NOTE: socket.io infrastructure dynamically updates this collection on socket disconnect
  socket.join( deviceRoom(device.deviceIdFull) );

  // define the back-reference from the socket/window TO device
  socket.data.deviceIdFull   = device.deviceIdFull;
  // ... strictly convenience (part of deviceIdFull)
  socket.data.deviceId       = device.deviceId;
  socket.data.clientAccessIP = device.clientAccessIP;
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
