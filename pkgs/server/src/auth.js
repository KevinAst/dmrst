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
 *      Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
 */

import {socketAckFn_timeout} from './core/util/socketIOUtils';
import {prettyPrint}         from './util/prettyPrint';
import {msgClient}           from './chat';

import logger from './core/util/logger';
const  logPrefix = 'vit:server:auth';
const  log = logger(`${logPrefix}`);

// the socket.io server in control
let io = null;


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
  //* handle client sign-in request (a request/response API)
  //* RETURN: (via ack):
  //*           {
  //*             userState, // to update client user object
  //*             token,     // to be retained on client (for preAuthenticate)
  //*           }
  //* THROW:  Error (via ack) with optional e.userMsg (when e.isExpected()) for expected user error (ex: invalid email)
  //*---------------------------------------------------------------------------
  socket.on('sign-in', (email, guestName, ack) => {
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
    if (email && !validEmail(email)) {
      return userErr('Email is invalid');
    }
    if (!email && !guestName) {
      return userErr('Either Email or Guest Name must be supplied (or both)');
    }
    // AI: eventually we will do 2nd phase to supply an email verification code
    //? if (!pass) {
    //?   return userErr('password must be supplied');
    //? }
    //? if (pass !== 'b') {
    //?   return userErr('invalid password ... try "b"');
    //? }

    // KEY: user sign-in successful - NOW update our server state

    // obtain the user associated to this socket -AND- update it's key aspects
    // ... NOTE: our basic socket/device/user structure is pre-established via preAuthenticate()
    // ... NOTE: we mutate this object :-)
    const user = getUser(socket);
    user.email     = email;
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

    enablement: { // various enablements (from server)
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
//* (suitable to be communicated to our client).
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
//* return the user associate to the supplied socket/device/deviceId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: User ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getUser(ref) {
  return getDevice(ref)?.user;
}


//*-------------------------------------------------
//* return the user name associate to the supplied socket/device/deviceId (one in the same).
//* PARM:   ref: deviceId | Device | socket
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
function broadcastUserAuthChanged(socket,      // the initiating socket (identifying deviceId)
                                  userState) { // the current user state
  // broadcast the 'user-auth-changed' event to all clients of the supplied device (via socket)
  const deviceId = socket.data.deviceId;
  log(`broadcastUserAuthChanged() ... broadcast 'user-auth-changed' event - deviceId: '${deviceId}', userState: `, userState);
  // TO ALL room members (using the server)
//io.in(deviceRoom(deviceId)).emit('user-auth-changed', userState);
  // TO ALL room members MINUS socket (using the socket)
  socket.to(deviceRoom(deviceId)).emit('user-auth-changed', userState);
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
//* Device related code
//******************************************************************************
//******************************************************************************

// all active devices
//   a Map:
//   deviceId<key>: Device<value>           Room('device-{deviceId}') ---1:M--< socket
//                  - deviceId<string>
//                  - user<Device>
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
//* return the device associate to the supplied socket/device/deviceId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: Device ... undefined for NOT-FOUND
//*-------------------------------------------------
export function getDevice(ref) {
  const deviceId = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  return devices.get(deviceId);
}

//*-------------------------------------------------
//* create/catalog new device object using supplied parameters
//* RETURN: Device ... newly created
//*-------------------------------------------------
function createDevice(deviceId, user) {
  const device = {deviceId, user};
  devices.set(deviceId, device);
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
  const deviceId = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  const deviceSockets = await io.in(deviceRoom(deviceId)).fetchSockets(); // ... an array of sockets[]
  return deviceSockets;
}

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
 * The following structure established by this function at the initialization
 * of the socket connection:
 * - Device object is established, either newly created or existing reference.
 * - socket.data.deviceId back reference
 * - bi-directional relationship between Device(User)/Socket(window)
 *    Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
 *
 * Once complete, the following API is available:
 *   + getDevice(deviceId|Device|socket):   Device
 *   + getUser(deviceId|Device|socket):     User (same as: device.user)
 *   + getUserName(deviceId|Device|socket): string
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

  const log = logger(`${logPrefix}:preAuthenticate`);

  // working vars scoped outside of try/catch block for error processing
  let deviceId = undefined;
  let device   = undefined;
  let user     = undefined; // contained in device

  try { // ... try/catch prevents client errors from crashing our server

    // TEST ERROR CONDITION: 
    // ... also try NOT responding on client 'get-device-id' event (see client/src/user.js)
    //     resulting in time-out error
    // if (1==1) throw new Error('Test error in preAuthenticate');

    // obtain the deviceId of this client
    deviceId = await getDeviceIdFromClient(socket);
    log(`deviceId from client: ${deviceId}`);

    // for a pre-existing device, the user is automatically accepted from their existing session
    // ... in other words, they are already running our app in a separate browser window, and we accept those credentials
    device = getDevice(deviceId);
    if (device) {
      log(`device ${deviceId} pre-existed (re-used): `, prettyPrint({device}));
      user = getUser(device);
    }

    // on first-use of this device/user (i.e. a non-existent device/user)
    // ... we define a new device/user authenticated from optional saved client credentials
    else {
      log(`device ${deviceId} did NOT pre-exist ... create/catalog new`);

      // L8TR: AI: 
      // request the deviceId to be reset
      // ... this minimizes malicious attempts to re-use a deviceId
      //     when they have access to the browser's localStorage
      //     (where deviceId is stored)
      //? deviceId = await resetDeviceIdOnClient(socket);

      // create our new user
      // ... defaults to: unregistered guest user
      user = createUser();

      // attempt to authenticate from saved client credentials ... if any (i.e. an auth token)
      const token = await getAuthTokenFromClient(socket); // email/pass/guestName
      if (token) {
        const {email, guestName, deviceId: deviceIdFromToken} = decodeUserToken(token);
        log(`client token: `, {email, guestName, deviceId: deviceIdFromToken});

        // if the deviceId matches, we accept the credentials of the token
        // ... otherwise we ignore the token and start out as a Guest user
        // >>> KEY: This is a "minimal" protection against any
        //          malicious attempt to steal the token if a hacker
        //          had access to it in some way.  The deviceId should
        //          always match (for a given browser instance).
        if (deviceIdFromToken === deviceId) { // AI: ? or priorDeviceId (when reset - above)
          log(`client token deviceId matched (accepting credentials): `, {deviceIdFromToken, deviceId});
          user.email     = email;
          user.guestName = guestName;
        }
      }
        
      // re-populate all other user state (via user profile / enablements)
      populateUserProfile(user);

      // create our new device (with the contained user)
      device = createDevice(deviceId, user);
    }

    // setup the bi-directional relationship between Device(User)/Socket(window)
    setupDeviceSocketRelationship(device, socket);

    // generate the token to be sent to our client
    // ... we do this because our deviceId may have changed
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
    // 1. progressively use any content gleaned before error occured
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
    deviceId = socket.id;
    user     = createUser();
    device   = createDevice(deviceId, user);

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
 *      Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
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
  logAllDevices(`All Devices AFTER disconnect of socket: ${socket.id}, device: ${socket.data.deviceId} ... `, log)
}


/********************************************************************************
 * setup the bi-directional relationship between Device(User)/Socket(window)
 *
 *   Device (user) --1:M--< Socket (browser windows) with back-ref socket.data.deviceId
 *
 * RETURN: void
 *********************************************************************************/
function setupDeviceSocketRelationship(device, socket) {

  const deviceId = device.deviceId;

  // utilize socket.io room to collect all socket/window of this device
  // ... NOTE: socket.io infrastructure dynamically updates this collection on socket disconnect
  socket.join( deviceRoom(deviceId) );

  // define the back-reference from the socket/window TO device
  socket.data.deviceId = deviceId;
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
