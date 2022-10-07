//***
//*** the current app's user (when signed-in: userId, otherwise: null)
//***

import {writable} from 'svelte/store';
import alert      from './alert';
import {signIn}   from './auth';
import logger     from './core/util/logger';
const  log = logger('vit:client:user');

function createUser() {
	const {subscribe, set, update} = writable({userId: null}); // null for signed-out

	return {
		subscribe,
    // ?? replaced by signIn(x, y, z)
    activateUser: (userId) => {
      log(`activating userId: ${userId}`);
      update(state => ({userId}));
      localStorage.setItem('vitUserId', userId);
      alert.display(`Welcome ${userId} :-)`);
    },
    deactivateUser: () => {
      log(`deactivating user`);
      update(state => ({userId: null}));
      localStorage.removeItem('vitUserId');
      alert.display(`Now signed out - come back soon :-)`);
    },
	};
}

// our current active user
// ... a Svelte store
// ... a SINGLETON (for this client session)
const user = createUser();
export default user;

// auto sign-in if userId retained in localStorage
// ... keeps server in-sync
// ... very crude for now
// ... timeout is crude way of allowing our socket initialization to stabalize :-(
setTimeout(() => {
  const userId = localStorage.getItem('vitUserId'); // userId retained in localStorage
  if (userId) {
    log(`found persistent userId: ${userId} in localStorage ... activating auto sign-in.`);
    signIn(userId, 'a'); // hack: this is async, however we know it "should be" successful
    user.activateUser(userId);
  }
}, 1); // very short time (1 ms), supporting next event cycle
