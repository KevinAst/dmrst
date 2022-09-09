<script>

 //***
 //*** FilterOtherLogs.svelte ... UI Component - maintain log filters of remote browser (OtherLogs)
 //***

 // HACK FIX:
 // 
 // Normally we would import `filterLogsIOClient` FROM: './filterLogsIOClient';
 // 
 // However, because `filterLogsIOClient` utilizes a module-scoped socket
 // variable (initialized from the client), we must pull in the SAME JS
 // module (from the client perspective).  
 // 
 // - This is why you see the unsightly '../../../../../snip-snip'
 //   reference.
 // 
 // - Without this fix, the JS internals would initialize a separate
 //   "unused" module, and our "used" module would NOT initialize it's
 //   module-scoped socket variable (i.e. it would be undefined).
 // 
 // - I suspect this is related to how our simplistic mono-repo is
 //   maintained (using symbolic links).
 import {setOtherLogFilters,
         getOtherLogFilters} from '../../../../../client/src/core/util/logger/filterLogsIOClient'; // see "HACK FIX" (above)

 import logger from './logger';
 const  log = logger('vit:core:logger:FilterOtherLogs');

 // PROP: otherClientSelector - necessary items to select the "other" client socketId
 //       - gleaned from chat sessions
 //       - passed in as props (vs. imports) because it is NOT part of our contained logger module
 //       - CONTENT:
 //         otherClientSelector: {
 //           chat,                // the chat store that we select remote session from (identifying "other" socketId)
 //           ChatSessionSelector, // the ChatSessionSelector component
 //           stateRetention,      // retains component state when destroyed/re-instantiated
 //         }
 export let otherClientSelector;
 const {chat, ChatSessionSelector, stateRetention} = otherClientSelector;

 // our "selected" chat session (bound to ChatSessionSelector)
 let session;

 let otherLoggingFilter = ''; // because the initialization of this is async, we use delayedOtherInit (AI: technically we should prob keep in sync with other processes that set this (but would require a notification from the server)
 async function delayedOtherInit(sessionId) {
   // handle initialization timing ... will re-execute when we have a sessionId
   if (!sessionId) {
     log(`delayedOtherInit(${sessionId}): NO sessionId due to initialization timing (no-op till re-executed '')`);
     otherLoggingFilter = '';
     return;
   }
   try {
     log(`delayedOtherInit('${sessionId}') ... invoking async getOtherLogFilters()`);
     otherLoggingFilter = await getOtherLogFilters(sessionId);
     log(`delayedOtherInit('${sessionId}') RESULT: '${otherLoggingFilter}'`);
   }
   catch (err) {
     alert(''+err);
   }
 }
 $: {
   // re-initialize otherLoggingFilter whenever session changes
   delayedOtherInit(session?.otherSocketId);
 }

 function handleOtherLoggingFilter() {
   setOtherLogFilters(session.otherSocketId, otherLoggingFilter);
   log.f(`other logging filter (for ${session.otherUserId}) is now set to: '${otherLoggingFilter}'`);
 }
</script>

{#if $chat.isActive}
  <form onsubmit="return false;">
    <label>
      Client Logging Filter for <ChatSessionSelector {chat} {stateRetention} bind:session/>:
      <input type="text" bind:value={otherLoggingFilter}/>
      &nbsp;&nbsp;
      <button on:click={handleOtherLoggingFilter}>Change</button>
    </label>
  </form>
{:else}
  <i>For "Other" Client Logging Filter, establish a chat privite message to that client</i>
{/if}
