<script>

 //***
 //*** FilterServerLogs.svelte ... UI Component - maintain log filters of the server (ServerLogs)
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
 import {setServerLogFilters,
         getServerLogFilters} from '../../../../../client/src/core/util/logger/filterLogsIOClient'; // see "HACK FIX" (above)

 import logger from './logger';
 const  log = logger('vit:core:logger:FilterServerLogs');

 let serverLoggingFilter = ''; // because the initialization of this is async, we use delayedServerInit (AI: technically we should prob keep in sync with other processes that set this (but would require a notification from the server)
 async function delayedServerInit() {
   serverLoggingFilter = await getServerLogFilters();
 }
 delayedServerInit();
 function handleServerLoggingFilter() {
   setServerLogFilters(serverLoggingFilter);
   log.f(`server logging filter now set to: '${serverLoggingFilter}'`);
 }
</script>

<form onsubmit="return false;">
  <label>
    Server Logging Filter:
    <input type="text" bind:value={serverLoggingFilter}/>
    &nbsp;&nbsp;
    <button on:click={handleServerLoggingFilter}>Change</button>
  </label>
</form>
