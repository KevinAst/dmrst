import AppSys from './App.svelte';
import '../../core/util/ErrorExtensionPolyfill'; // value-added Error extensions, providing ability to handle ALL errors more generically
import '../../sockets'; // configure client app's websocket initiation ... AI: ?? needs a break-up and prune - this contains too much for SYS only app (MINOR: punt for now)

const app = new AppSys({
	target: document.body,
});

export default app;
