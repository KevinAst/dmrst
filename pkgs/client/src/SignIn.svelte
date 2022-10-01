<script>
 import user     from './user';
 import logger   from './core/util/logger';
 const  log      = logger('vit:client:SignIn');

 // NOTE: We do not do anything fancy to preserve input values when we move off&back of the SignIn tab.
 //       - BECAUSE of the sensitive nature of sign-in data
 //         ... if we retained sign-in email/pass in module scope, 
 //             we would have to explicitly clear them on sign-out
 //             AND this screen is NOT even "in the mix" of a sign-out operation
 //       - ALSO, this screen is ONLY available when user is signed-out
 //       - JUST KISS: only initialize values from $user reactive store
 //         * which is only guestName
 //           BECAUSE all other store values have been cleared on sign-out

 // our input state (bound to input controls)
 // ?? consider initializing these from our user store? ... IN a module state ?? unsure if we can use $user in a module scope?
 $:  email    = `${userName}@gmail.com`;  // ?? make this a real email field -and- populate user.name FROM server (TO client store) ... along with things like enablement.admin
 let userName = '';
 let pass     = '';
 let signInMsg = '';

 let guestName = '';
 let registerMsg = '';

 async function handleRegister() {
   // ?? do something
 }

 async function handleSignIn() {
   try {
     await user.signIn(email, pass);
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
</script>

<div>
  <h4>Welcome to visualize-it!</h4>

  <div class="indent">

    <i>You are not required to sign-in to <b>visualize-it</b>.</i><br/><br/>

    <b>Guest Registration:</b>
    <div class="indent">
      <i>
        For "system participation" however, you must at minimum (when
        not signed-in) supply a "Guest Name" (that identifies you to
        other participants) ...
      </i><br/><br/>
      <form onsubmit="return false;">
        <label>Guest Name: <input type="text" autocomplete="nickname" bind:value={guestName}/></label>

        <div class="error">{registerMsg}</div>

        <button on:click={handleRegister} value="submit">Register</button>
      </form>
    </div><br/>

    <b>Sign In:</b>
    <div class="indent">
      <i>
        By signing in to <b>visualize-it</b>, you can perform more advanced features
        (like publish packages) ...
      </i><br/><br/>
      <form onsubmit="return false;">
        <label>Email:    <input type="text"     autocomplete="email"            bind:value={email} readonly/></label>
        <!-- svelte-ignore a11y-autofocus -->
        <label>Name:     <input type="text"     autocomplete="nickname"         bind:value={userName} autofocus/></label>
        <label>Password: <input type="password" autocomplete="current-password" bind:value={pass}/></label>

        <div class="error">{signInMsg}</div>
        
        <button on:click={handleSignIn} value="submit">Sign In</button>
      </form>
    </div>

  </div>
</div>

<style>
 .indent {
   margin-left: 50px;
 }
 .error {
   color: red;
 }
</style>
