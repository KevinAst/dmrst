<script>
 import user     from './user';
 import logger   from '../core/util/logger';
 const  log = logger('vit:client:RegisterGuest');

 // our input state (bound to input controls)
 let guestName = $user.guestName;
 let formMsg   = '';

 async function handleRegisterGuest() {
   try {
     await user.registerGuest(guestName);
     formMsg = ''; // ... clear any prior message
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       formMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       formMsg = 'Unexpected error in Guest Registration process ... see logs for detail';
       log.v(`*** ERROR *** Unexpected error in Guest Registration process: ${e}`, e);
     }
   }
 }
</script>

<div>
  <h4>Welcome to visualize-it!</h4>

  <div class="indent">
    Some <b>systems</b> require a <b>Guest Name</b> <i>(when not signed-in)</i>, that identifies you to other participants.<br/><br/>

    <form onsubmit="return false;">
      <label>
        <b>Guest Name:</b>
        <input type="text" autocomplete="nickname" bind:value={guestName}/>
        <i>blank out to clear prior Guest Name</i>
      </label>

      <div class="error">{formMsg}</div>
      <button on:click={handleRegisterGuest} value="submit">Register</button>
    </form>

  </div>
</div>

<style>
 .indent {
   margin-left: 20px;
 }
 .error {
   color: red;
 }
</style>
