import '../../core/util/ErrorExtensionPolyfill'; // value-added Error extensions, providing ability to handle ALL errors more generically
import setupSocketConnection from '../../sockets';
import App                   from './App.svelte';

// configure client app's websocket initiation
setupSocketConnection('ide');

// create our App GUI
const app = new App({
	target: document.body,
});

export default app;
