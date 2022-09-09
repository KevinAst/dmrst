import logger from '../core/util/logger';
const  log = logger('vit:client:util:longpress');

// A svelte action that captures and emits a custom "longpress" event
// ... see: https://stackoverflow.com/questions/56844807/svelte-long-press
// USAGE:
//   <p use:longpress={2000} on:longpress={e => alert('long press')}>Long Press Me</p>

export default function longpress(node, threshold=500) {

  log('USING longpress action');

  let timeout = null;

  function handleMouseDown() {
    log('in handleMouseDown()');
		timeout = setTimeout(handleLongPress, threshold);
	}

  function handleMouseUp() {
    if (timeout !== null) {
      log('canceling longpress processing');
		  clearTimeout(timeout);
      timeout = null;
    }
  }

  function handleLongPress() {
    log('timeout has occurred ... emitting "longpress" CustomEvent');
		node.dispatchEvent(new CustomEvent('longpress'));
    timeout = null;
  }
	
  // activate "longpress" processing via "mousedown/mouseup" events
  log('activating "mousedown/mouseup" event to implement "longpress"');
	node.addEventListener('mousedown', handleMouseDown);
	node.addEventListener('mouseup',   handleMouseUp);
	
	return {
		destroy() {
      log('cleaning up longpress action');
			node.removeEventListener('mousedown', handleMouseDown);
			node.removeEventListener('mouseup',   handleMouseUp);
		}
	};
}
