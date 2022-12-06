import './global.css'; // our global CSS is included via this technique (using vite - placed in dist/??) AI: UNSURE WHY this is preferred over just referencing in our index.html
import '../../core/util/ErrorExtensionPolyfill'; // value-added Error extensions, providing ability to handle ALL errors more generically
import setupSocketConnection from '../../sockets';
import App                   from './App.svelte';

// configure client app's websocket initiation
setupSocketConnection('ide');

// create our App GUI
const app = new App({
  target: document.getElementById('app'),
})

export default app;
