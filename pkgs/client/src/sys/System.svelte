<script context="module">
 import {writable}               from 'svelte/store';
 import SystemLaunch             from './SystemLaunch.svelte';
 import SystemJoin               from './SystemJoin.svelte';
 import SystemSelector           from './SystemSelector.svelte';
 import {createStateRetention}   from './SystemSelector.svelte';
 import SystemDisplay            from './SystemDisplay.svelte';
 import logger                   from '../core/util/logger';
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
  <SystemDisplay {system}/>

</div>
{/if}
