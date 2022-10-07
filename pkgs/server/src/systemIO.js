//***
//*** systemIO.js ... WebSocket bindings of visualize-it system (server-side)
//***                 NOTE: This server implementation maintains a server-side state of ALL systems in-use.
//***

import {getUserName}         from './auth';
import {socketAckFn,
        socketAckFn_timeout} from './core/util/socketIOUtils';
import pause                 from './core/util/pause';
import {msgClient}           from './chat';

import logger from './core/util/logger';
const  log = logger('vit:server:systemIO'); 

const  roomFromSysId = (sysId) => `sys-${sysId}`;
const  sysIdFromRoom = (room)  => room.replace('sys-', '');
const  isSysRoom     = (room)  => room.startsWith('sys-');

// all Systems in-use by all clients
//   a Map:
//   sysId<key>: System<value>
//                 - sysId:        <string> .... system identifier -and- alias to room (must be unique on server)
//                 - accessCode:   <string> .... access key to be able to join system (a lite password)
//                 - hostSocketId: <string> .... the host client of this System
//                 - isRunning:    <boolean> ... is system currently running
//                 - model:        <JSON key/value> ... maintained on server to "prime the pump" when participant joins
const allSystems = new Map();
// Usage Summary:
//  - Array.from(allSystems.values())
//  - allSystems.set(sysId, {...});
//  - allSystems.delete(sysId);
//  - allSystems.get(sysId);

// AI: ?? overall state management
// - ? how are rooms removed
// - ? when a socket is terminated/lost are the rooms auto-adjusted
// - ? how do we remove a System (from the allSystems catalog) when they are no longer needed
// - ? more

// return the System for the sysId - undefined for NOT-FOUND
function getSystem(sysId) {
  return allSystems.get(sysId);
}

// the socket.io server in control
let io = null;

