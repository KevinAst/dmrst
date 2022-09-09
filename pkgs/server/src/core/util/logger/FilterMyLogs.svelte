<script>

 //***
 //*** FilterMyLogs.svelte ... UI Component - maintain log filters of local browser (MyLogs)
 //***

 import logger from './logger';
 const  log = logger('vit:core:logger:FilterMyLogs');

 let clientLoggingFilter = logger.currentLogFilters();
 function handleClientLoggingFilter() {
   // NOTE: this local logging filter change has a bit more diagnostic logs :-)
   log(`before enabling this filter, our vit:core:logger:FilterMyLogs log enabled status is: log: ${log.enabled} ... logger: ${logger.isLogFilterEnabled('vit:core:logger:FilterMyLogs')}`);
   logger.setLogFilters(clientLoggingFilter);
   log.f(`client logging filter now set to: '${clientLoggingFilter}'`);
   log(`after enabling this filter, our vit:core:logger:FilterMyLogs log enabled status is: log: ${log.enabled} ... logger: ${logger.isLogFilterEnabled('vit:core:logger:FilterMyLogs')}`);
 }
</script>

<form onsubmit="return false;">
  <!-- svelte-ignore a11y-autofocus -->
  <label>
    My Logs Filter:
    <input type="text" bind:value={clientLoggingFilter} autofocus/>
    &nbsp;&nbsp;
    <button on:click={handleClientLoggingFilter}>Change</button>
  </label>
</form>
