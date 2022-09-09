<script context="module">
 import {writable}               from 'svelte/store';
 import SystemLaunch             from './SystemLaunch.svelte';
 import SystemJoin               from './SystemJoin.svelte';
 import SystemSelector           from './SystemSelector.svelte';
 import {createStateRetention}   from './SystemSelector.svelte';
 import {runSystem, pauseSystem} from './system';
 import logger                   from './core/util/logger';
 const  log = logger('vit:client:System');

 // retain the selected system IN module-scoped context (when destroyed/re-instantiated)
 // in such a way that we can alter it when a new system is created
 const systemSelectorStateRetention = createStateRetention();
 // utility to display new system that has been introduced (either through "launch" or "join")
 const newSystemIntroduced = (sysId) => systemSelectorStateRetention.set(sysId);

 // system sub-component to display (if any)
 // ... we need module-scoped to retain subComp when moving on/off the System tab
 // ... we use store to make module-scoped changes reactive
 const subComp = writable(null);
 // utility to reset our sub-comp display
 const resetSubCompDisp = (comp=null) => subComp.set(comp); // ... omit param to clear sub-comp display
</script>

<script>
 // our active system store (bound to <SystemSelector>)
 let system = null;

 let userMsg = '';

 async function handleRunSystem() {
   const sysId = $system.sysId;
   try {
     userMsg = '';
     await runSystem(sysId);
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       userMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       userMsg = 'Unexpected error in runSystem process ... see logs for detail'
       log.v(`*** ERROR *** Unexpected error in runSystem process: ${e}`, e);
     }
   }
 }

 async function handlePauseSystem() {
   const sysId = $system.sysId;
   try {
     userMsg = '';
     await pauseSystem(sysId);
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       userMsg = e.userMsg;
     }
     else { // notify user of unexpected errors, and log detail
       userMsg = 'Unexpected error in pauseSystem process ... see logs for detail'
       log.v(`*** ERROR *** Unexpected error in pauseSystem process: ${e}`, e);
     }
   }
 }


</script>

{#if $subComp}
<svelte:component this={$subComp} {newSystemIntroduced} {resetSubCompDisp}/>
{:else}
<div>
  <center>
    <h4>System</h4>
    <p>
      <!-- select the desired system -->
      <SystemSelector bind:system stateRetention={systemSelectorStateRetention}/>

      <!-- Launch/Join controls -->
      &nbsp;&nbsp;&nbsp;&nbsp;
      <button on:click={() => resetSubCompDisp(SystemLaunch)}>Launch New System</button>
      <button on:click={() => resetSubCompDisp(SystemJoin)}>Join Existing System</button>
    </p>
  </center>

  <!-- Display the selected system (if any) -->
  {#if system}
    <b>System:</b> {$system.sysId} <i>({$system.isHost ? 'host' : 'participant'})</i>
    <br/>
    <b>Participants:</b> {$system.participants}
    <br/>
    <b>Status:</b> {$system.isRunning ? 'running' : 'paused'}
    {#if $system.isRunning}
      <button on:click={handlePauseSystem}>Pause</button>
    {:else}
      <button on:click={handleRunSystem}>Run</button>
    {/if}
    <br/>
    <b>Model:</b>
    <!-- simple render
    <pre>{JSON.stringify($system.model, null, 2)}</pre>
    -->
    <!-- more sophisticate render -->
    <ul>
      {#each Object.entries($system.model) as [compName, compModel]}
      <p>
        <b>{compName}:</b>
        {#if compModel.type === 'valve'} <!-- a valve -->
          a valve ...
          <!-- this checkbox represents a valve switch that can be operated interactivally by any user
               - it is bound to the svelte system store
                 ... which will directly change our local copy of the store
                 ... this is a bit "un-cosure", however because of next bullet it is OK
               - in addition we syncronize this change to other participants
                 ... via system.cacheLocalStateChange(...)
                 ... which "officially" updates everyone's store (ours and all other participants)
                     in a "cosure" way
             -->
          <input type="checkbox"
                 bind:checked={compModel.open}
                 on:change={ e => system.cacheLocalStateChange(`${compName}.open`, e.target.checked) }>
          open, with pressure <b>{compModel.pres}</b>
        {:else} <!-- a catch-all for all other cases -->
          <pre>{JSON.stringify(compModel, null, 2)}</pre>
        {/if}
      </p>
      {/each}
    </ul>

    <div class="error">{userMsg}</div>

  {/if}

</div>
{/if}

<style>
 .error {
   color: red;
 }
</style>