// register our socket.io handlers
export default function registerSystemHandlers(socket) {

  log(`registerSystemHandlers(for socket: ${socket.id})`);

  // retain the socket.io server
  if (!io) { // do the first time only (all subsequent sockets would be duplicate)
    io = socket.server;

    // also register io-based events

    // keep track of system participant changes
    // ... common helper function
    async function syncParticipantChanges(sysId, sockId, what) { // ... what: 'joined'/'left'
      const log = logger('vit:server:systemIO:syncParticipantChanges'); 
      log(`processing - sysId: '${sysId}', sockId: '${sockId}', what: '${what}'`);

      const sock    = io.sockets.sockets.get(sockId);
      const userMsg = `'${getUserName(sock)}' has ${what} the '${sysId}' system`;

      const room = roomFromSysId(sysId);
      
      // refresh latest participants (via the room)
      const participantSockets = await io.in(room).fetchSockets(); // ... an array of sockets[]
      const participants = participantSockets.map( s => getUserName(s));

      // broadcast change to ALL participants
      systemParticipantsChanged(sysId, userMsg, participants);
    }
    // ... monitor 'join-room' event
    io.of("/").adapter.on('join-room', async (room, sockId) => { // ... unsure why I must do namespace stuff here
      // only process "system" rooms
      if (isSysRoom(room)) {
        syncParticipantChanges(sysIdFromRoom(room), sockId, 'joined');
      }
    });
    // ... monitor 'leave-room' event AI: untested (don't seem to get leave room when signed out)
    io.of("/").adapter.on('leave-room', async (room, sockId) => { // ... unsure why I must do namespace stuff here
      // only process "system" rooms
      if (isSysRoom(room)) {
        syncParticipantChanges(sysIdFromRoom(room), sockId, 'left');
      }
    });
  }


  // ********************************************************************************
  // launch/create a system, allowing participants to join (a request/response API)
  // ... initiated by the host client
  // ... server retains a system catalog (keyed by sysId), used in processing
  // export function launchSystem(sysId,        // system identifier -and- alias to room (must be unique on server or will error)
  //                              accessCode,   // access key to be able to join system (a lite password)
  //                              model): void  // our data model (JSON key/value)
  // RETURN: void ... successful creation of new system
  // ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
  socket.on('launch-system', (sysId, accessCode, model, ack) => {
    const log = logger('vit:server:systemIO:launch-system'); 
    log(`processing - sysId: '${sysId}', model: `, model);

    // convenience util
    function userErr(userMsg) {
      const errMsg = '*** USER ERROR *** in "launch-system" event';
      log(`${errMsg} ... ${userMsg}`)
      ack({errMsg, userMsg});
    }

    // AI: verify params (for prototype - keep it simple)
    if (!sysId) {
      return userErr(`System ID is required`);
    }
    if (!accessCode) {
      return userErr(`Access Code is required`);
    }

    // verify system does NOT already exist
    if (getSystem(sysId)) {
      return userErr(`system '${sysId}' already exists (in server cache)`);
    }

    // define our system object
    const system = {
      sysId,
      accessCode,
      hostSocketId: socket.id,
      isRunning:    false,
      model
    };

    // create a socket.io room from which participants can join
    log(`joining socket.io room: ${system.sysId}`);
    socket.join(roomFromSysId(system.sysId)); // NOTE: first join dynamically creates the room

    // catalog this system
    allSystems.set(sysId, system);

    // acknowledge success
    log('success');
    return ack();
  });


  // ********************************************************************************
  // join a system, by participants other than host (a request/response API)
  // ... initiated by a non-host participant client
  // export function joinSystem(sysId,             // system identifier -and- alias to room (must be unique on server or will error)
  //                            accessCode): model // access key to be able to join system (a lite password)
  // RETURN: {isRunning, model} ... updated aspects of the system that could have changed (if say the system is actively running)
  // ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
  socket.on('join-system', (sysId, accessCode, ack) => {
    const log = logger('vit:server:systemIO:join-system'); 
    log(`processing - sysId: '${sysId}'`);

    // convenience util
    function userErr(userMsg) {
      const errMsg = '*** USER ERROR *** in "join-system" event';
      log(`${errMsg} ... ${userMsg}`)
      ack({errMsg, userMsg});
    }

    // AI: verify params (for prototype - keep it simple)
    if (!sysId) {
      return userErr(`System ID is required`);
    }
    if (!accessCode) {
      return userErr(`Access Code is required`);
    }

    // verify the requested system (to join) DOES exist
    const system = getSystem(sysId);
    if (!system) {
      return userErr(`system '${sysId}' IS NOT registered to server`);
    }

    // HERE IS WHAT WE HAVE TO WORK WITH:
    // const system = {
    //   sysId,
    //   accessCode,
    //   hostSocketId: socket.id,
    //   isRunning:    false,
    //   model
    // };

    // verify accessCode is valid
    if (accessCode !== system.accessCode) {
      return userErr(`Access Code is invalid`);
    }

    // join the socket.io room
    log(`joining socket.io room: ${system.sysId}`);
    socket.join(roomFromSysId(system.sysId));


    // acknowledge success
    log(`successfully joined - sysId: '${sysId}', model: `, system.model);
    return ack({value: {isRunning: system.isRunning, model: system.model}});
  });


  // ********************************************************************************
  // start a system running
  // ... initiated by a client (either host or non-host/participant)
  // ... this IS the actual server's background process that runs the system!
  // ... the processor itself is asynchronous for two reasons
  //     1. allows us to asynchronously block for each participant to respond
  //     2. allows server to process multiple systems, "playing nicely", giving up
  //        control to other service requests -and/or- other background processes
  // export function runSystem(sysId) // system identifier
  // RETURN: void
  // ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
  socket.on('run-system', async (sysId, ack) => {
    const log = logger('vit:server:systemIO:run-system'); 
    log(`processing - sysId: '${sysId}'`);

    // convenience util
    function userErr(userMsg) {
      const errMsg = '*** USER ERROR *** in "run-system" event';
      log(`${errMsg} ... ${userMsg}`)
      ack({errMsg, userMsg});
    }

    // AI: verify params (for prototype - keep it simple)
    if (!sysId) {
      return userErr(`System ID is required`);
    }

    // verify the requested system (to run) DOES exist
    const system = getSystem(sysId);
    if (!system) {
      return userErr(`Cannot run system ...  '${sysId}' does NOT exist`);
    }

    // HERE IS WHAT WE HAVE TO WORK WITH:
    // const system = {
    //   sysId,
    //   accessCode,
    //   hostSocketId: socket.id,
    //   isRunning:    false,
    //   model
    // };

    // N/A:  KISS: Our current philosophy is we can solicit participants at any time, even when running
    // ERROR if we are still soliciting participants

    // N/A:  Our current philosophy is we get the initial state from the host
    // L8TR: broadcast ENTIRE state to ALL participants (in the room)
    //       for NOW assume same state from model load -or- simply do ONE broadcast of entire state (prob from host)
    // AI:   SideBar: because a participant can join mid-stream, 
    //                WE DO need to give it the FULL current state of our model (which has changed over time)
    //                THIS is done when they "join"
    // TWO PHASES
    // - gather participant state slice from ALL participants
    // - broadcast entire state to ALL participants

    // NO-OP if this system is already running
    if (system.isRunning) {
      // AI: CONSIDER silent no-op with: return ack()
      return userErr(`System '${sysId}' is already running`);
    }

    // mark our system as running
    maintainSystemRunState(system, true);

    // acknowledge success to our invoker
    // ... we do this without returning control
    //     in other words our process keeps on going (in the background)
    ack();


    //***
    //*** remaining logic is our long-running background "tick" processor
    //***

    // the remaining logic represents our long-running background "tick"
    // processor, which runs in the background UNTIL the system is paused
    // (see: 'pause-system' below)
    // NOTE: Each of the "await" async invocations (below), allow this
    //       background process to "play nicely", giving up control to
    //       other service requests -and/or- other background processes
    while (system.isRunning) {
      log(`system '${sysId}' tick processor`);

      // our primary tick processing loop
      // ... we need to communicate to each participant separately
      // ... we refresh the set of room sockets on each cycle,
      //     supporting the case of joins during a system run
      const participantSockets = await io.in(roomFromSysId(sysId)).fetchSockets(); // ... an array of sockets[]
      log(`system '${sysId}' tick processor, number of participants: ${participantSockets.length}`);

      // iterate over each participant socket individually
      // - issuing the 'system-tick' events to EACH system socket,
      // - obtaining each participant's stateChanges
      // NOTE: We use individual socket communication to facilitate a request/response
      //       ... this is NOT possible through a broadcast
      // NOTE: We CANNOT USE forEach for async BECAUSE by introducing an inner function,
      //       it won't block correctly
      for (const participantSocket of participantSockets) {

        // get user of this socket
        const userName = getUserName(participantSocket); // userName implied by socket
      
        // issue the 'system-tick' event to EACH participant INDIVIDUALLY
        // ... gathering their state changes
        try { // ... we use a try/catch to prevent unexpected client errors from blowing our server sky high
          const stateChanges = await systemTick(sysId, participantSocket);
          log(`system '${sysId}' user '${userName}' socket '${participantSocket.id}' tick processor - obtained following stateChanges: `, stateChanges);

          // apply any supplied delta changes
          const stateChanged = Object.keys(stateChanges).length !== 0;
          if (stateChanged) {
            // retain the state changes in our server-based model
            // NOTE: We simply mutate the system.model directly
            //       ... using a simple pattern, restricted to what we know we have
            const model = system.model;
            Object.entries(stateChanges).forEach(([key, val]) => {
              const [compKey, propKey] = key.split('.');
              model[compKey][propKey] = val;
            });

            // broadcast each participant's state changes to ALL participants of this system
            // ... keeping everybody in-sync
            // NOTE: NO acknowledgment is possible with broadcast messages
            systemStateChanged(sysId, stateChanges);
          }
        }
        catch(e) {
          // log error and report to participants
          const usrMsg = `The tick processor fielded an unexpected error from client participant: ${userName} ... tick continuing without their input (see logs for detail)`;
          const errMsg = `*** ERROR *** Unexpected error in client tick processor - system: '${sysId}', participant: '${userName}', socket '${participantSocket.id}' ... tick continuing without their input ... ERROR: ${e}`
          log.f(errMsg);
          msgClient(roomFromSysId(sysId), usrMsg, errMsg); // ... for ALL: roomFromSysId(sysId) -OR- for only user in-error: participantSocket
        }
      }

      // pause a designated time before the next "tick" cycle
      // AI: should be configurable
      await pause(1000);
    }

  });


  // ********************************************************************************
  // pause a running system
  // ... initiated by the client (either host or non-host/participant)
  // export function pauseSystem(sysId) // system identifier
  // RETURN: void
  // ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
  socket.on('pause-system', (sysId, ack) => {
    const log = logger('vit:server:systemIO:pause-system'); 
    log(`processing - sysId: '${sysId}'`);

    // convenience util
    function userErr(userMsg) {
      const errMsg = '*** USER ERROR *** in "pause-system" event';
      log(`${errMsg} ... ${userMsg}`)
      ack({errMsg, userMsg});
    }

    // AI: verify params (for prototype - keep it simple)
    if (!sysId) {
      return userErr(`System ID is required`);
    }

    // verify the requested system (to pause) DOES exist
    const system = getSystem(sysId);
    if (!system) {
      return userErr(`Cannot pause system ...  '${sysId}' does NOT exist`);
    }

    // HERE IS WHAT WE HAVE TO WORK WITH:
    // const system = {
    //   sysId,
    //   accessCode,
    //   hostSocketId: socket.id,
    //   isRunning:    false,
    //   model
    // };

    // NO-OP if this system is NOT running
    if (!system.isRunning) {
      // AI: CONSIDER silent no-op with: return ack()
      return userErr(`System '${sysId}' is NOT running`);
    }

    // mark our system as paused
    // ... this will STOP our system processor (see: 'run-system' event above)
    maintainSystemRunState(system, false);

    // acknowledge success to our invoker
    return ack();
  });

}


