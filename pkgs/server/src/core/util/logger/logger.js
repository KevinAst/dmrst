import {inBrowser} from '../runningIn';
import debug from 'debug'; // keep this private for proper encapsolation :-)

// our cache of logs
// ... optimizing functional logging probes (that are re-created on each function invocation)
const _cachedLogs = {}; // KEY: namespace, VALUE: log

const log = logger('vit:core:logger'); // talk about eating our own dog food :-)

// SEE: README.md for full documentation
export default function logger(namespace) {

  // short-circut request if already created
  // ... optimizing functional logging probes (that are re-created on each function invocation)
  if (_cachedLogs[namespace]) {
    log(`re-using log with namespace: '${namespace}'`);
    return _cachedLogs[namespace];
  }

  // 1st logger: normal expected logger (returned in our function)
  //             Sample namespace: 'myProj:myModule:myFunct'
  const rtnLog = _cachedLogs[namespace] = debug(namespace);

  // 2nd logger: verbose (exposed via log.v -or- log.verbose)
  //             Sample namespace: 'myProj-v:myModule:myFunct'
  const colonIndx = namespace.indexOf(':');
  const verboseNameSpace = colonIndx === -1 ? `v-${namespace}` : namespace.substring(0, colonIndx) + '-v' + namespace.substring(colonIndx);
  const verbose = debug(verboseNameSpace);
  rtnLog.verbose = rtnLog.v = verbose;

  // 3rd logger: force (exposed via log.f -or- log.force)
  //             Sample namespace: 'myProj:myModule:myFunct' <<< same as original
  const force = debug(namespace);
  force.enabled = true; // always enabled
  // prefix msg with 'IMPORTANT: ' so it is distinguished from normal logs 
  // ... user may wonder why it is appearing when filter is disabled
  const embellished = (msg, ...rest) => force(`IMPORTANT: ${msg}`, ...rest);
  rtnLog.force = rtnLog.f = embellished;
  // CRUDE TEST to insure ...rest params pass-through correctly (un-comment to see)
  // rtnLog.f('test forced log obj: %O, num: %d', {name: 'Kevin', age: 99}, 1979)

  // that's all folks
  return rtnLog;
}

// retain the currentLogFilters for this process
// ... initialized from EITHER:
//     - localStorage.debug (for client browser)
//       OR
//     - DEBUG env var (for node)
//     NOTE: We have to initialize this ourselves, because debug lib has NO mechanism to access the initial LogFilter :-(
let _currentLogFilters = inBrowser ? localStorage.getItem('debug') || '' : process.env.DEBUG || '';

log.f(`our currentLogFilters: '${_currentLogFilters}'`);

// is the log filter enabled for the given nameSpace
// RETURNS boolean
//         should consistently return SAME as log.enabled property (of same nameSpace)
logger.isLogFilterEnabled = function(nameSpace) {
  // simple layer on top of ...
  return debug.enabled(nameSpace);
}

// alter our global log filter
// RETURNS void
logger.setLogFilters = function (filterStr) {
  _currentLogFilters = filterStr;
  debug.enable(filterStr); // I tested debug.enable(filterStr) and it ALWAYS returns void (i.e. undefined) IN ALL CASES (even with nothing passed in)
}

// clear our global log filter
// RETURNS string: priorFilter
logger.clearLogFilters = function() {
  return _currentLogFilters = debug.disable(); // ... simple layer on top of
}

// return the current global log filter
// RETURNS string: filterStr
logger.currentLogFilters = function() {
  return _currentLogFilters;
}






//***
//*** FOLLOWING TESTS are quick-and-dirty ... TEMPORARLY un-comment appropriate sections to VISUALIZE the logging results
//***

//***
//*** SIMPLE test to determine if EXPLICIT log.enabled setting CONFLICTS with dynamic filtering using debug.enable(filter)
//***

// BOTTOM LINE: EXPLICITLY SETTING log.enabled = true/false changes it forever (i.e. dynamic Log Filtering NEVER impacts this probe again)
// const logEE = logger('mpj:ExplicitlyEnabled');
// logEE.enabled = true;                   // once we explicitly enable a log, what does that mean for dynamic filtering using debug.enable(filter)
// debug.enable('-mpj:ExplicitlyEnabled'); // set filter to TURN OFF this entry ... no effect BECAUSE was explicitly enabled
// function testExplicitlyEnabled() {
//   logEE.f('BEFORE logEE');
//   logEE('here is an ExplicitlyEnabled logging probe');
//   logEE.f('AFTER logEE');
// }
// testExplicitlyEnabled(); // also invoke this after LogFilters change


//***
//*** SIMPLE test of filtering logger
//***

