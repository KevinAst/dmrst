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
 *      Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceIdFull
 */

import sendGridMail          from '@sendgrid/mail';
import {socketAckFn_timeout} from './core/util/socketIOUtils';
import {prettyPrint}         from './util/prettyPrint';
import {msgClient}           from './chat';
import randomNumber          from 'random-number-csprng';
import logger from './core/util/logger';
const  logPrefix = 'vit:server:auth';
const  log = logger(`${logPrefix}`);

// the socket.io server in control
let io = null;

// register our SendGrid API key to the service object
// ??$$$ NEW:
log.f(`????????????? EMAIL_API_KEY: ${process.env.EMAIL_API_KEY}`);
//? sendGridMail.setApiKey(process.env.EMAIL_API_KEY);


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

    // re-populate all other user state (via user profile / enablements)
    populateUserProfile(user);

    // broadcast the latest userState to all clients of this device
    // ... this will change the user/authentication for ALL apps running on this device (all app windows of this browser instance)
    const userState = extractUserState(user);
    broadcastUserAuthChanged(socket, userState);

    // generate the token to be sent to our client
    const token = encodeUserToken(user, socket.data.deviceId);

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

    // send email to user with verification code
    try {
      await sendEmailVerificationCode(socket, email);
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
  socket.on('sign-in-verification', (verificationCode, ack) => {
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
    // ?? IMPORTANT: REMOVE THIS
    if (verificationCode === 'showme') {
      return userErr(`try: ${socket.data.verification.code}`);
    }

    // verify the correct code has been supplied
    if (verificationCode !== socket.data.verification.code) {
      return userErr(`invalid Verification Code`);
    }

    // KEY: user sign-in successful - NOW update our server state

    // obtain the user associated to this socket -AND- update it's key aspects
    // ... NOTE: our basic socket/device/user structure is pre-established via preAuthenticate()
    // ... NOTE: we mutate this object :-)
    const user = getUser(socket);
    user.email = socket.data.verification.email;

    // clear the verification info found in our socket
    clearSignInVerification(socket);

    // re-populate all other user state (via user profile / enablements)
    populateUserProfile(user);

    // broadcast the latest userState to all clients of this device
    // ... this will change the user/authentication for ALL apps running on this device (all app windows of this browser instance)
    const userState = extractUserState(user);
    broadcastUserAuthChanged(socket, userState);

    // generate the token to be sent to our client
    const token = encodeUserToken(user, socket.data.deviceId);

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
  //* handle sign-out request (a request/response API)
  //* NOTE: We sign-out the user associated to THIS socket
  //* RETURN: (via ack):
  //*           {
  //*             userState, // to update client user object
  //*             token,     // to be retained on client (for preAuthenticate)
  //*           }
  //* THROW:  Error (via ack) with optional e.userMsg (when e.isExpected()) for expected user error (ex: User NOT signed-in)
  //*---------------------------------------------------------------------------
  socket.on('sign-out', (ack) => {
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
    if (!user.isSignedIn()) {
      return userErr(`Cannot sign-out user ${user.getUserName()}, USER IS NOT signed-in.`);
    }

    // KEY: user sign-out successful - update our server state
    user.email = '';

    // re-populate all other user state (via user profile / enablements)
    populateUserProfile(user);

    // broadcast the latest userState to all clients of this device
    // ... this will change the user/authentication for ALL apps running on this device (all app windows of this browser instance)
    const userState = extractUserState(user);
    broadcastUserAuthChanged(socket, userState);

    // generate the token to be sent to our client
    const token = encodeUserToken(user, socket.data.deviceId);

    // acknowledge success
    // ... for the initiating socket, this is how it is update
    //     >>> it knows to update localStorage too
    // ... for other clients of this device, they are updated via the broadcast event (above)
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

//*---------------------------------------------------------
//* Has supplied email been previously authenticated on the
//* supplied clientAccessIP (per our persistent user-DB registry)?
//* RETURN: boolean
//*---------------------------------------------------------
function isEmailAuthenticatedOnIP(email, clientAccessIP) {
  // AI: ULTIMATELY, implement via a DB operation
  // AI: ?? 444 TEMPORARILY hard-code, for initial testing, consider implementing in localStorage
  return true;
}

// AI: ?? 444 must implement API to maintain: email/clientAccessIPs


let registeredEmailKey = false; // ??$$$ CLEANUP: TRASH

//*---------------------------------------------------------
//* Generate and send verification code to the supplied email,
//* retaining authentication info in the supplied socket.
//* RETURN: void (promise)
//* ERROR:  via (promise) - unsuccessful operation (to be handled by invoker)
//*---------------------------------------------------------
async function sendEmailVerificationCode(socket, email) {

  // generate verification code
  // ... see: https://blog.logrocket.com/building-random-number-generator-javascript-nodejs/
  //          Generate Cryptographically Secure Pseudo-Random Numbers
  //          https://www.npmjs.com/package/random-number-csprng
  //          $ npm install --save random-number-csprng
  const verificationCode = await randomNumber(100000, 999999) + '' /* convert to string for easy comparison */;
  // log(`verificationCode: ${verificationCode}`); // NO NO: info is too sensitive

  // email verification code to the supplied email address
  // ... register our API key to the service object  // ??$$$ CLEANUP: TRASH
  //     done one time only
  //     done late (here) to insure our process.env has been resolved
  if (!registeredEmailKey) {
    sendGridMail.setApiKey(process.env.EMAIL_API_KEY);
    registeredEmailKey = true;
  }
  // ... define our message to be email
  const emailContent = {
    to:      email,
    from:    'kevin@appliedsofttech.com', // AI: use the email address or domain you verified with SendGrid
    subject: 'Verification Code from visualize-it',
    text:    `You have requested to access a visualize-it account through this email address\n\n` +
             `To complete this process, enter the code below in your visualize-it verification screen:\n\n ${verificationCode}\n\n` +
             `This code will expire after 10 minutes.\n\n` +
             `Didn't request this code from visualize-it?  Someone may be attempting to use your email address as an account identifier.\n\n` +
             `This is a system generated email. Replies will not be read or forwarded for handling.`,
  };
  // ... send the email
  //     ANY ERROR should be handled by our invoker
  //? await sendGridMail.send(emailContent); // ?? AI: activate this ... for now just rely on "showme" to minimize email traffic in DEV

  // expire verification code in 5 mins
  const timeout = 1 * 60 * 1000; // ?? change this to 5 mins
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
//* Generate an encrypted user token from the supplied user/deviceId
//* ... suitable to be retained on the client
//* ... and used in our preAuthenticate process
//* RETURN: void
//*---------------------------------------------------------
function encodeUserToken(user, deviceId) {
  const token = user.email + tokenDelim + user.guestName + tokenDelim + deviceId;
  // AI: encrypt
  return token;
}

//*---------------------------------------------------------
//* Extract contents of the supplied encrypted user token
//* ... provided by our client
//* ... and used in our preAuthenticate process
//* RETURN: {email, guestName, deviceId}
//*---------------------------------------------------------
function decodeUserToken(token) {
  // AI: decrypt token
  const [email, guestName, deviceId] = token.split(tokenDelim);
  return {email, guestName, deviceId};
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
//* return the user associate to the supplied socket/device/deviceIdFull (one in the same).
//* PARM:   ref: deviceIdFull | Device | socket
//* RETURN: User ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getUser(ref) {
  return getDevice(ref)?.user;
}


//*-------------------------------------------------
//* return the user name associate to the supplied socket/device/deviceIdFull (one in the same).
//* PARM:   ref: deviceIdFull | Device | socket
//* RETURN: userName ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getUserName(ref) {
  return getUser(ref)?.getUserName();
}


//*-------------------------------------------------
//* broadcast user authorization changes to all clients of a device
//* ... initiated BY server TO client
//* ... this will change the user/authentication for ALL apps running on this device
//*     (all windows of this browser instance)
//* ... because this is a "broadcast" event
//*     NO response is possible, therefore we DO NOT wrap this in a promise
//* ... this is a convenience function wrapping the socket protocol
//* RETURN: void
//*-------------------------------------------------
function broadcastUserAuthChanged(socket,      // the initiating socket (identifying deviceIdFull)
                                  userState) { // the current user state
  // broadcast the 'user-auth-changed' event to all clients of the supplied device (via socket)
  const deviceIdFull = socket.data.deviceIdFull;
  log(`broadcastUserAuthChanged() ... broadcast 'user-auth-changed' event - deviceIdFull: '${deviceIdFull}', userState: `, userState);
  // TO ALL room members (using the server)
//io.in(deviceRoom(deviceIdFull)).emit('user-auth-changed', userState);
  // TO ALL room members MINUS socket (using the socket)
  socket.to(deviceRoom(deviceIdFull)).emit('user-auth-changed', userState);
}


//*-------------------------------------------------
//* send pre-authentication to the supplied client (socket)
//* ... initiated BY server TO client
//* ... this is an push event only - NO response is supported
//* RETURN: void
//*-------------------------------------------------
function sendPreAuthentication(socket,     // the initiating socket
                               userState,  // the current data for user object
                               token) {    // the token to reset on the client (only when supplied)
  // emit the 'pre-authentication' event to the supplied client (socket)
  log(`sendPreAuthentication() ... emit 'pre-authentication' event - socket: '${socket.id}', userState: `, userState);
  socket.emit('pre-authentication', userState, token);
}


//******************************************************************************
//******************************************************************************
//* clientAccessIP related code
//******************************************************************************
//******************************************************************************


//*-------------------------------------------------
//* Return the clientAccessIP associated to the supplied socket.
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
function fetchClientAccessIP(socket) {
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
//* return the device associate to the supplied socket/device/deviceIdFull (one in the same).
//* PARM:   ref: deviceIdFull | Device | socket
//* RETURN: Device ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getDevice(ref) {
  const deviceIdFull = ref?.data?.deviceIdFull /*socket*/ || ref?.deviceIdFull /*device*/ || ref /*deviceIdFull*/;
  return devices.get(deviceIdFull);
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
  const deviceIdFull = ref?.data?.deviceIdFull /*socket*/ || ref?.deviceIdFull /*device*/ || ref /*deviceIdFull*/;
  const deviceSockets = await io.in(deviceRoom(deviceIdFull)).fetchSockets(); // ... an array of sockets[]
  return deviceSockets;
}

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
 * The following structure established by this function at the initialization
 * of the socket connection:
 * - Device object is established, either newly created or existing reference.
 * - socket.data.deviceIdFull back reference
 * - bi-directional relationship between Device(User)/Socket(window)
 *    Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceIdFull
 *
 * Once complete, the following API is available:
 *   + getDevice(deviceIdFull|Device|socket):   Device
 *   + getUser(deviceIdFull|Device|socket):     User (same as: device.user)
 *   + getUserName(deviceIdFull|Device|socket): string
 *********************************************************************************/
export async function preAuthenticate(socket) {

  // retain our socket.io server
  // ... this is a duplicate of registerAuthHandlers() ... above
  //     BECAUSE preAuthenticate( is invoked EVEN prior to registerAuthHandlers()
  if (!io) { // ... do the first time only (all subsequent sockets would be duplicate
    io = socket.server;
  }

  // NOTE: For this process we do NOT use socket.io's standard
  //       auth.token (supplied at client socket creation time).
  //       Rather we prefer an interactive server-2-client handshake
  //       for our initialization protocol.  The reason for this is
  //       - Our client socket is long-lived.  It is created at the
  //         client app startup, and can span multiple users (via
  //         sign-out/sign-in).
  //       - Because of this, we need the dynamics of a run-time API
  //         (from server to the client) that can accommodate changes
  //         in user identity, and even changes in the deviceId (done
  //         to thwart malicious activity).
  //       - This is why we cannot utilize socket.io's standard
  //         auth.token.  It is too static (not able to accommodate
  //         these dynamics).
  // AI:    This philosophy may NO LONGER be true.
  //        Seems like we are moving to have NO dynamics in the deviceId.
  //        ANALYZE THIS FURTHER:
  //         - possibly go back to socket.io's auth.token
  //           and NIX the client interaction
  //         - BE CAREFUL ... study all aspects before you do this

  const log = logger(`${logPrefix}:preAuthenticate`);

  // working vars scoped outside of try/catch block for error processing recovery
  let clientAccessIP = '';        // the client IP (access point ... i.e. router)
  let deviceId       = undefined; // the client-managed logical deviceId (a persisted random num via localStorage)
  let deviceIdFull   = undefined; // device key (combining deviceId/clientAccessIP)
  let device         = undefined; // the device obj, containing user, and managing concurrent client sessions (i.e. sockets - alias to browser window)
  let user           = undefined; // contained in device

  try { // ... try/catch prevents client errors from crashing our server

    // TEST ERROR CONDITION: 
    // ... also try NOT responding on client 'get-device-id' event (see client/src/user.js)
    //     resulting in time-out error
    // if (1==1) throw new Error('Test error in preAuthenticate');

    // obtain the clientAccessIP associated to the supplied socket.
    clientAccessIP = fetchClientAccessIP(socket);
    log(`clientAccessIP from client socket(${socket.id}): ${clientAccessIP}`);

    // obtain the deviceId of this client
    deviceId = await getDeviceIdFromClient(socket);
    log(`deviceId from client socket(${socket.id}): ${deviceId}`);

    // define deviceIdFull (combination of deviceId/clientAccessIP)
    deviceIdFull = encodeDeviceIdFull(deviceId, clientAccessIP);

    // for a pre-existing device, the user is automatically accepted from their existing session
    // ... in other words, they are already running our app in a separate browser window,
    //     and we accept those credentials
    device = getDevice(deviceIdFull);
    if (device) {
      log(`device ${deviceIdFull} pre-existed (re-used): `, prettyPrint({device}));
      user = device.user;
    }

    // on first-use of this device/user (i.e. a non-existent/not-active device)
    // ... we define a new device/user authenticated from optional saved client credentials
    else {
      log(`device ${deviceIdFull} did NOT pre-exist (was not active) ... creating a new one`);

      // AI: ??222 CONSIDER NIXING any reset of the deviceId, ALONG with the reset function (here, and the client's implementation)
      // request the deviceId to be reset
      // ... this minimizes malicious attempts to re-use a deviceId
      //     when they have access to the browser's localStorage
      //     (where deviceId is stored)
      //? deviceId = await resetDeviceIdOnClient(socket);

      // create our new user
      // ... defaults to: unregistered guest user
      user = createUser();

      // attempt to authenticate from saved client credentials ... if any (i.e. an auth token)
      // AI: ??111 I think I want to NIX deviceIdFromToken - ONLY used in commented out code (below)
      const token = await getAuthTokenFromClient(socket); // email/guestName/deviceId
      if (token) {
        const {email: emailFromToken, guestName: guestNameFromToken, deviceId: deviceIdFromToken} = decodeUserToken(token);
        log(`client token: `, {email: emailFromToken, guestName: guestNameFromToken, deviceId: deviceIdFromToken});

        // AI: ??111 I think I want to NIX deviceIdFromToken
        //? //        it is a lame check ... if the user can access the localStorage token, they can just as easily access the localStorage deviceId
        //? // if the deviceId matches, we accept the credentials of the token
        //? // ... otherwise we ignore the token and start out as a Guest user
        //? // >>> KEY: This is a "minimal" protection against any
        //? //          malicious attempt to steal the token if a hacker
        //? //          had access to it in some way.  The deviceId should
        //? //          always match (for a given browser instance).
        //? if (deviceIdFromToken === deviceId) { // AI: or priorDeviceId (when reset - above) ... may be NIXed
        //?   log(`client token deviceId matched (accepting credentials): `, {deviceIdFromToken, deviceId});
        //?   user.email     = emailFromToken;
        //?   user.guestName = guestNameFromToken;
        //? }

        // we conditionally accept the token credentials
        // ... see comments (below)
        let acceptToken = false;
        // ?? 555 regarding SUSPECT HACKER ... this could simply be moving laptop from one router to another ... may be too harsh
        // ?? another reason to NOT change the token from preAuth
        // ?? 666 consider sending message to user as to what happened in preAuth
        let logMsg      = `auth token "NOT" ACCEPTED for signed-in user (email: ${emailFromToken}), because they were NEVER previously authenticated on clientAccessIP: ${clientAccessIP} ... SUSPECT HACKER stole deviceId/token`;
        let logIt       = log.force;
        // when this token represents a signed-in user ... having a user account aspect (i.e. email)
        if (emailFromToken) {
          // only accept signed-in users when the account has been previously authenticated on this clientAccessIP
          // ... this will THWART "most" nefarious hackers (where deviceId/token are stolen through various techniques)
          //     ... the only case NOT caught here, is where the nefarious hacker is on the same WiFi access point (e.g. router)
          //         which means it's an "inside job"
          if (isEmailAuthenticatedOnIP(emailFromToken, clientAccessIP)) {
            acceptToken = true;
            logMsg      = `auth token ACCEPTED for signed-in user (email: ${emailFromToken}), because of prior authentication on clientAccessIP: ${clientAccessIP}`;
            logIt       = log; // un-forced
          }
        }
        // unconditionally accept any token for signed-out users
        // ... it contains nothing sensitive (only guestName)
        else {
          acceptToken = true;
          logMsg      = `auth token ACCEPTED for signed-out user (no sensitive data here ... only guestName: ${guestNameFromToken})`;
          logIt       = log; // un-forced
        }

        // THIS IS IT: conditionally pull the trigger on token acceptance
        if (acceptToken) {
          user.email     = emailFromToken;
          user.guestName = guestNameFromToken;
        }
        // log what just happened
        logIt(logMsg, {
          socket: socket.id,
          clientAccessIP,
          deviceId,
          deviceIdFull,
          token: {
            email:     emailFromToken, 
            guestName: guestNameFromToken,
            deviceId:  deviceIdFromToken,
          },
        });
      } // ... end of token processing
        
      // re-populate all other user state (via user profile / enablements)
      populateUserProfile(user);

      // create our new device (with the contained user)
      device = createDevice(deviceIdFull, deviceId, clientAccessIP, user);
    }

    // setup the bi-directional relationship between Device(User)/Socket(window)
    setupDeviceSocketRelationship(device, socket);

    // generate the token to be sent to our client
    // ... we do this because our deviceId may have changed ?? even if changed, do we really want preAuth to reflect this
    // ??$$ 333 I'm thinking that NOW we do NOT change the token from preAuth ... can simply do this by NOT supplying token in sendPreAuthentication()
    const token = encodeUserToken(user, socket.data.deviceId);

    // communicate the pre-authentication to this client (socket)
    const userState = extractUserState(user);
    sendPreAuthentication(socket, userState, token);
  }

  // try/catch prevent errors from crashing our server (some errors are from our client)
  catch(e) {
    // log this error (on server) and notify user of problem
    const errMsg = `*** ERROR *** Unexpected error in preAuthenticate - socket: '${socket.id}' ... ERROR: ${e}`;
    const usrMsg = 'A problem occurred in our pre-authentication process (see logs).  ' +
                   'For the moment, you may continue as a "Guest" user.  ' +
                   'Try to reconnect or sign-in at a later point.  ' +
                   'If this problem persists, reach out to our support staff.';
    log.f(errMsg, e);
    msgClient(socket, usrMsg, errMsg);

    // INSURE our critical structure has been established
    // ... even on error conditions
    // ... at minimum a guest user
    // ... this structure is assumed throughout our code, and therefore critical
    // ... NOTE: this logic mimics that of a successful preAuthenticate (see above)

    // NO: With all the conditional logic (above) in establishing this structure, 
    //     it is thought to be MORE appropriate to strictly use a Guest user (from scratch),
    //     rather than a miss-mash of re-using existing device/user.
    //     ... it is confusing when (in the rare case) where multiple windows are signed-in
    //         and errors causes the re-use of device/user
    // 1. progressively use any content gleaned before error occurred
    // ... deviceId: use socket.id (very temporary it's all we have)
    // if (!deviceId) {
    //   deviceId = socket.id;
    // }
    // // ... user: use unregistered guest user
    // if (!user) {
    //   user = createUser();
    // }
    // // ... device: create a new one
    // if (!device) {
    //   device = createDevice(deviceId, user);
    // }
    // YES:
    // 1. start from scratch and utilize content that will create temporary device/user that is an unregistered guest user
    deviceId     = 'SOCKET-' + socket.id; // ... use socket.id (very temporary ... it's all we have)
    deviceIdFull = encodeDeviceIdFull(deviceId, clientAccessIP);
    user         = createUser(); // ... defaults to: unregistered guest user
    device       = createDevice(deviceIdFull, deviceId, clientAccessIP, user);

    // 2. setup the bi-directional relationship between Device(User)/Socket(window)
    setupDeviceSocketRelationship(device, socket);

    // 3. communicate the pre-authentication to this client (socket)
    //    ... WITHOUT having client update their token
    //        BECAUSE this state is temporary till error resolved
    const userState = extractUserState(user);
    sendPreAuthentication(socket, userState); // ... NO token is supplied, so it is NOT updated on client
  }

  // log all devices AFTER setup is complete
  finally {
    logAllDevices('All Devices AFTER setup', log)
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
  logAllDevices(`All Devices AFTER disconnect of socket: ${socket.id}, device: ${socket.data.deviceIdFull} ... `, log)
}


/********************************************************************************
 * setup the bi-directional relationship between Device(User)/Socket(window)
 *
 *   Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceIdFull
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
 * RETURN: deviceId
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
