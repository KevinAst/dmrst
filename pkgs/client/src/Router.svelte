<script context="module">
 import logger from './core/util/logger';
 const  log = logger('vit:client:Router');
</script>

<script>
 //***
 //*** Router.svelte ... a combination Header & Router
 //***

 import IDE       from './IDE.svelte';
 import System    from './System.svelte';
 import Chat      from './Chat.svelte';
 import Admin     from './Admin.svelte';
 import SignIn    from './SignIn.svelte';
 import user      from './user';
 import chat      from './chat';
 import {signOut} from './auth';
 import alert     from './alert';
 import longpress from './util/longpress';

 // TODO: add some logging!

 // the active component being displayed
 let dispComp = IDE; // default to IDE
 $: { // ... some reflexive routing logic
   // reflexively move OFF the SignIn screen, once user has successfully signed-in
   if ($user.userId && dispComp === SignIn) {
     dispComp = IDE;
   }
   // reflexively move OFF the System screen, if user signed-out
   else if (!$user.userId && dispComp === System) {
     dispComp = IDE;
   }
   // reflexively move OFF the Admin screen, if NOT an administrive user (or logged out)
   else if ($user.userId !== 'admin' && dispComp === Admin) {
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

 function handleSignOut() {
   signOut();             // sign-out of server
   user.deactivateUser(); // de-activate our user on our client-side
 }

 function handleEasterEgg() {
   log('handleEasterEgg ... longpress event occurred!');
   chat.solicitPrivateMsg(); // ?? test
 }

</script>

<div>
  <!-- our crude header -->
  <b><i use:longpress={2000} on:longpress={handleEasterEgg}>visualize-it</i></b>
  <i>(ver 0.1)</i>
  &nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;

  <!-- IDE link  -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === IDE}
    <b class="active">IDE</b>
  {:else}
    <b class="link" on:click={() => dispComp = IDE}>IDE</b>
  {/if}  

  <!-- System link  -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === System}
    <b class="active">System</b>
  {:else if $user.userId}
    <b class="link" on:click={() => dispComp = System}>System</b>
  {:else}
    <i>System</i>
  {/if}  

  <!-- Chat link -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === Chat}
  <b class="active">Chat</b>
  {:else if $chat.isActive}
  <b class="link" on:click={() => dispComp = Chat}>Chat</b>
  {:else}
  <!-- Chat ... don't even show it  -->
  {/if}  

  <!-- Admin link  -->
  &nbsp;&nbsp;&nbsp;
  {#if dispComp === Admin}
    <b class="active">Admin</b>
  {:else if $user.userId === 'admin'}
    <b class="link" on:click={() => dispComp = Admin}>Admin</b>
  {/if}  

  &nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;
  &nbsp;&nbsp;&nbsp;
  <b>User:</b>
  {$user.userId ? $user.userId : 'not-signed-in'}

  <!-- sign-in / sign-out link  -->
  &nbsp;&nbsp;&nbsp;
  {#if $user.userId}
    <b class="link" on:click={handleSignOut}>Sign Out</b>
  {:else if dispComp === SignIn}
    <b class="active">Sign In</b>
  {:else}
    <b class="link" on:click={handleSignIn}>Sign In</b>
  {/if}

  <!-- alert message -->
  <div>
    <i class="alert">{$alert}&nbsp;</i>
  </div>
    
</div>


<!-- our "routed" component -->
<svelte:component this={dispComp}/>

<style>
 .link {
   cursor:          pointer;
   text-decoration: underline;
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
