<script>
 import SystemDisplay from './SystemDisplay.svelte';
 import alert   from './alert';

 import {launchSystem, joinSystem} from './system';

 import logger  from './core/util/logger';
 const  log   = logger('vit:client:AppSys');

 let system = undefined; // ?? initialize

 async function attachToSystem() { // very temp crude (for now) ?? really initialization sys in general

   // join a system
   // ... first attempt: just join an existinjg system
   try {
     const sysId      = 'A';
     const accessCode = 'a';
     system = await joinSystem(sysId, accessCode);
     alert.display(`Successfully jointed system '${sysId}'!`);
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       alert.display(e.userMsg);
     }
     else { // notify user of unexpected errors, and log detail
       alert.display('Unexpected error in launchSystem process ... see logs for detail');
       log.v(`*** ERROR *** Unexpected error in launchSystem process: ${e}`, e);
     }
   }

 }

  // auto attach to a hard-coded system (TEMP FOR NOW)
  // ... HACK: use timeout to allow our auto-signin to take affect
  setTimeout(attachToSystem, 1000);

</script>

<main>
  <!-- alert message -->
  <div>
    <i class="alert">{$alert}&nbsp;</i>
  </div>

  <SystemDisplay {system}/>
</main>

<style>
 main {
   padding: 1em;
   margin:  0 auto;
 }
 .alert {
   color: red;
 }
</style>
