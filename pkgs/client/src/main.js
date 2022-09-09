import App from './App.svelte';
import './core/util/ErrorExtensionPolyfill'; // value-added Error extensions, providing ability to handle ALL errors more generically
import './sockets'; // configure client app's websocket initiation

const app = new App({
	target: document.body,
});

export default app;
