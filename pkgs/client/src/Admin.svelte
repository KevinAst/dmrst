<script context="module">
 import chat                   from './chat/chat';
 import ChatSessionSelector    from './chat/ChatSessionSelector.svelte';
 import {createStateRetention} from './chat/ChatSessionSelector.svelte';
 import FilterLogs             from './core/util/logger/FilterLogs.svelte';

 // stateRetention: retains component state when destroyed/re-instantiated
 const stateRetention = createStateRetention();
</script>

<div>
  <center>
    <h4>Admin</h4>
  </center>

  <FilterLogs otherClientSelector={{chat, ChatSessionSelector, stateRetention}}/>
</div>
