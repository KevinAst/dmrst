//***
//*** a system store, containing our simulated system data model
//***

import {writable, get} from 'svelte/store';

import {launchSystem as launchSystemIO} from './systemIO';
import {joinSystem as joinSystemIO}     from './systemIO';
import {runSystem as runSystemIO}       from './systemIO';
import {pauseSystem as pauseSystemIO}   from './systemIO';
import alert                            from '../util/alert';
import user                             from '../auth/user';
import logger                           from '../core/util/logger';
const  log = logger('vit:client:system');


// ********************************************************************************
// create/catalog our client-side system store (an internal -and- reusable routine)
// RETURN: system (a reactive store)
function createSystemStore(sysId, accessCode, model, isHost, isRunning=false) {

  // our standard svelte store holding our state
	const {subscribe, update} = writable({
    sysId,            // system identifier -and- alias to room (must be unique on server or will error)
  //accessCode,       // access code to join system (a lite password) ... L8TR: suspect only needed on server
    isHost,           // boolean: true - host, false - participant
    participants: [/*userName, ...*/], // all active participants in this system ... dynamically maintained when join/leave
    isRunning,        // indicator of whether the system is running
    model,
  });

  // our custom store with value-added methods
	const system = {
		subscribe, // makes this a store (i.e. a custom store)

    // value-added store methods follow:

    // update the running status of self
    // INITIATED BY: the server's 'run-system' / 'pause-system' process
    runChanged: (running) => {
      update(state => ( {...state, isRunning: running} ));
    },

    // update the active set of participants
    // INITIATED BY: the server's sysId/room join/leave events
    participantsChanged: (participants) => {
      update(state => ( {...state, participants} ));
    },

    // update self's store value with the supplied delta changes
    // INITIATED BY: the server's runSystem() process
    // SOURCE: the source of these changes can be any of the participants who have joined the System
    // RETURN: void
    stateChanged: (deltaModelChanges) => { // ex: { 'R1.pres': 1210, ... }
      update( state => {
        // make a deep copy of model
        // ... https://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-deep-clone-an-object-in-javascript
        const newModel = structuredClone(state.model);

        // apply delta changes
        // ... use a simple patteren, restricted to what we know we have
        Object.entries(deltaModelChanges).forEach(([key, val]) => {
          const [compKey, propKey] = key.split('.');
          newModel[compKey][propKey] = val;
        });

        return {...state, model: newModel};
      });
    },

    // our local state change cache, to be reflected to ALL participants (synced via our tick processor)
    localStateChange: {}, // ex: { 'R1.open': true, ... }

    // cache local changes to our state, to be reflected to ALL participants (synced via our tick processor)
    // INITIATED BY: our local interactive components (when user makes direct state change)
    // NOTE: an arrow function IS NOT used (supporting proper this connotation)
    cacheLocalStateChange(key, val) { // ex: key: 'R1.open', val: true
      this.localStateChange[key] = val;
    },

    // extract (return & clear) the local state change cache
    // RETURN: localStateChange ... ex: { 'R1.open': true, ... }
    extractLocalStateChange() {
      const localStateChange = this.localStateChange;
      this.localStateChange = {};
      return localStateChange;
    },

    // can't think of real example:
    // pseudo example where we interact with server
    foo: () => { // can't think of anything right now
      // ... either do a direct socket.emit(...) -or- a systemIO.js req/res
    },
  };

  // catalog this new system
  clientSystems.set(sysId, system);

  // that's all folks
  return system;
}


// ********************************************************************************
// launch (i.e. create) a new system store (cataloged locally -and- on
// server), which is available for external participants to join.
// RETURN: newly created system reactive store (cataloged)
// ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
export async function launchSystem(sysId,      // system identifier -and- alias to room (must be unique on server or will error)
                                   accessCode, // access code to join system (a lite password)
                                   model) {    // data model of this system, supplied by initiating host (JSON key/value pairs)

  const log = logger('vit:client:system:launchSystem');

  // verify system does NOT already exist
  // ... this is our client cache check (similar error can occur on server cache)
  // AI: although this works, I'm thinking we simply utilize the server validation exclusively
  // if (getSystem(sysId)) {
  //   log(`local client cache found system '${sysId}' ... erroring out`);
  //   // THIS - NO: this seemed to be a wild goose chase (due to a sepereate app bug)
  //   //? BECAUSE OUR FUNCT IS ASYNC, we must return error differently
  //   //? return Promise.reject( // for ease of client usage, consistently deal with async errors only ... https://makandracards.com/makandra/43653-javascript-don-t-throw-exceptions-from-async-functions
  //   //?   new Error('*** USER ERROR *** in "launchSystem()" function')
  //   //?     .defineUserMsg(`system: '${sysId}' already exists (in client cache)`)
  //   //? );
  //   // OR THiS - BOTH SEEM TO WORK ... I think this was a wild goose chase (due to a sepereate app bug)
  //   throw new Error('*** USER ERROR *** in "launchSystem()" function')
  //     .defineUserMsg(`system '${sysId}' already exists (in client cache)`);
  // }

  // launch server-side system, insuring it is valid
  // NOTE: errors are passed-through to our invoker
  //       EX: - Expected Error: system: {sysId} already exists
  await launchSystemIO(sysId, accessCode, model);

  // create/return our client-side reactive system store
  return createSystemStore(sysId, accessCode, model, true /*isHost*/);
}

