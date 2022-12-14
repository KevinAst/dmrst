<script>
 import user     from './user';
 import logger   from '../core/util/logger';
 const  log = logger('vit:client:SignIn');

 // NOTE: We do not do anything fancy to preserve input values when we move off & back of the SignIn tab.
 //       - BECAUSE of the sensitive nature of sign-in data
 //         ... if we retained sign-in email in module scope, 
 //             we would have to explicitly clear them on sign-out
 //             AND this screen is NOT even "in the mix" of a sign-out operation
 //       - ALSO, this screen is ONLY available when user is signed-out
 //       - use KISS

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

 // the verificationCode for our SignIn process
 let verificationCode;

 async function handleSignIn() {
   try {
     await user.signIn(email);
     signInMsg = ''; // ... clear any prior message
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

 async function handleSignInVerificationResendCode() {
   try {
     await user.signInVerificationResendCode();
     signInMsg = ''; // ... clear any prior message
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       signInMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       signInMsg = 'Unexpected error in signInVerificationResendCode process ... see logs for detail';
       log.v(`*** ERROR *** Unexpected error in signInVerificationResendCode process: ${e}`, e);
     }
   }
 }

 function handleSignInVerificationCancel() {
   try {
     user.signInVerificationCancel();
     signInMsg = ''; // ... clear any prior message
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       signInMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       signInMsg = 'Unexpected error in signInVerificationCancel process ... see logs for detail';
       log.v(`*** ERROR *** Unexpected error in signInVerificationCancel process: ${e}`, e);
     }
   }
 }

</script>


<div>
  <h4>Welcome to visualize-it!</h4>

  <div class="indent">
    {#if $user.inSignInVerificationPhase}

    <i>A sign-in verification code has been sent to your email: {$user.inSignInVerificationPhase}</i><br/><br/>
 
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
      <button on:click={handleSignInVerificationResendCode}>Resend Code</button>
      <button on:click={handleSignInVerificationCancel}>Cancel</button>
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
