<script>
 import {launchSystem} from './system';

 import alert  from '../util/alert';
 import logger from '../core/util/logger';
 const  log =  logger('vit:client:SystemLaunch');

 export let newSystemIntroduced; // PROP: communicate new system introduced (either through "launch" or "join") API: newSystemIntroduced(sysId)
 export let resetSubCompDisp;    // PROP: re-set our parent display of this sub-component

 // our input state (bound to input controls)
 let sysId      = '';
 let accessCode = '';
 // AI: input model from user (requires some way to edit JSON) ... for now just use RAW JSON
 let modelStr = `{
   "K1": {
     "type": "valve",
     "open": false,
     "pres": 120
   },
   "R1": {
     "type": "valve",
     "open": true,
     "pres": 1200
   }
 }`;

 let userMsg = '';

 async function handleLaunchSystem() {

   // convert model string into json
   let modelJSON = {};
   try {
     modelJSON = JSON.parse(modelStr);
   }
   catch(e) {
     userMsg = `Model contains invalid JSON ... ${e.message}`;
     return;
   }

   // launch the system, making server aware of this
   try {
     const system = await launchSystem(sysId, accessCode, modelJSON);
     alert.display(`System '${sysId}' has successfully launched ... users may now join!`);
     newSystemIntroduced(sysId);
     resetSubCompDisp();
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       userMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       userMsg = 'Unexpected error in launchSystem process ... see logs for detail'
       log.v(`*** ERROR *** Unexpected error in launchSystem process: ${e}`, e);
     }
   }
 }
</script>

<div>
  <h4>Launch a NEW System</h4>

  <form onsubmit="return false;">
    <!-- svelte-ignore a11y-autofocus -->
    <label>System ID:   <input type="text" autocomplete="on"  bind:value={sysId} autofocus/></label>
    <label>Access Code: <input type="text" autocomplete="on"  bind:value={accessCode}/></label>
    <label>Model:       <textarea bind:value={modelStr}></textarea>

    <div class="error">{userMsg}</div>

    <button on:click={handleLaunchSystem}>Launch</button>
    <button on:click={() => resetSubCompDisp()}>Cancel</button>
  </form>
</div>

<style>
 .error {
   color: red;
 }

 textarea {
   width:  80%;
   height: 300px;
 }

 label, textarea {
   display: block;
 }
</style>
