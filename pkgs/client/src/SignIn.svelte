<script context="module">
 import logger from './core/util/logger';
 const  log = logger('vit:client:SignIn');
</script>

<script>
 import user     from './user';
 import {signIn} from './auth';

 // our input state (bound to input controls)
 let userId = '';
 let pass   = '';

 let userMsg = '';

 async function handleSignIn() {
   try {
     // sign-in to server
     // ... pulling back any message to display to user
     log(`invoking server's signIn process for ${userId}`);
     userMsg = await signIn(userId, pass);
     userMsg && log(`user problem: ${userMsg}`);

     // activate our user on our client-side, when successfully signed-in
     // NOTE: the reflexive user state will cause our router to leave this page!
     user.activateUser(userId);
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       userMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       userMsg = 'Unexpected error in SignIn process ... see logs for detail';
       log.v(`*** ERROR *** Unexpected error in SignIn process: ${e}`, e);
     }
   }
 }
</script>

<div>
  <h4>Welcome to visualize-it!  Please Sign In:</h4>

  <i>By signing in to visualize-it, you can perform advanced features (like publish packages) :-)</i><br/><br/>

  <form onsubmit="return false;">
    <!-- svelte-ignore a11y-autofocus -->
    <label>User ID:  <input type="text"     autocomplete="username"         bind:value={userId} autofocus/></label>
    <label>Password: <input type="password" autocomplete="current-password" bind:value={pass}/></label>

    <div class="error">{userMsg}</div>
    
    <button on:click={handleSignIn} value="submit">Sign In</button>
  </form>
</div>

<style>
 .error {
   color: red;
 }
</style>
