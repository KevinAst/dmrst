//***
//*** a simple alert(msg) shown in our main screen (via Router.svelte)
//***

import {writable} from 'svelte/store';

let timeout = null;

function createAlert() {
	const {subscribe, set, update} = writable(''); // empty string for NO alert

	return {
		subscribe,
    display: (msg) => {
      clearTimeout(timeout);                    // clear prior timeout (if any)
      set(msg);                                 // display current msg
      timeout = setTimeout(()=> set(''), 5000); // clear msg in 5 seconds
    },
	};
}

// our alert
// ... a Svelte store
const alert = createAlert();
export default alert;
