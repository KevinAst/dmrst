<script>
 //***
 //*** Router.svelte ... a combination Header & Router
 //***

 import IDE              from '../../IDE.svelte';
 import System           from '../../sys/System.svelte';
 import Chat             from '../../chat/Chat.svelte';
 import Admin            from '../../Admin.svelte';
 import SignIn           from '../../auth/SignIn.svelte';
 import RegisterGuest    from '../../auth/RegisterGuest.svelte';
 import UserProfileIcon  from '../../auth/UserProfileIcon.svelte';
 import user             from '../../auth/user';
 import chat             from '../../chat/chat';
 import alert            from '../../util/alert';
 import longpress        from '../../util/longpress';
 import logger           from '../../core/util/logger';
 const  log = logger('vit:client:main:IDE:Router');


 // TODO: add some logging!

 // the active component being displayed
 let dispComp = IDE; // default to IDE
 $: { // ... some reflexive routing logic

   // reflexively move OFF the SignIn screen, once user has successfully signed-in
   if (dispComp === SignIn && $user.isSignedIn()) {
     dispComp = IDE;
   }

   // reflexively move OFF the Admin screen, if NOT an administrive user
   else if (!$user.enablement.admin && dispComp === Admin) {
     dispComp = IDE;
   }
   // reflexively move OFF the Chat screen, if user deactivates chat
   else if (!$chat.isActive && dispComp === Chat) {
     dispComp = IDE;
   }
 }

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

 function handleEasterEgg() {
   log('handleEasterEgg ... longpress event occurred!');
   chat.solicitPrivateMsg();
 }

</script>

<div>
  <!-- our crude header -->
  <b><i use:longpress={2000} on:longpress={handleEasterEgg}>visualize-it</i></b>
  <i>(ver 0.4)</i>
  &nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;

  <!-- IDE link  -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === IDE}
    <button class="active">IDE</button>
  {:else}
    <button class="inactive" on:click={() => dispComp = IDE}>IDE</button>
  {/if}  

  <!-- System link  -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === System}
    <button class="active">System</button>
  {:else}
    <button class="inactive" on:click={() => dispComp = System}>System</button>
  {/if}  

  <!-- Chat link -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === Chat}
  <button class="active">Chat</button>
  {:else if $chat.isActive}
  <button class="inactivek" on:click={() => dispComp = Chat}>Chat</button>
  {:else}
  <!-- Chat ... don't even show it  -->
  {/if}  

  <!-- Admin link  -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === Admin}
    <button class="active">Admin</button>
  {:else if $user.enablement.admin}
    <button class="inactive" on:click={() => dispComp = Admin}>Admin</button>
  {/if}  

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


<!-- our "routed" component -->
<svelte:component this={dispComp}/>

<style>
 .inactive {
   color: black;
   background-color: white;
   padding: 2px 4px;
 }
 .active {
   color: white;
   background-color: black;
   padding: 2px 4px;
 }
 .alert {
   color: red;
 }
</style>