// ********************************************************************************
// join an existing system from the server, cataloged locally (i.e. created)
// RETURN: newly created system reactive store
// ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
export async function joinSystem(sysId,        // system identifier -and- alias to room (must be unique on server or will error)
                                 accessCode) { // access code to join system (a lite password)

  const log = logger('vit:client:system:joinSystem');

  // verify system does NOT already exist (on the client-side)
  // NOTE: all other validation occurs on the server-side
  if (getSystem(sysId)) {
    log(`local client cache found system '${sysId}' ... erroring out`);
    throw new Error('*** USER ERROR *** in "joinSystem()" function')
      .defineUserMsg(`system '${sysId}' already exists (in client cache)`);
  }

  // join server-side system, insuring it is valid
  // NOTE: errors are passed-through to our invoker
  //       EX: - Expected Error: system: {sysId} already exists
  const {isRunning, model} = await joinSystemIO(sysId, accessCode);

  // create/return our client-side reactive system store
  return createSystemStore(sysId, accessCode, model, false /*isHost*/, isRunning);
}


// ********************************************************************************
// start a system running
// NOTE:   This function could be a method of the system store's value object
//         ... runSystem() ... where we get the sysId via this.sysId
// RETURN: void
// ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
export async function runSystem(sysId) { // system identifier
  // const log = logger('vit:client:system:runSystem');

  // request server to start the system running
  // NOTE: errors are passed-through to our invoker
  //       EX: - Expected Error: system: {sysId} is already running
  // NOTE: Our internal running status is maintained from the 'system-run-changed' event
  //       broadcast to ALL participants from the server
  await runSystemIO(sysId);
}


// ********************************************************************************
// pause a running system
// NOTE:   This function could be a method of the system store's value object
//         ... pauseSystem() ... where we get the sysId via this.sysId
// RETURN: void
// ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
export async function pauseSystem(sysId) { // system identifier
  // request server to pause the system
  // NOTE: errors are passed-through to our invoker
  //       EX: - Expected Error: system: {sysId} is already running
  // NOTE: Our internal running status is maintained from the 'system-run-changed' event
  //       broadcast to ALL participants from the server
  await pauseSystemIO(sysId);
}


// ********************************************************************************
// all Systems in-use by THIS client
//   a Map:
//   sysId<key>: systemStore<value>
log('creating client-side systems cache');
const clientSystems = new Map();
// Usage Summary:
//  - Array.from(clientSystems.values())
//  - clientSystems.set(sysId, {...});
//  - clientSystems.get(sysId);
//  - clientSystems.delete(sysId);

// ********************************************************************************
// return indicator as to whether we have any system entries
// RETURN: boolean
export function hasClientSystems() {
  return clientSystems.size > 0;
}

// ********************************************************************************
// return all system ids
// RETURN: [sysId]
export function allClientSysIds() {
  return Array.from(clientSystems.keys())
}

// ********************************************************************************
// return the system store identified by the supplied sysId
// RETURN: desired system store (undefined for not found)
export function getSystem(sysId) {
  // DEBUGGED VERSION:
  // const system = clientSystems.get(sysId);
  // log(`getSystem('${sysId}') returning: `, system);
  // return system;

  // PRODUCTION VERSION
  return clientSystems.get(sysId);
}




//***
//*** Registration of system-based socket handlers
//***

// our active socket (to be used in this module)
let socket;

