<script>
 import user from './user';
</script>

<div>
  <center>
    <h4>IDE</h4>
    <p>
      Do normal editing of packages here.
      <br>
      {#if $user.userId}
        <b>WITH</b> the ability to publish your package <i>(because you have signed-in)</i>
      {:else}
        <b>WITHOUT</b> the ability to publish your package <i>(you must sign-in for that)</i>
      {/if}  
    </p>
  </center>

</div>
