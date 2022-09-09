# logger

*... a thin layer on top of the [debug] logging utility*


<!--- *** Section ************************************************************************* ---> 
## At a Glance

- [logger function]
- [Additional logger Functions]
- [Filtering Logs]
- [High Overhead Logs]
- [NOTE ON Filtering Logs]
- [NOTE TO logger.js maintainers]


<!--- *** Section ************************************************************************* ---> 
## logger function

The `logger` function is a replacement of the `debug` logger function.
The API is identical:

```js
+ logger(namespace): log
```

_As always_, the returned `log` function can be used to generate logs
using the supplied `namespace`.

EX:
```js
import logger from './core/util/logger';
const  log = logger('vit:client:Admin');

...

log('message here');
```

All of the [debug] peripheral items still apply _(for example, the
[overall usage](https://github.com/debug-js/debug#usage),
[filters](https://github.com/debug-js/debug#wildcards),
[namespace colors](https://github.com/debug-js/debug#namespace-colors),
[formatters](https://github.com/debug-js/debug#formatters).
etc.)_.

**Enhanced**

The `logger` function differs in the following ways:

> **it caches the returned log function**, so as to optimize
> functional logging probes _(that are re-created on each function
> invocation)_


> **it consistently generates _(and exposes)_ 3 `log` functions:**

1. The base log using the supplied `namespace`

   **accessed via**: the returned function _(e.g. log)_

2. A verbose log with a supplemented namespace:

   **namespace**: '-v' is injected EARLY in the probe, providing maximum filtering ability

   ```
   ... example namespace:
       'vit:a:b' -> 'vit-v:a:b' ... prior to first colon (i.e. after library name per convention)
       'vit-a-b' -> 'v-vit-a-b' ... otherwise at very beginning

   ... example filter:
       'vit*'   EVERYTHING (regular and verbose)
       'vit:*'  ONLY regular probes
       'vit-v*' ALL verbose probes
   ```

   **accessed via**:
   ```
   log.verbose('my msg')
   -or-
   log.v('my msg') ... a shortcut
   ```

3. A "forced" log with same namespace but is always enabled

   **accessed via**:
   ```
   log.force('my msg')
   -or-
   log.f('my msg') ... a shortcut
   ```

   **NOTE**: forced logs are prefixed with "IMPORTANT: "


<!--- *** Section ************************************************************************* ---> 
## Additional logger Functions

The following `logger` functions are introduced **specifically** by
this logger utility:

- **isLogFilterEnabled()** - Is the log filter enabled for the given nameSpace?

  ```js
  + logger.isLogFilterEnabled(nameSpace): boolean
  ```
  * alias to native `debug.enabled(nameSpace)`
  * should consistently return SAME as log.enabled property _(of same nameSpace)_


- **setLogFilters()** - Alter the global log filter.

  ```js
  + logger.setLogFilters(filterStr): void
  ```
  * alias to native `debug.enable(filterStr)`

- **clearLogFilters()** - Clear the global log filter.

  ```js
  + logger.clearLogFilters(): priorFilterStr
  ```
  * alias to native `debug.disable()`

- **currentLogFilters()** - Return the current global log filter.

  ```js
  + logger.currentLogFilters(): filterStr
  ```


<!--- *** Section ************************************************************************* ---> 
## Filtering Logs

Logging filters can be pre-defined _(before process start)_, using the
DEBUG environment var.  This process is the same as [debug].  This
section is merely a concise summary that considers the 3 `log`
functions.

- For node (PowerShell):
  ```shell
  # set DEBUG var
  $ $env:DEBUG = "mpj*:logger:testLog*"
  # get DEBUG var
  $ Get-ChildItem -Path Env:\DEBUG
  ```

- For browser (Chrome):
  ```shell
  $ localStorage.debug = 'mpj*:logger:testLog*'
  # see value in Application Tab / Local Storage
  ```

**NOTE**: You can also dynamically set the filter programmatically
within your code by using:

```js
+ logger.setLogFilters(filterStr)
```

**Example Filters**

Assuming log namespace as follows: 'mpj:logger:testLog', where:
1. 'mpj' is our project library
2. 'logger' is one of many modules in the 'mpj' library
3. 'testLog' is one of many functions in our 'logger' module

Consider the following logging filters:

- library scope:
  ```
  'mpj*'   - show mpj library logs (regular and verbose)
             NOT COMMON: at the library level the number of logs could 
                         overwhelm you (use to see all, and then refocus)
  'mpj:*'  - show mpj library logs (regular NOT verbose)
             COMMON: although still a lot of logs (at the library level)
  'mpj-v*' - show mpj library logs (verbose NOT regular)
             NOT COMMON: typically your want regular to supplement verbose
  ```

- module scope:
  ```
  'mpj:logger*'   - show mpj logger module logs (regular, NOT verbose)
                    COMMON: this lets you focus on a given module
                            (depending on how big the module, can still be a lot)
  'mpj-v:logger*' - show mpj logger module logs (verbose, NOT regular)
                    NOT COMMON: typically your want regular to supplement verbose
  'mpj*:logger*'  - show mpj logger module logs (verbose, and regular)
                    COMMON: good to see all logs coming out of a module (regular and verbose)
  ```

- TYPO:
  ```
  'mpj:Logger*' - show nothing because of TYPO
                  The case is incorrect (remember this is case sensitive)
  ```

- module/function scope:
  ```
  'mpj:logger:testLog*'   - show mpj logger function logs (regular, NOT verbose)
                            VERY COMMON: this lets you focus on a given module's function
  'mpj-v:logger:testLog*' - show mpj logger function logs (verbose, NOT regular)
                            NOT COMMON: typically your want regular to supplement verbose
  'mpj*:logger:testLog*'  - show mpj logger function logs (verbose, and regular)
                            VERY COMMON: good to see all logs coming out of a module's function
                            (regular and verbose)
  ```



<!--- *** Section ************************************************************************* ---> 
## High Overhead Logs

Remember, your logging probes are executed **BEFORE** it is determined
if they should be filtered-out.  If your probe contains a
high-overhead expression, that CPU will be utilized even when the
probe is filtered-out.

**EX**:
```js
log('my log', someHighOverheadFn());
```

To prevent filtered-out logging probes from even executing, simply
prefix it with `log.enabled &&`.

**EX**:
```js
log.enabled && log('my log', someHighOverheadFn());
```

This technique should be use in logging probes that contain a
high-overhead expression.  This is a common pattern that can be
employed by any logging utility (not just [debug]).


<!--- *** Section ************************************************************************* ---> 

## NOTE ON Filtering Logs

In addition to the logger function _(the public aspect of this
utility)_, we also include modules that support the filtering of logs
in three distinct places:

1. the local browser (MyLogs)
2. a remote browser (OtherLogs)
3. the server (ServerLogs)

These modules include:

```
- filterLogsIOClient.js ..... WebSocket binding supporting filtering of logs (client-side)
- filterLogsIOServer.js ..... WebSocket binding supporting filtering of logs (server-side)

- FilterLogs.svelte ......... UI Component - convenience container of ALL filter types
- FilterMyLogs.svelte ....... UI Component - maintain log filters of local browser (MyLogs)
- FilterOtherLogs.svelte .... UI Component - maintain log filters of remote browser (OtherLogs)
- FilterServerLogs.svelte ... UI Component - maintain log filters of the server (ServerLogs)
```

**Please Note**: The usage of "Filtering Logs" should be restricted to
users with the appropriate "administrative" authority.

**Also Note**: The dependancies for these modules are expected to be
supplied by the containing app feature.  In other words, only the
source code is provided in this common directory.  The dependancies
include:

1. [debug](https://www.npmjs.com/package/debug) (for all)
2. [socket.io](https://www.npmjs.com/package/socket.io) & 
   [socket.io-client](https://www.npmjs.com/package/socket.io-client) (for log filter modules)



<!--- *** Section ************************************************************************* ---> 

## NOTE TO logger.js maintainers
  
Resist the urge to add additional supplemental namespaces (beyond verbose '-v').
  
1. in filtering logs, we would loose the ability to use mid-stream wildcards

   - currently to filter BOTH regular and verbose probes, we can do that in one spec

     **EX**:
     ```js
     logger.isLogFilterEnabled('vit*:SignIn:testLog*'); // this covers both vit:SignIn:testLog*
                                                        // and:             vit-f:SignIn:testLog*
     ```

   - if we introduced more supplemental namespaces (say verbose '-v', and error '-e')
     we would need to be more specific to get just regular and verbose

     **EX**:
     ```js
     logger.isLogFilterEnabled('vit:SignIn:testLog* vit-v:SignIn:testLog*');
     ```
  
2. keep it simple: think twice about over complicating things

   ```
   EX: rather than introduce a new error '-' namespace, just use the exiting
       log.force('ERROR: something bad happened');
       this is probably the semantics you want for ERROR anyway :-)
   ```




<!--- *** REFERENCE LINKS ************************************************************************* ---> 

<!--- **SNF** ---> 
[logger function]:               #logger-function
[Additional logger Functions]:   #additional-logger-functions
[Filtering Logs]:                #filtering-logs
[High Overhead Logs]:            #high-overhead-logs
[NOTE ON Filtering Logs]:        #note-on-filtering-logs
[NOTE TO logger.js maintainers]: #note-to-loggerjs-maintainers


<!--- external links ---> 
[debug]:   https://github.com/debug-js/debug#readme
