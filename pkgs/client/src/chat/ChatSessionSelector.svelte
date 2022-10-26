<script context="module">

 //***
 //*** ChatSessionSelector.svelte ... A Selector of Chat Sessions
 //***

 import {onDestroy} from 'svelte';

 // stateRetention: retains component state when destroyed/re-instantiated
 //                 - defaults to module-scoped retention (globally shared across all component instances)
 //                 - overide by using `createStateRetention(): stateRetention` and ?? passing in as PROP
 export function createStateRetention() {
   let sessionIdRetained = undefined;
   return {
     get()          { return sessionIdRetained; },
     set(sessionId) { sessionIdRetained = sessionId; },
   };
 }
 const stateRetentionDEFAULT = createStateRetention();
</script>

<script>
 export let chat;    // PROP: the chat store that we are selecting from
 export let session; // PROP: the "selected" chat session (bind to this prop, making it reactive in contained component)
 export let stateRetention=stateRetentionDEFAULT; // PROP: retains component state when destroyed/re-instantiated (defaults to "common" module-scoped retention)

 // retain last known info for use when component is re-activated
 onDestroy( () => {
   stateRetention.set(sessionId);
 });

 // the active sessionId/session we are displaying (from all active chat sessions)
 // ... sessionId is an alias of SESSION.otherSocketId
 // ... we NEED sessionId (in addition to session) because it is non-volital
 //     ... the session object instance will change over time
 // start out with our initial value (if any)
 let sessionId = stateRetention.get();
 // reflexively adjust sessionId when chat store changes
 // ... checking for existance (say when disconnected ... even when Chat component is NOT active)
 //     reverting to first one
 $: {
   sessionId = $chat.session[sessionId] ? sessionId : $chat.sessions[0]?.otherSocketId;
   session   = $chat.session[sessionId]; // maintain our active session
 }
</script>

<select bind:value={sessionId}> <!-- select the desired chat session -->
  {#each $chat.sessions as sess (sess.otherSocketId)}
    <option value={sess.otherSocketId}>{sess.otherUserName}</option>
  {/each}
</select>
