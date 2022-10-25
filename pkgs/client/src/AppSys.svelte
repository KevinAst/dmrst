<script>
 import UserProfileIcon  from './auth/UserProfileIcon.svelte';
 import SystemDisplay    from './SystemDisplay.svelte';
 import SignIn           from './auth/SignIn.svelte';
 import RegisterGuest    from './auth/RegisterGuest.svelte';
 import {joinSystem}     from './system';
 import user             from './auth/user';
 import alert            from './alert';
 import logger           from './core/util/logger';
 const  log   = logger('vit:client:AppSys');

 // the active component being displayed
 let dispComp = SystemDisplay; // default to SystemDisplay
 $: { // ... some reflexive routing logic

   // reflexively move OFF the SignIn screen, once user has successfully signed-in
   if ($user.isSignedIn() && dispComp === SignIn) {
     dispComp = SystemDisplay;
   }
 }

 // the system to run
 let system;

 async function attachToSystem() { // very temp crude (for now)

   // join a system
   // ... first attempt: just join an existinjg system
   try {
     const sysId      = 'A';
     const accessCode = 'a';
     system = await joinSystem(sysId, accessCode);
     alert.display(`Successfully jointed system '${sysId}'!`);
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       alert.display(e.userMsg);
     }
     else { // notify user of unexpected errors, and log detail
       alert.display('Unexpected error in joinSystem process ... see logs for detail');
       log.v(`*** ERROR *** Unexpected error in joinSystem process: ${e}`, e);
     }
   }

 }

  // auto attach to a hard-coded system (TEMP FOR NOW)
  // ... HACK: use timeout to allow our auto-signin to take affect
  setTimeout(attachToSystem, 1000);


 function handleSignIn() {
   dispComp = SignIn; // display sign-in screen
 }

 function handleRegisterGuest() {
   dispComp = RegisterGuest; // display register-guest screen
 }

 async function handleSignOut() {
   try {
     await user.signOut();   // sign our user out
     dispComp = SignIn;      // display sign-in screen
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       alert.display(e.userMsg);
     }
     else { // notify user of unexpected errors, and log detail
       alert.display('Unexpected error in SignOut process ... see logs for detail');
       log.v(`*** ERROR *** Unexpected error in SignOut process: ${e}`, e);
     }
   }
 }


</script>

<main>

  <div>
    <!-- our crude header -->
    <i on:click={() => dispComp = SystemDisplay} class="sys">
      <b>visualize-it</b>
      (ver 0.2)
      <b>System-Runner</b>
    </i>
    &nbsp;&nbsp;&nbsp;
    &nbsp;&nbsp;&nbsp;
    &nbsp;&nbsp;&nbsp;

    <!-- UserProfile icon -->
    &nbsp;&nbsp;&nbsp;
    &nbsp;&nbsp;&nbsp;
    &nbsp;&nbsp;&nbsp;
    &nbsp;&nbsp;&nbsp;
    <UserProfileIcon {handleSignIn} {handleSignOut} {handleRegisterGuest}/>

    <!-- alert message -->
    <div>
      <i class="alert">{$alert}&nbsp;</i>
    </div>
  </div>

  <!-- our "routed" component  -->
  {#if dispComp === SystemDisplay}
    <svelte:component this={dispComp} {system}/>
  {:else}
    <svelte:component this={dispComp}/>
  {/if}

</main>

<style>
 main {
   padding: 1em;
   margin:  0 auto;
 }
 .sys {
   cursor: pointer;
 }
 .alert {
   color: red;
 }
</style>
