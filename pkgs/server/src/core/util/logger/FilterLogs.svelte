<script>

 //***
 //*** FilterLogs.svelte ... UI Component - convenience container of ALL filter types
 //***

 import FilterMyLogs     from './FilterMyLogs.svelte';
 import FilterOtherLogs  from './FilterOtherLogs.svelte';
 import FilterServerLogs from './FilterServerLogs.svelte';

 // PROP: otherClientSelector - necessary items to select the "other" client socketId
 //       - gleaned from chat sessions
 //       - passed in as props (vs. imports) because it is NOT part of our contained logger module
 //       - CONTENT:
 //         otherClientSelector: {
 //           chat,                // the chat store that we select remote session from (identifying "other" socketId)
 //           ChatSessionSelector, // the ChatSessionSelector component
 //           stateRetention,      // retains component state when destroyed/re-instantiated
 //         }
 export let otherClientSelector;
</script>

<FilterMyLogs/>
<FilterOtherLogs {otherClientSelector}/>
<FilterServerLogs/>