export function registerSystemStoreSocketHandlers(_socket) {
  log('here we are in registerSystemStoreSocketHandlers');

  // expose socket to this module
  socket = _socket;

  // our client tick processor for a running system
  // INITIATED BY: the server's runSystem() process
  // RETURN (via ack): deltaModelChanges
  // ERROR  (via ack): either a userMsg (expected condition), or a hard-error (unexpected condition)
  socket.on('system-tick', (sysId, ack) => {
    const log = logger('vit:client:system:system-tick'); 
    log(`processing - sysId: '${sysId}'`);

    // convenience util
    function userErr(userMsg) {
      const errMsg = '*** USER ERROR *** in "system-tick" event';
      log(`${errMsg} ... ${userMsg}`)
      ack({errMsg, userMsg});
    }

    // locate the system store that will service this request
    const system = getSystem(sysId);
    if (!system) {
      return userErr(`'sys-tick" event - sysId: ${sysId} is NOT recognized by this client (something is out-of-sync) :-(`);
    }
    
    // NOTE: This routine simulates some contrived logic that registers changes to the store.
    //       - It does NOT directly update the store.
    //       - RATHER, it returns a deltaModelChanges
    //         (which the server broadcasts to ALL participants of the running system)
    //       - THEREFORE, the changes are applied in stateChanged()
    const model      = get(system).model;
    const activeUser = get(user);

    // accumulator of model changes
    let deltaModelChanges = {
      // example:
      // 'K1.pres': newPressure,
    };

    // TEMPORARY CODE: simulate a hard error
    // with NO checks on the server:
    // - the server will crash
    // - and ALL client socket connections are LOST :-(
    // if (activeUser.userId === 'Kevin' && model.K1.pres > 200) {
    //   ack({errMsg: 'valve 1 BLEW UP (over 200 lbs of pressure)'});
    // }

    // TEMPORARY CODE: simulate a timeout condition (by never responding - NO ack())
    // with NO checks on the server:
    // - the server will block forever (simply stops)
    // if (activeUser.userId === 'Resa' && model.R1.pres > 1300) {
    //   return; // by never responding (ack()) server will timeout
    // }

    // apply programatic state changes (via simulated logic) as needed
    // ... iterate through all components of our system model
    Object.entries(model).forEach( ([compName, comp]) => {

      // process selected components:
      if (comp.type === 'valve' && // valves
          comp.open &&             // that are open
          // when the component name begins with same letter as our active user
          compName[0].toLowerCase() === activeUser.getUserName()[0].toLowerCase()) {

        // bump the pressure up by 10
        deltaModelChanges[`${compName}.pres`] = comp.pres + 10;;
      }
    });

    // ALSO apply the state changes that have been cached by local interactive components
    // ... this cache is retained in the system store (NOT it's value object)
    deltaModelChanges = {...deltaModelChanges, ...system.extractLocalStateChange()};
  
    // that's all folks
    return ack({value: deltaModelChanges});
  });


  // retain changes as to whether our system is running or paused
  // INITIATED BY: the server's 'run-system' / 'pause-system' process
  // NOTE: This event is broadcast, so there is NO opportunity to communicate a response
  socket.on('system-run-changed', (sysId, running) => {
    log(`processing 'system-run-changed' event - sysId: '${sysId}', running: ${running}`);

    // locate our system store
    const system = getSystem(sysId);
    if (!system) {
      log(`sysId: '${sysId}' does NOT exist ... no-oping`);
      return;
    }

    // forward this process into our system store
    system.runChanged(running);

    // notify user of run change
    alert.display(`System '${sysId}' is now ${running ? 'running' : 'paused'}!`);
  });


  // retain state changes to our running system
  // INITIATED BY: the server's 'run-system' process
  // NOTE: This event is broadcast, so there is NO opportunity to communicate a response
  socket.on('system-state-changed', (sysId, stateChanges) => {
    log(`processing 'system-state-changed' event - sysId: '${sysId}', stateChanges: `, stateChanges);

    // locate our system store
    const system = getSystem(sysId);
    if (!system) {
      log(`sysId: '${sysId}' does NOT exist ... no-oping`);
      return;
    }

    // forward this process into our system store
    system.stateChanged(stateChanges);
  });


  // retain changes in the system's set of participants
  // INITIATED BY: the server's sysId/room join/leave events
  // NOTE: This event is broadcast, so there is NO opportunity to communicate a response
  socket.on('system-participants-changed', (sysId, userMsg, participants) => {
    log(`processing 'system-participants-changed' event - sysId: '${sysId}', userMsg: ${userMsg}, participants: ${participants}`);

    // locate our system store
    const system = getSystem(sysId);
    if (!system) {
      log(`sysId: '${sysId}' does NOT exist ... no-oping`);
      return;
    }

    // update our store's participants
    system.participantsChanged(participants);

    // notify user of change
    // EX: "'UserA' has joined the 'sys123' system"
    alert.display(userMsg);
  });

}
