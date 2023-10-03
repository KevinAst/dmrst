<script>
 import user from './auth/user';
 import {helloVzual} from 'vzual'; // test pulling in vzual npm package

 let vzualOutput = '';
</script>

<div>
  <center>
    <h4>IDE</h4>
    <p>
      Do normal editing of packages here.
      <br>
      {#if $user.isSignedIn()}
        <b>WITH</b> the ability to publish your package <i>(because you have signed-in)</i>
      {:else}
        <b>WITHOUT</b> the ability to publish your package <i>(you must sign-in for that)</i>
      {/if}  
    </p>

    <p>
      Test vzual npm package: 
      <button on:click={() => vzualOutput = helloVzual()}>Invoke vzual PKG</button>
      <br/>
      <mark><i>{vzualOutput}</i></mark>
    </p>
  </center>

</div>
