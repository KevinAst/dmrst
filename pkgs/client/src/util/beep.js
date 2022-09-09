// AI: really need to expose custability
//     - simplify and invoke beep() directly WITH named params (setting up AudioContext ONCE)
//     - consider different approach
//       * in production deploymen, I'm getting following error:
//         beep.js:35 The AudioContext was not allowed to start. 
//                    It must be resumed (or created) after a user gesture on the page.
//                      https://goo.gl/7K7WLu
//                      TRACE: beep.js:35 (at constructor)
//                             beep.js:89
//       * consider different approach (such as Audio object)
//         - How do I make JavaScript beep?
//           ... https://stackoverflow.com/questions/879152/how-do-i-make-javascript-beep
//         - Sound effects in JavaScript / HTML5
//           ... https://stackoverflow.com/questions/1933969/sound-effects-in-javascript-html5/1934325#1934325

// A simple utility to emit a beep in the browser
// ... see: AudioContext
//     https://developer.mozilla.org/en-US/docs/Web/API/AudioContext
// ... patterned after: 
//     https://github.com/kapetan/browser-beep/blob/master/index.js
// ... KJB: Shouldn't be this hard :-(
// USAGE:
//   import beep from './util/beep';
//   ...
//   beep(); -or- beep(2);

const FREQUENCY     = 1000;     // ORIGINAL: 440;     // KJB: how high the beep pitch (50: bass guitar, 440: doodle, 840: ding, 1440: too high)
const INTERVAL      = 250;      // ORIGINAL: 250;     // KJB: time between multiple beeps
const RAMP_VALUE    = 0.00001;  // ORIGINAL: 0.00001; // KJB: UNSURE - volume (I don't know)
const RAMP_DURATION = 1;        // ORIGINAL: 1;       // KJB: beep duration (in seconds)

function createBeep(options={}) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  const audioCtx  = options.context   || new AudioCtx();
  const frequency = options.frequency || FREQUENCY;
  const interval  = options.interval  || INTERVAL;

  function play() {
    const currentTime = audioCtx.currentTime;
    const osc         = audioCtx.createOscillator();
    const gain        = audioCtx.createGain();

    gain.gain.value = 0.2; // KJB: volume: 20%

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    gain.gain.setValueAtTime(gain.gain.value, currentTime);
    gain.gain.exponentialRampToValueAtTime(RAMP_VALUE, currentTime + RAMP_DURATION);

    osc.onended = function () {
      gain.disconnect(audioCtx.destination);
      osc.disconnect(gain);
    }

    osc.type = 'sine';
    osc.frequency.value = frequency;
    osc.start(currentTime);
    osc.stop(currentTime + RAMP_DURATION);
  }

  // our exposed beep function
  function beep(times=1) {
    function emitSound(num) {
      // play our sound
      play();
      // invoke self multiple times (at proper interval)
      if (++num < times) {
        setTimeout(emitSound, interval, num);
      }
    }
    emitSound(0); // emit sound the FIRST time
  }

  // KJB: I have NO IDEA what this is, or how it is invoked
  //      ... found nothing in my search :-(
  //      >>> THIS IS A TOTAL BUST ... it does NOTHING except publically promote it
  //          AI: DO NOT DO THIS IN MY REAL IMPLEMENTATION
  beep.destroy = function () {
    if (!options.context) { // KJB: close when context is NOT supplied in options (i.e. when `new AudioCtx()` above)
      audioCtx.close();
    }
  }

  return beep;
}

const beep = createBeep();
export default beep;