// ********************************************************************************
// issue a system-tick event to our client, allowing each client to
// specify state changes in the model.
// ... initiated BY server TO client
// ... employs a request/response (somewhat unusual for server-to-client)
// ... this is a convenience function wrapping the socket protocol with an async request/response
// RETURN: stateChanges
// ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
function systemTick(sysId, participantSocket) {
  // promise wrapper of our socket message protocol
  return new Promise((resolve, reject) => {
    // issue the 'system-tick' request to our client participant
    // ... we use a timeout, so our client CANNOT lock-up the entire process
    participantSocket.timeout(5000).emit('system-tick', sysId, socketAckFn_timeout(resolve, reject, `process client event: 'system-tick'`));
  });
}


// ********************************************************************************
// maintain the supplied system run state (both on the server [here] and all clients)
// ... initiated BY server TO client
// ... because this "broadcasts" the event to all client participants
//     NO response is possible, therefore we DO NOT wrap this in a promise
// ... this is a convenience function wrapping the socket protocol
// RETURN: void
function maintainSystemRunState(system,    // the system to change the run state
                                running) { // the running status (boolean - true: running, false: paused)
  const sysId = system.sysId;

  // mark our system run status to desired state
  // ... NOTE: for pause, this will STOP our system processor
  //           (see: 'run-system' event above)
  system.isRunning = running;
  log(`maintainSystemRunState() ... system '${sysId}' is now ${running ? 'running' : 'paused'}`);

  // broadcast the 'system-run-changed' event to ALL client participants
  // ... the system sysId is an alias to our socket.io room
  log(`maintainSystemRunState() ... broadcast 'system-run-changed' event - sysId: '${sysId}', running: ${running}`);
  io.in(roomFromSysId(sysId)).emit('system-run-changed', sysId, running);
}


