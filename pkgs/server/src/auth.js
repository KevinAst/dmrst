//***
//*** auth.js ... authentication module (and maintainer of user objects)
//***

/**
 * This module (auth.js) manages user authentication,
 * creating and retaining all active users.
 *
 * ?? I think THIS module manages
 *    - User objects
 *    - Device objects
 *    - relationships between Device(User)/Socket(window)
 *
 * ?? describe latest with Device (browser instance)
 *    Device (user) --1:M--< socket (browser windows) with back-ref socket.data.deviceId
 */

import {socketAckFn_timeout} from './core/util/socketIOUtils';

import logger from './core/util/logger';
const  logPrefix = 'vit:server:auth';
const  log = logger(`${logPrefix}`);

//*-----------------------------------------------------------------------------
//* register our socket.io handlers
//*-----------------------------------------------------------------------------
export default function registerAuthHandlers(socket) {

  log(`registerAuthHandlers(for socket: ${socket.id})`);

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
                               userAuth) { // the current data for user object
  // emit the 'pre-authentication' event to the supplied client (socket)
  log(`sendPreAuthentication() ... emit 'pre-authentication' event - socket: '${socket.id}', userAuth: `, userAuth);
  socket.emit('pre-authentication', userAuth);
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

//*-------------------------------------------------
//* return the device associate to the supplied socket/device/deviceId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: Device ... undefined for NOT-FOUND
//*-------------------------------------------------
// ?? TEST
function getDevice(ref) {
  const deviceId = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  return devices.get(deviceId);
}

//*-------------------------------------------------
//* create/catalog new device object using supplied parameters
//* RETURN: Device ... newly created
//*-------------------------------------------------
// ?? TEST
function catalogNewDevice(deviceId, user) {
  const device = {deviceId, user};
  devices.set(deviceId, device);
  return device;
}

//*-------------------------------------------------
//* remove the device associate to the supplied socket/device/deviceId (one in the same).
//* PARM:   ref: deviceId | Device | socket
//* RETURN: boolean ... true: removed, false: no-op (device NOT cataloged)
//*-------------------------------------------------
// ?? TEST
function removeDevice(ref) {
  const deviceId = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  return devices.delete(deviceId);
}


//*-------------------------------------------------
//* return all sockets associated to a given device.
//* PARM:   ref: deviceId | Device | socket
//* RETURN: socket[] VIA promise
//*-------------------------------------------------
// ?? TEST
async function getSocketsInDevice(ref) {
  const deviceId = ref?.data?.deviceId /*socket*/ || ref?.deviceId /*device*/ || ref /*deviceId*/;
  const deviceSockets = await io.in(deviceRoom(deviceId)).fetchSockets(); // ... an array of sockets[]
  log(`?? number of sockets in device '${deviceId}': ${deviceSockets.length}`); // ?? move into usage
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
 * - authenticated (i.e. signed-in) ... per client-retained authentication tokens
 * - or a guest user
 *
 * The resulting structure established by this function is as follows:
 * - socket.data.deviceId is defined                 ??$$ DO THIS
 * - Device (user) --1:M--< socket (browser windows) ??$$ DO THIS
 * - ??$$ refine/more?
 *********************************************************************************/
export async function preAuthenticate(socket) {

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
  
  try { // ... try/catch prevents client errors from crashing our server

//  // ?? TEST to see if we can get the clientIP
//  const clientIP1 = socket.handshake.headers['x-forwarded-for'] || socket.request.connection.remoteAddress; // ... clientIP1: '::1',
//  const clientIP2 = socket.handshake.address; // THINK returns the Server's IP, not the Client's IP         // ... clientIP2: '::1',
//  const clientIP3 = socket.request.connection.remoteAddress;                                                // ... clientIP3: '::1',
//
//  const sHeaders = socket.handshake.headers; // this includes the port
//  const clientIP4 = sHeaders['x-forwarded-for'] + ':' + sHeaders['x-forwarded-port'];                        // ... clientIP4: 'undefined:undefined',
//
//  const clientIP5 = socket.request.connection._peername; // NOT part of the official API                     // ... clientIP5: { address: '::1', family: 'IPv6', port: 61732 },
////const clientIP6 = socket.manager.handshaken[socket.id].address;
//  const clientIP7 = socket.conn.remoteAddress;                                                               // ... clientIP7: '::1'
////const clientIP8 = socket.handshake.headers['x-forwarded-for'].split(',')[0];
//
//  // KJB ATTEMPT: 
//  const clientIP9  = socket.handshake.headers['origin'];  // KJB: more like the server name (I THINK)        // ... clientIP9: 'http://localhost:8085',
//  const clientIP10 = socket.handshake.headers['referer']; // KJB: more like the server name (I THINK)        // ... clientIP10: 'http://localhost:8085/'
//  log(`?? clientIP attempts: `, {clientIP1, clientIP2, clientIP3, clientIP4, clientIP5, clientIP7});
////log(`?? clientIP headers:  `, socket.handshake.headers);
//  log(`?? clientIP KJB attempts: `, {clientIP9, clientIP10});

    // obtain the deviceId of this client
    let deviceId = await getDeviceIdFromClient(socket);
    log(`deviceId from client: ${deviceId}`);

    // ??$$ AI: some of this is MAY BE common logic for explicit sign-in

    let user = undefined;

    // for a pre-existing device, the user is automatically accepted from their existing session
    // ... in other words, they are already running our app in a separate browser window, and we accept those credentials
    let device = getDevice(deviceId);
    if (device) {
      user = getUser(device);
    }

    // on first-use of this device/user (i.e. a non-existent device/user)
    // ... we define a new device/user authenticated from optional saved client credentials
    else {
      // L8TR: AI: 
      // request the deviceId to be reset
      // ... this minimizes malicious attempts to re-use a deviceId
      //     when they have access to the browser's localStorage
      //     (where deviceId is stored)
      //? deviceId = await resetDeviceIdOnClient(socket);

      // create our new user
      // ... defaults to: unregistered guest user
      user = createUser();

      // ??$$ retrofit point ********************************************************************************

      // attempt to authenticate from saved client credentials ... if any (i.e. an auth token)
      // - this may be a pre-authorized user -or- a preliminary user object (without proper credentials)
      //   * our system does allow guest users
      // - our client will force either a SignIn -or- a guestName (that identifies system participants)
      //   * this will go through the normal channels (server interaction) to update our user info
      //     ... which happens when user explicity signs out, etc.
      // - this allows us to quickly move forward in our process of wiring up the user object

      // ??$$ cur point *****************************************
      //? const token = await getAuthTokenFromClient(socket); // email/pass/guestName
      //? signIn() // apply authorization
      //? - success: ping client that they are verified <<< since client defaults to un-verified, no need to communicate problem
      //? - error:   ping client that they NEED verification <<< for good measure, to insure good state on signout/signin

      // create our new device
      device = catalogNewDevice(deviceId, user);
    }

    // wire up this device to our socket (i.e. window association)
    // ... the room association
    socket.join( deviceRoom(deviceId) ); // NOTE: first join dynamically creates the room
    // ... the back-reference from the socket/window
    socket.data.deviceId = deviceId;

    // communicate the pre-authentication to this client (socket)
    const userAuth = {
      email: user.email,
      name:  user.name,
      enablement: {
        admin: user.enablement.admin,
      },
      guestName: user.guestName,
    };
    sendPreAuthentication(socket, userAuth);
  }
  catch(e) {
    // ??$$ ANY ERROR should use a guest authorization ... and tell the user that (somehow)
    // ?? stuff something in e and re-throw it
    log.f(`*** ERROR *** Unexpected error in preAuthenticate - socket: '${socket.id}' ... ERROR: ${e}`);
  }
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
    socket.timeout(2000).emit('get-device-id', socketAckFn_timeout(resolve, reject));
  });
}
