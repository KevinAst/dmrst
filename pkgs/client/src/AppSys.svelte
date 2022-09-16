l<script>
 import SystemDisplay from './SystemDisplay.svelte';
 import alert   from './alert';

 import {signIn} from './auth';
 import user     from './user';

 import {launchSystem, joinSystem} from './system';

 import logger  from './core/util/logger';
 const  log   = logger('vit:client:AppSys');

 let system = undefined; // ?? initialize

 async function autoSignIn() { // very temp crude (for now) ?? really initialization sys in general

   // sign-in to server
   // ... pulling back any message to display to user
   try {
     const userId = 'Resa';
     const pass   = 'a';
     log(`auto signin for ${userId}`);
     const msg = await signIn(userId, pass);
     if (msg) {
       alert.display(msg);
       log(`signin problem: ${msg}`);
     }
     else {
       // activate our user on our client-side, when successfully signed-in
       user.activateUser(userId);
     }
   }
   catch(e) {
     // AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
     //     ... c:/dev/visualize-it/src/util/discloseError.js
     if (e.isExpected()) {  // notify user of expected errors
       alert.display(e.userMsg);
     }
     else { // notify user of unexpected errors, and log detail
       alert.display('Unexpected error in SignIn process ... see logs for detail');
       log.v(`*** ERROR *** Unexpected error in SignIn process: ${e}`, e);
     }
   }

   // now join a system
   // ... first attempt: just launch a new system
   // ?? VERY TEMP FOR NOW
   // ?? should this be conditional ONLY if user signed in
   try {
     const sysId      = 'A';
     const accessCode = 'a';
     const modelJSON  = {
       "K1": {
         "type": "valve",
         "open": false,
         "pres": 120
       },
       "R1": {
         "type": "valve",
         "open": true,
         "pres": 1200
       }
     };
//   system = await launchSystem(sysId, accessCode, modelJSON);
     system = await joinSystem(sysId, accessCode);
     alert.display(`System '${sysId}' has successfully launched ... users may now join!`);
     // newSystemIntroduced(sysId); ?? NOT NEEDED (I THINK)
     // resetSubCompDisp(); ?? NOT NEEDED (I THINK)
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

 autoSignIn(); // ?? really initialization sys in general

</script>

<main>
  <!-- alert message -->
  <div>
    <i class="alert">{$alert}&nbsp;</i>
  </div>

?? POOP
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