// ********************************************************************************
// broadcast state changes to all participants of a running system
// ... initiated BY server TO client
// ... because this "broadcasts" the event to all client participants
//     NO response is possible, therefore we DO NOT wrap this in a promise
// ... this is a convenience function wrapping the socket protocol
// RETURN: void
function systemStateChanged(sysId,          // the sysId of the system in play
                            stateChanges) { // the state changes to apply ( ex: { 'R1.pres': 1210, ... } )
  // broadcast the 'system-state-changed' event to ALL client participants
  // ... the system sysId is an alias to our socket.io room
  log(`systemStateChanged() ... broadcast 'system-state-changed' event - sysId: '${sysId}', stateChanges: `, stateChanges);
  io.in(roomFromSysId(sysId)).emit('system-state-changed', sysId, stateChanges);
}


// ********************************************************************************
// broadcast changes to the set of participants in a system
// ... initiated BY server TO client
// ... because this "broadcasts" the event to all client participants
//     NO response is possible, therefore we DO NOT wrap this in a promise
// ... this is a convenience function wrapping the socket protocol
// RETURN: void
function systemParticipantsChanged(sysId,          // the sysId of the system in play
                                   userMsg,        // a user message describing what happened ('UserA' has joined the 'sys123' system)
                                   participants) { // the array of active userNames in this system
  // broadcast the 'system-participants-changed' event to ALL client participants
  // ... the system sysId is an alias to our socket.io room
  log(`systemParticipantsChanged() ... broadcast 'system-participants-changed' event - sysId: '${sysId}': `, {sysId, userMsg, participants});
  io.in(roomFromSysId(sysId)).emit('system-participants-changed', sysId, userMsg, participants);
}
