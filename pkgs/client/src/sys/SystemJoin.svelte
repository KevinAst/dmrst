<script>
 import {joinSystem} from './system';

 import alert  from '../alert';
 import logger from '../core/util/logger';
 const  log =  logger('vit:client:SystemJoin');

 export let newSystemIntroduced; // PROP: communicate new system introduced (either through "launch" or "join") API: newSystemIntroduced(sysId)
 export let resetSubCompDisp;    // PROP: re-set our parent display of this sub-component

 // our input state (bound to input controls)
 let sysId      = '';
 let accessCode = '';

 let userMsg = '';

 async function handleJoinSystem() {

   // join the system, making server aware of this
   try {
     const system = await joinSystem(sysId, accessCode);
     alert.display(`System '${sysId}' has been successfully joined!`);
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
       userMsg = 'Unexpected error in joinSystem process ... see logs for detail'
       log.v(`*** ERROR *** Unexpected error in joinSystem process: ${e}`, e);
     }
   }
 }
</script>

<div>
  <h4>Join an EXISTING System</h4>

  <form onsubmit="return false;">
    <!-- svelte-ignore a11y-autofocus -->
    <label>System ID:   <input type="text" autocomplete="on"  bind:value={sysId} autofocus/></label>
    <label>Access Code: <input type="text" autocomplete="on"  bind:value={accessCode}/></label>

    <div class="error">{userMsg}</div>

    <button on:click={handleJoinSystem}>Join</button>
    <button on:click={() => resetSubCompDisp()}>Cancel</button>
  </form>
</div>

<style>
 .error {
   color: red;
 }
</style>
