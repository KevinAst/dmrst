<script context="module">
 import {onDestroy}         from 'svelte';
 import ChatSessionSelector from './ChatSessionSelector.svelte';
 import chat                from './chat';
 import user                from './user';
 import logger              from './core/util/logger';
 const  log = logger('vit:client:Chat');

 // module-scoped retention of state (when component is destroyed)
 // ... only works for a singleton Chat component (because state a single occurance)
 let myMsgInitial     = '';
</script>

<script>
 // retain last known info for use when component is re-activated
 onDestroy( () => {
	 myMsgInitial     = myMsg;
 });

 // our "selected" chat session (bound to ChatSessionSelector)
 let session;

 // the unprocessed message to send (typed in but NOT YET sent)
 let myMsg = myMsgInitial; // AI: technically myMsg should be related to a session (to be more proper)

 function handleSendMsg() {
   if (myMsg) {
     chat.sendMsg(myMsg, session.otherSocketId);
     myMsg = '';
   }
 }
 
 function handleDisconnect() {
   // disconnect from this session
   chat.disconnect(session.otherSocketId);
 }
</script>

<div>
  <center>
    <h4>Chat</h4>

    <!-- select the desired chat session -->
    <ChatSessionSelector {chat} bind:session/>

  </center>

  <div class="chatlist">
    <span class="other">{session?.otherUserId}</span>
    <span class="me">Me {$user.userId ? `(${$user.userId})` : ''} </span>
    {#each session?.msgs || [] as msg (msg.when)}
      <span class={msg.who ? 'other' : 'me'}>{msg.msg}</span>
    {/each}
  </div>

  <div class="chatbox-area">
    <form id="chatform" onsubmit="return false;">
      <label>
        <!-- svelte-ignore a11y-autofocus -->
        <input type="text" size="50" bind:value={myMsg} autofocus/>
        &nbsp;&nbsp;
        <button on:click={handleSendMsg}>Send</button>
      </label>
    </form>
  </div>

  <center>
    <button on:click={handleDisconnect}>Disconnect</button>
  </center>

</div>



<style>
 /* CRUDE STYLING START ... see: https://codepen.io/meesrutten/pen/wgvpQM */
 .chatlist {
   display: flex;
   flex-flow: column nowrap;
   align-items: flex-end;

   overflow-x: hidden;

   width: 100%;
   max-width: 35em;
   max-height: 75vh;
   margin: 0 auto;
 }

 .me {
   box-shadow: 1px 1px 2px #666;
   border-top: 4px solid #CC8914;
 }

 .other {
   box-shadow: -1px 1px 2px #666;
   border-top: 4px solid #27ae60;
   align-self: flex-start;
   will-change: auto;
   height: auto;
 }

 .chatbox-area {
   margin: 0 auto;
   position: relative;
   bottom: 0;
   height: auto;
   width: 100%;
 }

 #chatform {
   display: flex;
   justify-content: center;
   width: 80%;
   max-width: 35em;
   margin: 0 auto;
   padding-top: 1em;
 }

</style>
