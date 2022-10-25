<script context="module">
 import {onDestroy}        from 'svelte';
 import {hasClientSystems, 
         allClientSysIds,
         getSystem}        from './system';

 //***
 //*** SystemSelector.svelte ... A selector of active System stores
 //***

 // stateRetention: retains component state when destroyed/re-instantiated
 //                 - defaults to module-scoped retention (globally shared across all component instances)
 //                 - overide by using `createStateRetention(): stateRetention` and passing in as PROP
 export function createStateRetention() {
   let sysIdRetained = undefined;
   return {
     get()      { return sysIdRetained; },
     set(sysId) { sysIdRetained = sysId; },
   };
 }
 const stateRetentionDEFAULT = createStateRetention();
</script>

<script>
 // PROP: the "selected" system reactive store ... BIND TO THIS PROP, making it reactive in the contained component :-)
 export let system; 

 // PROP: retains component state when destroyed/re-instantiated (defaults to "common" module-scoped retention)
 export let stateRetention=stateRetentionDEFAULT;

 // the selected sysId (internal) ... bound to our <select> element -and- synced with the system store
 let sysId = stateRetention.get();

 // reflexively adjust system store when sysId changes (via our selector)
 $: {
   system = getSystem(sysId) || null; // maintain our active system
 }

 // retain last known info for use when component is re-activated
 onDestroy( () => {
   stateRetention.set(sysId);
 });
</script>

<!-- select the desired system store -->
{#if hasClientSystems()}
  <select bind:value={sysId}>
    {#each allClientSysIds() as _sysId (_sysId)}
    <option value={_sysId}>{_sysId}</option>
    {/each}
  </select>
{/if}