// function testLoggingFilter() {
//   const log = logger('mpj:logger'); // NOTE: mpj (My Project) is a sample rendition of our library name (as an example)
// 
//   function testFilter(test, filter, expecting, desc) {
//     console.log(`
// 
// Test:      ${test}
// Filter:    '${filter}'
// Expecting: ${expecting}
// Desc:      ${desc}`);
// 
//     // enable our logging filter (per the test directive)
//     debug.enable(filter);
// 
//     // run canned tests on given filter
//     log('1: logger test');
//     log.f('1f: logger test FORCED LOG');
//     log.v('1v: logger test VERBOSE');
//     const testLog = () => { // function testLog() {
//       const log = logger('mpj:logger:testLog'); // JS: you CAN re-declare log in function scope ... EVEN in arrow functions :-)
//       log('2: in testLog()');
//       log.f('2f: in testLog()');
//       log.v('2v: in testLog()');
//     }
//     testLog();
//   }
// 
//   // drive various tests
//   console.log('\n\n**************************\nSTART: testLoggingFilter()');
// 
//   testFilter('LIBRARY: show mpj library logs (regular and verbose)',
//              'mpj*',
//              '1 1f 1v 2 2f 2v',
//              'NOT  COMMON - at the library level the number of logs could overwhelm you (use to see all, and then refocus');
//   testFilter('LIBRARY: show mpj library logs (regular NOT verbose)',
//              'mpj:*',
//              '1 1f    2 2f',
//              'COMMON - although still a lot of logs (at the library level)');
//   testFilter('LIBRARY: show mpj library logs (verbose NOT regular)',
//              'mpj-v*',
//              '  1f 1v   2f 2v',
//              'NOT  COMMON - typically your want regular to supplement verbose');
// 
//   testFilter('TYPO: show nothing because of TYPO',
//              'mpj:Logger*',
//              '  1f      2f',
//              'shows result of a typo (remember this is case sensitive)');
// 
//   testFilter('MODULE: show mpj logger module logs (regular, NOT verbose)',
//              'mpj:logger*',
//              '1 1f    2 2f',
//              'COMMON - this lets you focus on a given module (depending on how big the module, can still be a lot)');
//   testFilter('MODULE: show mpj logger module logs (verbose, NOT regular)',
//              'mpj-v:logger*',
//              '  1f 1v   2f 2v',
//              'NOT  COMMON - typically your want regular to supplement verbose');
//   testFilter('MODULE: show mpj logger module logs (verbose, and regular)',
//              'mpj*:logger*',
//              '1 1f 1v 2 2f 2v',
//              'COMMON - good to see all logs coming out of a module (regular and verbose)');
// 
//   testFilter('MODULE/FUNCT: show mpj logger function logs (regular, NOT verbose)',
//              'mpj:logger:testLog*',
//              '  1f    2 2f',
//              "VERY COMMON - this lets you focus on a given module's function");
//   testFilter('MODULE/FUNCT: show mpj logger function logs (verbose, NOT regular)',
//              'mpj-v:logger:testLog*',
//              '  1f      2f 2v',
//              "NOT  COMMON - typically your want regular to supplement verbose");
//   testFilter('MODULE/FUNCT: show mpj logger function logs (verbose, and regular)',
//              'mpj*:logger:testLog*',
//              '  1f    2 2f 2v',
//              "VERY COMMON - good to see all logs coming out of a module's function (regular and verbose)");
// 
//   console.log('\n\nEND: testLoggingFilter()\n************************\n\n');
// }
// testLoggingFilter();


//***
//*** Test logging probe overhead -and- show technique to minimize it when disabled
//***

// debug.enable('mpj:logger:testLogOverhead*'); // disable this verbose log
// function testLogOverhead() {
//   const log = logger('mpj:logger:testLogOverhead');
// 
//   let invokeCount = 0;
// 
//   // Test 1
//   log('Test 1: determine if log expression is executed EVEN when log is filtered out');
//   log  (`regular log ... invokeCount: ${++invokeCount}`);
//   log.f(`forced log  ... invokeCount: ${++invokeCount}`);
//   log.v(`verbose log ... invokeCount: ${++invokeCount}`); // this log is disabled, yet it still bumps the counter!
//   log(`incremented three times in above logs (regular/forces/verbose): invokeCount ${invokeCount}`);
// 
//   // Test 2:
//   log('Test 2: prevent "filtered out" logs from even executing (for high-overhead log expressions)');
//   // SHOW technique to minimize logging overhead when disabled
//   log.v.enabled && log.v(`log NOT emitted and high-overhead expressin NOT invoked ... invokeCount: ${++invokeCount}`);
//   log(`incremented one more time in log that protects execution ... should be the same count as before: invokeCount ${invokeCount}`);
// }
// testLogOverhead();

//***
//*** Test logging formatters
//***

// debug.enable('mpj:logger:testFormatters'); // enable this filter
// function testFormatters() {
//   const log = logger('mpj:logger:testFormatters');
// 
//   const myObj = {
//     name: {
//       first: 'Kevin',
//       last:  'Bridges',
//     },
//     age: 21,
//   };
//   // works really well in browser (with dynamic expandable objects)
//   // even works in server (just %o/%O are ALWAYS single-line)
//   // only querk is I see no diff between %o and %O (is supposed to be multi-line but NOT)
//   // ... %o/%O works really well in browser, as it is an expandable object
//   log('Test formatters ... an object: %O, a string "%s", a number %d ... I hope it works', myObj, 'Kevin', 21);
// }
// testFormatters();
