<script>
 // NOTE: simple dropdown taken from:  https://www.w3schools.com/howto/howto_js_dropdown.asp

 import user   from './user';
 import alert  from './alert';

 export let handleSignIn;        // PROP: the function to invoke for sign-in
 export let handleSignOut;       // PROP: the function to invoke for sign-out
 export let handleRegisterGuest; // PROP: the function to invoke for register-guest

 let userDropdown;
 let showUserDropdown = false;

 function toggleUserMenu() {
   showUserDropdown = !showUserDropdown;
 }

 // close dropdown menu on any click outside of it
 window.onclick = function(event) {
   if (!event.target.matches('.dropbtn')) {
     showUserDropdown = false;
   }
 }
</script>

<div class="dropdown">
  <button on:click={toggleUserMenu} class="dropbtn">User: {$user.getUserName()}</button>
  <div bind:this={userDropdown} class="dropdown-content" class:show={showUserDropdown}>
    {#if $user.isSignedIn()}
       <a on:click={() => alert.display('User Profile will be implemented LATER')}>Profile</a>
       <a on:click={handleSignOut}>Sign Out</a>
    {:else}
       <a on:click={handleRegisterGuest}>Register Guest</a>
       <a on:click={handleSignIn}>Sign In</a>
    {/if}
  </div>
</div>


<style>
 /* Dropdown Button */
 .dropbtn {
   background-color: #3498DB;
   color:     white;
   padding:   8px;
   border:    none;
   cursor:    pointer;
 }

 /* Dropdown button on hover & focus */
 .dropbtn:hover, .dropbtn:focus {
   background-color: #2980B9;
 }

 /* The container <div> - needed to position the dropdown content */
 .dropdown {
   position: relative;
   display:  inline-block;
 }

 /* Dropdown Content (Hidden by Default) */
 .dropdown-content {
   display:          none;
   position:         absolute;
   background-color: #f1f1f1;
   min-width:        160px;
   box-shadow:       0px 8px 16px 0px rgba(0,0,0,0.2);
   z-index:          1;
 }

 /* Links inside the dropdown */
 .dropdown-content a {
   color:            black;
   padding:         12px 16px;
   text-decoration: none;
   display:         block;
 }

 /* Change color of dropdown links on hover */
 .dropdown-content a:hover {
 background-color: #ddd;
 }

 /* Show the dropdown menu (use JS to add this class to the .dropdown-content container when the user clicks on the dropdown button) */
 .show {
   display: block;
 }
</style>
