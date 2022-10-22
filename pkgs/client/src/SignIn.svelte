<script context="module">
 import {onDestroy} from 'svelte';

 // stateRetention: retains component state when destroyed/re-instantiated
 //                 - defaults to module-scoped retention (globally shared across all component instances)
 //                 - overide by using `createStateRetention(): stateRetention` and passing in as PROP
 export function createStateRetention() {
   let verificationPhaseRetained = false;
   return {
     get()                  { return verificationPhaseRetained; },
     set(verificationPhase) { verificationPhaseRetained = verificationPhase; },
   };
 }
 const stateRetentionDEFAULT = createStateRetention();
</script>

<script>
 import user     from './user';
 import logger   from './core/util/logger';
 const  log      = logger('vit:client:SignIn');

 // NOTE: We do not do anything fancy to preserve input values when we move off&back of the SignIn tab. ??$$$ re-look at this once we pull our verificationPhase state from user store
 //       - BECAUSE of the sensitive nature of sign-in data
 //         ... if we retained sign-in email in module scope, 
 //             we would have to explicitly clear them on sign-out
 //             AND this screen is NOT even "in the mix" of a sign-out operation
 //       - ALSO, this screen is ONLY available when user is signed-out
 //       - JUST KISS: only initialize values from $user reactive store
 //         * which is only guestName
 //           BECAUSE all other store values have been cleared on sign-out
 // NOTE: We DO however retain the basic phase we are in
 export let stateRetention=stateRetentionDEFAULT; // PROP: retains component state when destroyed/re-instantiated (defaults to "common" module-scoped retention)

 // the SignIn screen can be in a verification phase (for a short period of time)
 let verificationPhase = stateRetention.get();
 let verificationCode;

 // retain last known info for use when component is re-activated
 onDestroy( () => {
   stateRetention.set(verificationPhase);
 });

 // our input state (bound to input controls)
 // following convenience injects a default '@gmail.com' (temporary code for developer speed)
 $:  email = email ? (email.includes('@') ? email : `${email}@gmail.com`) : '';
 $:  buttonLabel = email ? 'Sign In' : 'Register';
 let signInMsg = '';

 // following convenience is a bit hoaky (and temporary for developer speed) 
 // but it resets the email cursor postion when we inject the default '@gmail.com'
 let emailDOM;
 $: {
   if (email && email.indexOf('@') === 1) {
     setTimeout( () => {
       // emailDOM.focus();
       emailDOM.setSelectionRange(1, 1);
     }, 1);
   }
 }

 async function handleSignIn() {
   try {
     await user.signIn(email);
     signInMsg = ''; // ... clear any prior message

     // transition this component into a verification phase
     // ... waiting for a verification code to be entered
     verificationPhase = true;
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       signInMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       signInMsg = 'Unexpected error in SignIn process ... see logs for detail';
       log.v(`*** ERROR *** Unexpected error in SignIn process: ${e}`, e);
     }
   }
 }

 async function handleSignInVerification() {
   try {
     await user.signInVerification(verificationCode);
     signInMsg = ''; // ... clear any prior message

     // transition this component back into the sign-in phase
     verificationPhase = false;
     // ... because of the dynamics our Router (triggered by our user svelte store)
     //     THIS SignIn component has already been removed by the time we get here
     //     DUE TO the async/await (above)
     //     THEREFORE we duplicate this state retention with the correct "delayed" value :-(
     stateRetention.set(verificationPhase);
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       signInMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       signInMsg = 'Unexpected error in SignIn process ... see logs for detail';
       log.v(`*** ERROR *** Unexpected error in SignIn process: ${e}`, e);
     }
   }
 }

 async function handleCancelVerification() {
   // transition this component back into the sign-in phase
   // NOTE: we use a KISS principle and DO NOT notify the server of this operation.
   //       because it will automatically expire in a short time.
   verificationPhase = false;
   signInMsg = ''; // ... clear any prior message
 }

</script>


<div>
  <h4>Welcome to visualize-it!</h4>

  <div class="indent">

    {#if verificationPhase}

    <i>A verification code hase been sent to your email .</i><br/><br/>

    <form onsubmit="return false;">
      <label>
        <b>Code:</b>
        <input type="text" bind:value={verificationCode}/>
        <i>
          enter your <b>Verification Code</b> here
        </i>
      </label>

      <div class="error">{signInMsg}</div>
      <button on:click={handleSignInVerification} value="submit">Verify</button>
      <!-- 
           <button on:click={handleSignInResend}>Resend</button>
         -->
      <button on:click={handleCancelVerification}>Cancel</button>
    </form>

    {:else}

    <i>You are <b>not required</b> to sign-in in order to use <b>visualize-it</b>.</i><br/><br/>

    <i>However, signing in with a <b>verified email</b>, gives you access to <b>publish packages</b>!</i><br/><br/>

    <form onsubmit="return false;">
      <label>
        <b>Email:</b>
        <!-- svelte-ignore a11y-autofocus -->
        <input type="text" autocomplete="email" bind:value={email} bind:this={emailDOM} autofocus/>
      </label>

      <div class="error">{signInMsg}</div>
      <button on:click={handleSignIn} value="submit">{buttonLabel}</button>
    </form>

    {/if}  

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
