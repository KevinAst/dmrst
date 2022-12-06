# Tooling

This document contains resources to assist you in the
&bull; initial setup
&bull; ongoing development
&bull; and deployment
of **visualize-it**'s `client` sub-project _(`pkgs/client/`)_ ... a
[SPA] _(Single Page App)_.

AI: ?? L8TR: remove all tw-themes references (was copied as a template)

AI: ?? L8TR: resolve ALL "AI"

AI: ?? L8TR: a lot of "project" references may be more accurately "sub-project"

# At a Glance

- [NPM Scripts]
- [Dependencies] AI: retrofit-to-this-proj
- [Project Resources] AI: retrofit-to-this-proj
- [Project Setup]
  - [Setup GitHub Project] AI: retrofit-to-this-proj
  - [Setup Client Monorepo]
  - [Two SPAs in One]
  - [Initialize NPM Project] AI: retrofit-to-this-proj
  - [Setup Unit Testing] AI: retrofit-to-this-proj
  - [Setup Docs Tooling] AI: retrofit-to-this-proj
  - [Setup js.org sub-domain] AI: retrofit-to-this-proj
  - [Setup Lib Packaging] AI: retrofit-to-this-proj
- [Deploy Project] AI: retrofit-to-this-proj
- [Setup New Feature Branch] AI: retrofit-to-this-proj


<!--- *** SECTION *************************************************************** --->
# NPM Scripts

This section provides a summary of the available **NPM Scripts** for
**visualize-it**'s `client` sub-project _(`pkgs/client/`)_
... _organized by task_:

**PLEASE NOTE**: These **NPM Scripts** may be run in any directory
(i.e. they are NOT restricted to be run in the client root).

**PLEASE NOTE**: These **NPM Scripts** are <mark>NOT</mark> currently
written in an "OS Neutral" way _(this task is not currently on my
radar)_.  They are known to run in a windows+cygwin env.



```
DEVELOPMENT
===========
ide:devServe ..... start the "ide" dev server SPA
                   - launches browser session
                   - republishes code changes (vite hot reload)

sys:devServe ..... start the "sys" dev server SPA
                   - launches browser session
                   - republishes code changes (vite hot reload)

                   NOTE: You can simultaneously run both ide/sys SPA dev servers.
                         Code changes will be dynamically refreshed in both browsers.
                         This is made possible because each dev server uses
                         different ports.

PRODUCTION BUILD
================
ide:prodBuild .... prod build the "ide" SPA (output: dist/ide/)
sys:prodBuild .... prod build the "sys" SPA (output: dist/sys/)
app:prodBuild .... prod build BOTH "ide/sys" SPAs (output: dist/)

ide:prodPreview .. start web server hosting the prod "ide" SPA (and launch browser)
sys:prodPreview .. start web server hosting the prod "sys" SPA (and launch browser)
app:prodPreview .. start web server hosting the prod "ide/sys/" SPA (and launch browser)

                   NOTE: NO code monitoring is done for production client builds.

                   NOTE: To preview production client builds (in your browser), 
                         there are three options:

                         1. Serve EACH from this "client" project:
                            # IDE
                            $ npm run ide:prodBuild
                            $ npm run ide:prodPreview # launches: http://localhost:8095/

                            # SYS
                            $ npm run sys:prodBuild
                            $ npm run sys:prodPreview # launches: http://localhost:8096/

                         2. Serve BOTH from this "client" project:
                            $ npm run app:prodBuild
                            $ npm run app:prodPreview
                            - browse:
                              ... http://localhost:8080/ide/
                              ... http://localhost:8080/sys/

                         3. Stage/Review the client build in the server project:
                            $ cd {projRoot}/pkgs/server
                            $ npm run hero:build    AI: insure this is the way I left it in the server project
                            $ npm run app:devServe  AI: insure this is the way I left it in the server project
                            - browse:
                              ... http://localhost:5000/ide/
                              ... http://localhost:5000/sys/
```




<!--- *** SECTION *************************************************************** --->
# Dependencies

AI: retrofit (was copied from tw-themes)

This section provides some insight regarding the various dependencies
found in **tw-themes**.

The dependency list can become quite large for a mature project.  In
looking at `package.json`, the inevitable questions are:

- What is this dependency

- Why is it needed

- Is it a dependency for project tooling or application code?

The following table itemizes the **tw-themes** dependencies,
referencing when/where they were introduced/configured.

Dependency                        | Type        | Usage                          | Refer To
--------------------------------- | ----------- | ------------------------------ | ----------------
`@babel/cli`                      | **TOOLING** | Lib Packaging                  | [Setup Lib Packaging]
`@babel/core`                     | **TOOLING** | Lib Packaging<br>Jest Testing  | [Setup Lib Packaging]<br>[Setup Unit Testing]
`@babel/preset-env`               | **TOOLING** | Lib Packaging<br>Jest Testing  | [Setup Lib Packaging]<br>[Setup Unit Testing]
`babel-jest`                      | **TOOLING** | Jest Testing                   | [Setup Unit Testing]
`gh-pages`                        | **TOOLING** | Docs Deployment                | [Setup Docs Tooling]
`gitbook-cli`                     | **TOOLING** | Docs Generation                | [Setup Docs Tooling]
`jest`                            | **TOOLING** | Jest Testing Framework         | [Setup Unit Testing]
`rimraf`                          | **TOOLING** | Various NPM Clean Scripts      | [Setup Docs Tooling]
`tailwindcss`                     | **TOOLING**<br>**APP** | our peerDependency<br>(what tw-themes is built on) | [Initialize NPM Project]<br>and app code: `src/...`


<!--- *** SECTION *************************************************************** --->
# Project Resources

AI: retrofit (was copied from tw-themes)

Wondering what some of the top-level file resources are?  Here is a
summary:

```
tw-themes/
  .git/ ................ our local git repo
  .gitignore ........... git repo exclusions (typically machine generated)
  _book/ ............... machine generated docs (output of GitBook) see: "Setup Docs Tooling"
  babel.config.js ...... babel configuration used by:
                         - library packaging (see: "Setup Lib Packaging")
                         - jest (see: "Setup Unit Testing")
  book.json ............ GitBook configuration see: "Setup Docs Tooling"
  docs/ ................ master source of GitBook project docs  see: "Setup Docs Tooling"
    *.md ............... various Markdown files making up our docs
  jest.config.js ....... jest unit testing configuration see: "Setup Unit Testing"
  lib/ ................. machine generated library (to deploy) see: "Setup Lib Packaging"
  LICENSE.md ........... our MIT License
  node_modules/ ........ install location of dependent packages (maintained by npm)
  package.json ......... project meta data with dependencies
  package-lock.json .... exhaustive dependency list with installed "locked" versions (maintained by npm)
  README.md ............ basic project docs
  src/ ................. the app source code
    index.js ........... promotes all tw-themes PUBLIC API
    snip snip .......... many more!
  TOOLING.md ........... this document :-)
```


<!--- *** SECTION *************************************************************** --->
# Project Setup

AI: retrofit (was copied from tw-themes)

This section chronicles the original setup of the **tw-themes**
project.

If you are forking this project, this detail is _unnecessary_, because
you simply `npm install` and then commence your development.

With that said, this section provides valuable insight on how the
project was originally setup and configured, and can be used in other
projects _(where you are starting from scratch)_!

**NOTE**: These sections roughly represent the chronology of when they
were carried out, however in some cases the order can be changed.

**Sub Sections**:
  - [Setup GitHub Project]
  - [Setup Client Monorepo]
  - [Two SPAs in One]
  - [Initialize NPM Project]
  - [Setup Unit Testing]
  - [Setup Docs Tooling]
  - [Setup js.org sub-domain]
  - [Setup Lib Packaging]



<!--- *** SUB-SECTION *************************************************************** --->
# Setup GitHub Project

AI: think this topic is EXCLUSIVE to the root-project (NOT the sub-project)
AI: retrofit (was copied from tw-themes)

There are many ways of initiating a new GitHub project. I'll leave the
details to you :-)

At the end of this process you should have:

- A new GitHub project
- A local git repository (for your development)
- Impacted Files:
  ```
    tw-themes/
      .git/ ................ our local git repo
      .gitignore ........... git repo exclusions (typically machine generated)
      LICENSE.md............ MIT License
      README.md ............ basic project docs
  ```

_My personal notes are "hidden" (in comment form) in this doc ..._

<!--- Comment out KJB Notes
**Setup GitHub Project** _(KJB Notes)_:

```
> REFERENCE: Project Check List:
  ... see: openSourcePublishing.txt
           c:/data/tech/dev/openSourcePublishing.txt
> REFERENCE: GitHub Repo:
  ... see: GitHub.txt ... Create a Repository on GitHub (i.e. a project)
           c:/data/tech/dev/GitHub.txt

> ********************************************************************************
- create github repository: tw-themes
  * New Project:
    - Create a Repository on GitHub (i.e. a project)
      * from github page (https://github.com/KevinAst)
      * click + (by user name)
      * New Repository
      * repository name: tw-themes
      * description:     powerful tailwind color themes (dynamically selectable at run-time)
      * Initialize this repository with a README
      * Add MIT License
      * click: Create repository
      * when project complete (very short time)
      * if you have exposed only a few of your github projects,
        expose this one (as needed) by pinning the project
      * click: Clone or download
               - Open with GitHub Desktop
                 * opens in my installed local GitHub Desktop
                 * select my local project directory: c:/dev/      
               - this clones your repository to your local computer
               - skip this step if you’re importing an existing repository
      * now available on my local computer
        - local file system:
          c:/dev/tw-themes> 
        - Github repository:
          https://github.com/KevinAst/tw-themes.git
      * adjust following files:
        > AUTOMATICALLY DONE:
          .git/
          LICENSE ... NOTE: rename to LICENSE.md
          README.md ... add basic notes WITH a work-in-progress indicator
      * check in / sync
        ... readme/license updates
      * verify README content on GitHub
      * NAH: add following topics (to github pages)
        >>> KEYWORDS
        ... tailwind, theme, themes, dark, dark-mode, colors, web

 > ********************************************************************************
 - create branch: initial-tooling
```
KJB Notes --->



<!--- *** SUB-SECTION *************************************************************** --->
# Setup Client Monorepo

As part of our simplistic monorepo, you must manually create the
symlink directories _(one time only - at project setup time)_ that
allows code sharing across sub-projects.

AI: ??$$ discuss KISS monorepo and the creation of symlinks 
    - ?? Reference general discussion in root TOOLING

In the case of this client sub-project, there is only one symlink
directory to create:

| **FROM**: `pkgs/client/src/core/` --> **TO**: `pkgs/server/src/core/` **_(the master source)_**

Simply follow the instructions found in [src/core.DIR.md](src/core.DIR.md).

?? anything else?



<!--- *** SUB-SECTION *************************************************************** --->
# Two SPAs in One

The `client` sub-project _(`pkgs/client/`)_ actually contains **two**
[SPA]'s in one, that share the same code base:

1. **ide** - The [IDE] _(Interactive Development Environment)_, that
   provides the ability to interactively build graphical components
   and systems.  This app also has the ability to run systems _(the
   focus of the **sys** app)_, but is a much larger app _(because of
   the additional features of the [IDE])_.

2. **sys** - A smaller app that has a single focus of running a single
   system.  In essence it is a run-time display of a system used in
   production.  It can optionally be embedded in an existing webpage
   _(through an `<iframe>`)_.  Because of it's single focus, the
   **sys** app is much smaller than the **ide** app _(minimizing
   resources needed for production usage)_.

   AI: rename **sys** to **run** (impacts code too)

In essence the **sys** app is a subset of the **ide** app.  The heart
of what **sys** does is also available in **ide**.  Ultimately this
functionality is shared between the two apps.  In other words
**<mark>they share the same code base</mark>**.  The primary
distinction between the two apps, is they have different starting
points (i.e. the `main.js`).  Because our build tool ([vite])
walks the dependencies _(imports)_ of two different mainlines, the
resulting size of our production bundles is significantly different.

>  **Bottom Line** The way this setup is implemented, you can
>  simultaneously run both SPA dev servers **(ide/sys)**.  Code
>  changes will be dynamically refreshed in both browsers.  This is
>  made possible because each SPA dev server **(ide/sys)** are using
>  different ports.

This task was accomplished by detailed analysis of:

- [Vite Docs]
- [Svelte Getting Started]

**Basic Starting Point**

The following steps setup the standard vite/svelte client per the
[Svelte Getting Started] docs:

```shell

$ cd c:/dev/dmrst/pkgs

# alias to "npm init" ... per svelte docs:
$ npm create vite@latest client -- --template svelte
  npm WARN exec The following package was not found and will be installed: create-vite@latest
  Scaffolding project in C:\TEMP\SvelteVite\pkgs\client...

$ cd client
$ find . -ls
    .gitignore         ... ton of stuff (main focus: node_modules -and- dist)
    .vscode/           <<< DELETE (NOT USED)
      extensions.json  ... used in vs-code (unsure what it is doing)
    dist/              ... machine generated prod build (default location) - BUILD MODS NEEDED FOR "2 SPAS"
     ...
    index.html         ... SPA Entry Point (vite starts with this) - MOVE/DUP FOR "2 SPAS"
    jsconfig.json      ... DELETE (a VS Code configuration of this project) if we use something, needs to be at project root
    package.json       ... standard package with scripts and dependencies
    public/            ... resources are auto placed in the PROD BUILD - MOVE/DUP FOR "2 SPAS"
      vite.svg
    README.md          ... interesting notes relative to vite and HMR
    src/               ... svelte template starting point (sample app)
      app.css          ... global css for entire app - MOVE/DUP FOR "2 SPAS"
      App.svelte       ... app root component
      assets/          ... sample usage of including svg file in code (NOT USED)
        svelte.svg
      lib/             ... sample internal lib
        Counter.svelte
      main.js          ... mainline entry code
      vite-env.d.ts
    vite.config.js     ... the default vite build file - MOVE/DUP FOR "2 SPAS"

# install dependencies
$ npm install
  added 24 packages, and audited 25 packages in 6s
  found 0 vulnerabilities

# run dev server (with hot reload)
$ npm run dev
  - BROWSE: http://localhost:5173/
  - bump counter up by clicking on button (up to 4)
  - change code
  - IT IS SUPER FAST with hot-reload!
```

**Retrofit: Two SPAs in One**

The following steps were used in modifying the default svelte template
to generate two separate [SPA]s:

1. By way of background, our `pkgs/client/` sub-project contains two
   mainline starting points.  These mainline modules limit their
   imports to the specific needs of each app, ... _in essence pruning
   unneeded modules_.

   ```
   pkgs/client/
     src/
       main/
         IDE/              <<< our IDE SPA App entry point
           App.svelte      ... app root component
           global.css      ... global css for entire app - based on svelte template: client/src/app.css (MOVED here)
           index.html      ... root entry html - based on svelte template: client/index.html (MOVED here)
           main.js         ... mainline entry code - based on svelte template: client/src/index.html (MOVED here)
           public/         ... SPA web resources - based on svelte template: client/public (MOVED here)
             favicon.png
           Router.svelte   ... our IDE top-level router component
           vite.config.js  ... our vite build file - based on svelte template: client/vite.config.js (MOVED HERE)
       
         SYS/              <<< our SYS SPA App entry point
           App.svelte          DITTO ABOVE
           global.css
           index.html
           main.js
           public/
             favicon.png
           Router.svelte
           vite.config.js
   ```

2. Our build mods restructure the `dist/` directory _(output of the build)_ as
   follows, to accommodate two [SPA]s.  In essence two sub-directories
   are injected (`ide/` and `sys/`):

   ```
   pkgs/client/
     dist/
       ide/              ... the "ide" SPA (all build output)
         assets/
           index.0f0b1ddb.css
           index.c27ed718.js
         favicon.png
         index.html

       sys/              ... the "sys" SPA (all build output)
         assets/
           index.5a34cc9f.js
           index.e1e605fe.css
         favicon.png
         index.html
   ```

   We also adjust `.gitignore` appropriately (ignoring the root `dist/`
   sub-directory).

   ```
   /dist/
   ```

3. We enhance the standard vite build scripts to accommodate this new structure.

   In summary. the following items are used in the various vite commands:

   - the target src root is provided (ex: `vite src/main/IDE/`)
   - for PROD builds, the output directory is provided (ex: `--outDir ../../../dist/ide`)
   - for PROD builds, the base directive is used to enable relative resource references in our html (ex: `--base ./`)
     * this allows our production server to host multiple SPAs at any location in it's public directory structure.
   - various ports are specified, so as to NOT conflict with multiple SPAs (ex: `--port 8085`)
     * these DEV ports are also maintained in our server for CORS policy config (see [`pkgs/server/src/sockets.js`](../server/src/sockets.js))
   - the `--strictPort` is specified, so as to error out if the port is already in use
     * the default behavior is to bump up the port, which can be problematic for CORS config (on the server)
   - the open directive is used to consistently reference `localhost` vs. 127.0.0.1` (ex: `--open http://localhost:8085`)
     * this makes it more convenient in our server CORS config
     * also in the case of `vite preview` command it now launches the a browser (by default it only launches the server and NOT the browser)

   **Build Scripts**:

   ```
   "ide:devServe":    "vite src/main/IDE/                                             --port 8085 --strictPort --open http://localhost:8085",
   "ide:prodBuild":   "rimraf dist/ide && vite build src/main/IDE/ --outDir ../../../dist/ide --base ./",
   "ide:prodPreview": "vite preview             --outDir dist/ide                     --port 8095 --strictPort --open http://localhost:8095",

   "sys:devServe":    "vite src/main/SYS/                                             --port 8086 --strictPort --open http://localhost:8086",
   "sys:prodBuild":   "rimraf dist/sys && vite build src/main/SYS/ --outDir ../../../dist/sys --base ./",
   "sys:prodPreview": "vite preview             --outDir dist/sys                     --port 8096 --strictPort --open http://localhost:8096",

   "app:prodBuild":       "npm run ide:prodBuild && npm run sys:prodBuild",
   "app:prodPreview:REM": "start the server at dist/ (can test BOTH ide -and- sys)",
   "app:prodPreview":     "vite preview         --outDir dist                         --port 8080 --strictPort --open http://localhost:8080/ide/"
   ```


<!--- *** SUB-SECTION *************************************************************** --->
# Initialize NPM Project

AI: retrofit (was copied from tw-themes)

This task will initialize the project as an NPM project.

At the end of this process you should have:

- **tw-themes** initialized as an NPM project, with it's `tailwindcss`
  peerDependency.

- Impacted Dependencies:
  ```
  tailwindcss ... our peerDependency (what tw-themes is built on)
  ```

- Impacted Files:
  ```
  tw-themes/
    .gitignore ........... modified as needed
    node_modules/ ........ install location of dependent packages (maintained by npm)
    package.json ......... project meta data with dependencies
    package-lock.json .... exhaustive dependency list with installed "locked" versions (maintained by npm)
  ```

**Summary**:

1. Create `package.json` file at project root, with following the
   characteristics _(this contains our `tailwindcss` peerDependency)_:

   ```js
   {
     "name": "tw-themes",
     "version": "0.1.0",
     "description": "powerful tailwind color themes (dynamically selectable at run-time)",
     "homepage": "https://tw-themes.js.org/",
     "repository": {
       "type": "git",
       "url": "https://github.com/KevinAst/tw-themes.git"
     },
     "keywords": [
       "tailwind",
       "themes",
       "theme",
       "dark",
       "dark-mode",
       "colors",
       "web",
       "utility",
       "geeku",
       "astx"
     ],
     "author": "Kevin J. Bridges <kevin@wiiBridges.com> (https://github.com/KevinAst)",
     "license": "MIT",
     "scripts": {
       "L8TR": "L8TR"
     },
     "devDependencies": {
       "tailwindcss": ">=2.0.0"
     },
     "peerDependencies": {
       "tailwindcss": ">=2.0.0"
     }
   }
   ```

2. Initialize Node/NPM:

   ```
   $ cd c:/dev/tw-themes
   $ npm install
   ```

3. Update `.gitignore` with following:

   ```
   # node dependencies (defined via "npm install")
   /node_modules/

   # not really interested in package-lock.json in repo
   /package-lock.json

   ... snip snip
   ```

_My personal Detailed Notes are "hidden" (in comment form) in this doc ..._

<!--- Comment out KJB Notes
**Details**:
```
In addition to above:

- configure VSCode
  * setup VSCode workspace file (and edit):
    c:/dev/tw-themes.code-workspace 
  * launch this workspace
  * N/A: ONE TIME: NOW load the VSCode "svelte" extension
```
KJB Notes --->


<!--- *** SUB-SECTION *************************************************************** --->
# Setup Unit Testing

AI: retrofit (was copied from tw-themes)

**tw-themes** uses [Jest](https://jestjs.io/en/) as it's unit
testing framework.

**Links**:
- [Jest](https://jestjs.io/en/)
- [Jest Installation](https://jestjs.io/docs/en/getting-started.html)

At the end of this process you should have:

- The ability to use Jest in running the test suite.

- Impacted Dependencies:
  ```
  @babel/core
  @babel/preset-env
  babel-jest
  jest
  ```

- Impacted Files:
  ```
  tw-themes/
    babel.config.js
    jest.config.js
  ```

**Installation Details**:

- Install required dependencies (Jest and Babel).

  **NOTE**: Some of these dependencies overlap with other setup (Install
  only what is missing):

  ```
  $ npm install --save-dev @babel/core @babel/preset-env jest babel-jest
    + babel-jest@26.6.3
    + jest@26.6.3
    + @babel/preset-env@7.13.10
    + @babel/core@7.13.10
      added 576 packages from 365 contributors and audited 658 packages in 37.522s
  ```

- Configure Jest/Babel by adding two files _(in project root)_:
  * **jest.config.js**:
    ```js
    // configuration of jest unit tests
    module.exports = {
      transform: {
        "^.+\\.js$": "babel-jest"
      },
      moduleFileExtensions: ["js"],
    
      // KJB: other UNNEEDED (I think)
      // testPathIgnorePatterns: ["node_modules"],
      // bail: false,
      // verbose: true,
      // transformIgnorePatterns: ["node_modules"],
    };
    ```
  * **babel.config.js**:
    ```js
    // babel needed for jest unit tests :-(
    module.exports = {
      presets: [
        [
          "@babel/preset-env",
          {
            targets: {
              node: "current"
            }
          }
        ]
      ]
    };
    ```

- Setup the **Testing NPM Scripts**:
  **package.json**:
  ```js
  ... snip snip

  "scripts": {
    ...
    "test":       "jest src",
    "test:watch": "npm run test -- --watch"
  },

  ... snip snip
  ```

<!--- *** SUB-SECTION *************************************************************** --->
# Setup Docs Tooling

AI: retrofit (was copied from tw-themes)

**tw-themes** promotes it's documentation through [GitHub Pages],
using [GitBook], which is a [Markdown] based solution.  This
configuration setup is patterned after the following article _(minus
the JSDoc)_: [Integrating GitBook with JSDoc to Document Your Open
Source Project].

At the end of this process you should have:

- Documentation setup through [Markdown] files, deployable to [GitHub Pages].

- Impacted Dependencies:
  ```
  gh-pages
  gitbook-cli
  rimraf
  ```

- Impacted Files:
  ```
  package.json ...... enhance docs dependencies -and- docs scripts
  book.json ......... GitBook configuration
  docs/ ............. master source of GitBook project docs
    toc.md .......... the summary TOC (seen in the left nav)
    intro.md ........ the Guide Introduction
    *.md ............ various Markdown files making up our docs
    sectionN/ ....... optional docs dirs (as required)
      *.md
    styles/
      website.css ... gitbook style overrides
  _book/ ............ machine generated docs (output of GitBook)
    *.html
    *.js
    *.css
  ```

**Installation Details**:

1. Install the [GitBook command-line interface]

   ```
   $ npm install --save-dev gitbook-cli
     + gitbook-cli@2.3.2
       added 577 packages from 672 contributors and audited 1234 packages in 32.693s
   ```

   KJB: Yikes: this is the same version installed 3 years ago (in feature-u).

   It has 10K downloads / week, but was last published 4 years ago ... hmmm

2. Define following doc-related project files

   **NOTE**: To find the installed gitbook version (referenced in `book.json` below):
   ```
   $ npx gitbook ls
     GitBook Versions Installed:
     * 3.2.2
       2.5.2
   ```

   ```
   book.json (GitBook configuration)
   =========
     {
       "gitbook":     "3.2.2",
       "root":        "./docs",
       "title":       "tw-themes",
       "description": "powerful tailwind color themes (dynamically selectable at run-time)",
       "author":      "Kevin J. Bridges <kevin@wiiBridges.com> (https://github.com/KevinAst)",
       "structure": { 
         "readme":  "intro.md",
         "summary": "toc.md" 
       }
     }

   docs/

     toc.md (defines the left-nav)
     ======
       # Table of content 
       
       ### tw-themes (0.1.0)
       * [Getting Started](start.md)
       
       ----

     intro.md (docs introduction)
     ========
       # tw-themes

       **tw-themes** is a tailwindcss utility that facilitates _**dynamic
       color themes that are selectable at run-time**_.

     start.md (our getting started)
     ========
       # Getting Started
       This is the **Getting Started** section.
       Here are some references to the [Introduction](intro.md)
       and [API](api.md).
   ```

3. Install gh-pages (used in npm scripts below)

   ```
   $ npm install --save-dev gh-pages
     + gh-pages@3.1.0
       added 28 packages from 10 contributors and audited 1262 packages in 10.237s
   ```

4. Install rimraf (used in npm scripts below)

   ```
   $ npm install --save-dev rimraf
     + rimraf@3.0.2
       updated 1 package and audited 1263 packages in 7.012s
   ```

5. Define the following **docs-related NPM scripts**:

   **package.json**:
   ```js
   ... snip snip
   "scripts": {
     ...
     "docs:build":            "gitbook build",
     "docs:serve":            "gitbook serve",
     "predocs:publish":       "npm run docs:build",
     "docs:publish":          "gh-pages --dist _book",
     "docs:gitbook:help":     "gitbook help",
     "docs:clean":            "rimraf _book"
     ...
   },
   ... snip snip
   ```

6. Prep/Initialize gitbook plugins.  This step is needed whenever you
   add gitbook plugins via `book.json`. As an example the `toolbar`
   plugin (mentioned below).

   ```
   $ npx gitbook install
         info: nothing to install!
               KJB: This command only needs to be run when gitbook plugins
                    are added to book.json
   ```

7. Serve up docs to test our setup

   ```
   $ npm run docs:serve
   ```

   And browse: http://localhost:4000/

   **Resolve Issues**
   ```
   - It appears that gitbook-cli is so old that it has issues running
     in a modern node/npm.

     Starting to question is gitbook is the best option for documentation
     ... at least in future projects

   - When running either "docs:build"/"docs:serve" receive follow error:
     $ npx gitbook build
       C:\dev\tw-themes\node_modules\npm\node_modules\graceful-fs\polyfills.js:287
             if (cb) cb.apply(this, arguments)
                        ^
       TypeError: cb.apply is not a function
           at C:\dev\tw-themes\node_modules\npm\node_modules\graceful-fs\polyfills.js:287:18
           at FSReqCallback.oncomplete (fs.js:184:5)

     * found several mentions of this:

       1. Gitbook-cli install error TypeError: cb.apply is not a function inside graceful-fs
          ... https://stackoverflow.com/questions/64211386/gitbook-cli-install-error-typeerror-cb-apply-is-not-a-function-inside-graceful
          * they talk about gitbook-cli working in node v12 and NOT in node v14
          * they install a newer version of graceful-fs@latest IN gitbook-cli
            $ cd /usr/local/lib/node_modules/gitbook-cli/node_modules/npm/node_modules/
            $ npm install graceful-fs@latest --save

       2. How I fixed a "cb.apply is not a function" error while using Gitbook
          ... https://flaviocopes.com/cb-apply-not-a-function/
          > a real hack:
          * this guy commented out code in node_modules:
            node_modules/gitbook-cli/node_modules/npm/node_modules/graceful-fs/polyfills.js

              >>> PUNT and DO THIS (this is how I got it working):
            - in MY case the problem code is found here:
              c:/dev/tw-themes/node_modules/npm/node_modules/graceful-fs/polyfills.js
              * comment out the lines 62-64:
                // KJB: HACK to fix STALE gitbook-cli (see: TOOLING.md)
                // fs.stat = statFix(fs.stat)
                // fs.fstat = statFix(fs.fstat)
                // fs.lstat = statFix(fs.lstat)
              * IT WORKS!

   - The docs server will crash when any docs files change.
     ... this was even happening when I developed my other project's docs.
     >>> JUST PUNT and live with this.
   ```

8. Follow customization suggestions found in [Integrating GitBook with
   JSDoc to Document Your Open Source Project].  

   Specifically:

   - Setup `docs/styles/website.css`
   - Disable livereload via "-livereload" option in "plugins" section of `book.json`
   - Disable social media sharing in toolbar via "-sharing" option in "plugins" section of `book.json`
   - Adding toolbar links to GitHub/NPM via "toolbar" plugin (configured in `book.json`).
     Don't forget to do your `$ npx gitbook install` to install the
     toolbar plugin referenced in `book.json`.

9. Install [`folding-menu`] GitBook plugin that "tames" large left-nav
   menus by visualizing one section at a time.

   - add following to `book.json`:

     **book.json**
     ```js
     {
       ...
       "plugins": [
         ... other plugins you may be using
         "folding-menu"
       ]
       ...
       "pluginsConfig": {
         "folding-menu": {
           "animationDuration": 500,
           "sticky":            false
         }
       }
     }
     ```

     There appears to be a bug in the folding-menu plugin "sticky" setting,
     where it is NOT informed of a top-level page change when done via a
     link.  As a result I have disabled this option ("sticky": false).

   - install the new plugins

     ```
     $ npx gitbook install
     
         info: installing 2 plugins using npm@3.9.2 
         info: installing plugin "toolbar" 
         info: install plugin "toolbar" (*) from NPM with version 0.6.0 
         info: >> plugin "toolbar" installed with success 
         info:  
         info: installing plugin "folding-menu" 
         info: install plugin "folding-menu" (*) from NPM with version 1.0.1 
         info: >> plugin "folding-menu" installed with success 
     
     > NOT (OLD):
     $ npm install --save-dev gitbook-plugin-folding-menu
     ```

<!--- *** SUB-SECTION *************************************************************** --->
# Setup js.org sub-domain

AI: retrofit (was copied from tw-themes)

To accommodate a more professional URL, [js.org] supports a
sub-domain registration process.

At the end of this process you should have:

- A github pages `js.org` sub-domain: 
  * FROM: https://kevinast.github.io/tw-themes/
  * TO:   https://tw-themes.js.org/

To accomplish this, simply follow the instructions on [js.org].  Here
is my summary _(more notes hidden here in comment form)_:

```
 - First setup a preliminary set of docs that are deployable to
   [GitHub Pages].  `js.org` requires "reasonable content" before
   they will approve your request.  Alternatively you can create
   some temporary content that shows your intent.


 - Create a CNAME file at gh-pages root.  In our case this will live
   in `docs/`:
   
   * docs/CNAME
     ==========
     tw-themes.js.org

   * Deploy your latest docs to [GitHub Pages]:

     ```
     $ npm run docs:publish
     ```

     NOTE: Once this is done, you will not be able to browse your gh-pages
           till js.org processes your PR (below).

 - Fork the `js.org` project and issue a PR to introduce our sub-domain
   * new entry in: cnames_active.js
     ... "tw-themes": "kevinast.github.io/tw-themes",

 - Monitor PR acceptance (will take 24 hrs).

 - Once complete the sub-domain should be active
```

<!--- Comment out KJB Notes

****************
* setup js.org * ... can be done FIRST OR LAST
****************

  - either setup a preliminary set of docs -or- put a dummy page in place
    ... needed to be accepted by js.org

    * following temporary html file:
      - NOTE: has to be "reasonable content"
              - per their README, their focus is on granting subdomain requests to
                projects with a clear relation to the JavaScript ecosystem and
                community (NOT personal pages, blogs, etc.).
              - Projects such as NPM packages, libraries, tools that have a clear
                direct relation to JavaScript, will be accepted when requesting a
                JS.ORG subdomain.
              - KJB: My experience is that by a) placing limited content in, and b) referencing other project docs and your README
                     IT WILL BE ACCEPTED

      _docs/index.html
      ================
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>tw-themes</title>
        </head>
        <body>
          <h1>tw-themes</h1>
      
          <p><i>... minimalist form validation with powerful results</i></p>
          <p>
            Validating forms has notoriously been a painful development
            experience. Implementing client side validation in a user friendly way
            is a tedious and arduous process • you want to validate fields only at
            the appropriate time (when the user has had the chance to enter the
            data) • you want to present validation errors in a pleasing way • you
            may need to apply custom validation (specific to your application
            domain) • etc.
          </p>
      
          <p>
            Even with the introduction of HTML5's Form Validation, it is still
            overly complex, and doesn't address many common scenarios (mentioned
            above). Without the proper approach, form validation can be one of the
            most difficult tasks in web development.
          </p>
      
          <p>
            This sub-domain is currently work-in-progress and will
            eventually hold BOTH the formal documentation and the deployed app
            <i>(similar to other projects under my control: e.g. <a href="http://feature-u.js.org/">http://feature-u.js.org/</a>)</i>
          </p>
      
          <p>
            For now you may wish to take a look at the initial <a href="https://github.com/KevinAst/tw-themes/blob/main/README.md">Design Docs</a>.
          </p>
      
        </body>
      </html>

    * deploy file to gh-pages
      $ npx gh-pages --dist _docs

    * test site
      ... https://KevinAst.github.io/tw-themes

  - setup the js.org sub-domain alias: https://tw-themes.js.org/
    ... see: c:/data/tech/dev/GitHub.txt (configure the js.org subdomain) ... prob a bit stale
    * KEY:  js.org offers sub-domain that points to GitHub Pages
    * NICE: https://tw-themes.js.org/
            https://kevinast.github.io/tw-themes

    * setup CNAME file at root and deploy to gh-pages
        CNAME
        =====
        tw-themes.js.org

       - issue a PR that adds my sub-domain to js.org
         * all done from the web
         * IF NEED BE (in lue of syncing old repo - which is a major deal), simply delete your copy of an old dns.js.org fork
           - from your github dns.js.org fork
           - click settings
           - at bottom click delete repository
         * from the github js-org/dns.js.org project
           ... https://github.com/js-org/js.org     <<< FYI: used to be dns.js.org
         * click the FORK button
           ... this adds the dns.js.org to MY github
           ... https://github.com/KevinAst/js.org    <<< FYI: used to be dns.js.org
             * via the web, edit the cnames_active.js file
             * add your entry:
                   "tw-themes": "kevinast.github.io/tw-themes",
             * check in commit:
               >>> KEY: use this description (they will change it to this if you don't):
               ... NOT: adding tw-themes sub-domain
               ... YES: tw-themes.js.org
             * issue New Pull Request
             * back in the dns.js.org, monitor your Pull Request
               ... https://github.com/js-org/js.org/pulls
                   https://github.com/js-org/js.org/pull/5555
               ... should take effect within 24 hrs
               - confirm: web site NO LONGER SERVES till they enact this
                 https://kevinast.github.io/tw-themes/
               - wait for sub-domain to go live (24 hrs)
                 * FIRST they will approve it
                 * THEN they will apply the domain
                 * ONCE ACCEPTED & MERGED 
                 * WORKS: should be able to now see the url:
                   ... https://tw-themes.js.org/

KJB Notes --->



<!--- *** SUB-SECTION *************************************************************** --->
# Setup Lib Packaging

AI: retrofit (was copied from tw-themes)

This task will setup the tooling needed to package and deploy the
**tw-themes** library to NPM.

Currently we use a very simple packaging process that employs babel
only.  In other words, no bundler is used _(such as webpack or
rollup)_.

**Links**: [How to publish a npm package?](https://www.robinwieruch.de/publish-npm-package-node)

At the end of this process you should have:

- The ability to deploy the **tw-themes** library to NPM.

- Impacted Dependencies:
  ```
  @babel/cli
  @babel/core
  @babel/preset-env
  ```

- Impacted Files:
  ```
  tw-themes/
    .gitignore
    package.json
    babel.config.js
  ```

**Installation Details**:

- Install required dependencies (Babel).

  **NOTE**: Some of these dependencies overlap with other setup (Install
  only what is missing):

  ```
  $ npm install --save-dev @babel/core @babel/preset-env @babel/cli
  ```

- modify `package.json` with deployment-specific fields:

  **package.json** _(leave comments out)_:
  ```js
  {
    "name": "tw-themes",    // the name of the npm package
    "version": "0.1.0",     // the npm package version

                            // referenced in npm registry
    "description": "powerful tailwind color themes (dynamically selectable at run-time)",
    "homepage": "https://tw-themes.js.org/",
    "repository": {
      "type": "git",
      "url": "https://github.com/KevinAst/tw-themes.git"
    },
    "bugs": {
      "url": "https://github.com/KevinAst/tw-themes/issues"
    },
    "keywords": [
      "tailwind",
      "themes",
      "theme",
      "dark",
      "dark-mode",
      "colors",
      "web",
      "utility",
      "geeku",
      "astx"
    ],
    "author": "Kevin J. Bridges <kevin@wiiBridges.com> (https://github.com/KevinAst)",
    "license": "MIT",

    "main": "lib/index.js", // references the generated library bundle

    "files": [              // resources to include in the NPM package
      "package.json",
      "LICENSE.md",
      "README.md",
      "lib",
      "src"
    ],

    ... snip snip
  }
  ```

- Configure Babel:

  **babel.config.js**:
  ```js
  module.exports = {
    presets: [
      "@babel/preset-env"
    ]
  }
  ```

- define a `src/.npmignore` to omit modules that should NOT
  be included in the bundle (ex: unit tests):

  **src/.npmignore**
  ```
  # do NOT publish any spec/ directory (unit tests spread throughout our src/ code base)
  spec
  ```

- Setup the **lib: NPM Scripts**:

  **package.json** _(leave comments out)_:
  ```js
  {
    ...

    "scripts": {
      ...

      "lib:build":    "babel src --out-dir lib --no-comments",

      "prelib:build": "npm run test", // don't build unless unit tests are OK

      "lib:clean":    "rimraf lib"

      "prepare":      "npm run lib:build", // run build before `$ npm publish`
    },

    ... snip snip
  }
  ```

- Adjust `.gitignore`:

  **.gitignore**
  ```
  # bundled NPM distribution (generated via "npm run lib:build")
  # ... currently only using /lib/
  /dist/
  /lib/
  /es/
  ```

- Verify a manual build:

  ```
  $ run npm lib:build # see results in `lib/` directory
  ```



<!--- *** SECTION *************************************************************** --->
# Deploy Project

AI: retrofit (was copied from tw-themes) ...

> ?? for this, simply a brief mention that: because our client is packaged in our server URL, it's deployment is part of the server

This section chronicles the steps in deploying **tw-themes** to NPM.

**Feature Branch**:

Typically all development is done in a **feature branch**.  If you are
about to deploy, presumably your branch is complete and documented.

1. insure all tests are operational

   ```
   $ npm run test
   ```

2. finalize version -and- history notes:

   - for the new version, use [semantic standards](http://semver.org/)

   - update version in:
     * `package.json`
     * `docs/toc.md` (version is referenced at top)
     * `docs/history.md` (within the "running" notes)

   - review/finalize all documentation impacted by change
     * also insure README.md does NOT need to change

   - optionally: save a link-neutral version of change history comments (to use in git tagging)
     * pull from history.md _(normalizing any reference links)_
     * ALTERNATE: simply reference the documentation history section (in the git tag)

       EX: https://tw-themes.js.org/history.html#v0_1_0

**main Branch**:

1. issue PR (pull request) and merge to main branch

2. sync main to local machine (where the deployment will occur)

3. verify version is correct in:
   * `package.json`
   * `docs/toc.md`
   * `docs/history.md`

4. now, everything should be checked in to main and ready to publish

5. tag the release (in github)
   * verify the history page github links are correct (now that the tag exists)

6. publish **tw-themes** to npm **_(THIS IS IT!)_**:

   ```
    $ npm publish
      + tw-themes@v.v.v
   ```

   verify publish was successful
   - receive email from npm
   - npm package: https://www.npmjs.com/package/tw-themes
   - unpkg.com:   https://unpkg.com/tw-themes/

7. publish **tw-themes** documentation:

   ```
   $ npm run docs:publish
   ```
  
   verify publish docs was successful
   - https://tw-themes.js.org/
     * see new version
     * see correct history

8. optionally test the new package in an external project (by installing it)


<!--- *** SECTION *************************************************************** --->
# Setup New Feature Branch

AI: retrofit (was copied from tw-themes)

This section documents the steps to setup a new **feature branch**
(where all development is typically done):

1. create a new branch (typically spawned from the "main" branch).

   **EX**: `next7`

2. devise "best guess" as to the next version number _(may be
   premature, but this can subsequently change)_.

   Reflect this in: 
   * `package.json`
   * `docs/toc.md` (version is referenced at top)
   * `docs/history.md` (within the "running" notes)

3. setup new running Revision History (in `docs/history.md`)

   This provides a place where we can incrementally maintain "running"
   revision notes.




<!--- *** LINKS ***************************************************************** --->

[NPM Scripts]:                    #npm-scripts
[Dependencies]:                   #dependencies
[Project Resources]:              #project-resources
[Project Setup]:                  #project-setup
  [Setup GitHub Project]:         #setup-github-project
  [Setup Client Monorepo]:        #setup-client-monorepo
  [Initialize NPM Project]:       #initialize-npm-project
  [Two SPAs in One]:              #two-spas-in-one
  [Setup Unit Testing]:           #setup-unit-testing
  [Setup Docs Tooling]:           #setup-docs-tooling
  [Setup js.org sub-domain]:      #setup-jsorg-sub-domain
  [Setup Lib Packaging]:          #setup-lib-packaging
[Deploy Project]:                 #deploy-project
[Setup New Feature Branch]:       #setup-new-feature-branch

[IDE]:                            https://en.wikipedia.org/wiki/Integrated_development_environment
[SPA]:                            https://en.wikipedia.org/wiki/Single-page_application
[vite]:                           https://vitejs.dev/
[Vite Docs]:                      https://vitejs.dev/guide/
[Svelte]:                         https://svelte.dev/
[Svelte Getting Started]:         https://svelte.dev/docs#getting-started

<!--- ?? following from template ... may NOT be used --->
[js.org]:                         https://js.org/
[npm]:                            https://www.npmjs.com/
[Tailwind CSS]:                   https://tailwindcss.com/

[GitHub Pages]:                   https://pages.github.com/

[GitBook]:                         https://docs.gitbook.com/
[GitBook command-line interface]:  https://www.npmjs.com/package/gitbook-cli
[Markdown]:                        https://en.wikipedia.org/wiki/Markdown
[Integrating GitBook with JSDoc to Document Your Open Source Project]: https://medium.com/@kevinast/integrate-gitbook-jsdoc-974be8df6fb3
[`folding-menu`]:                  https://github.com/KevinAst/gitbook-plugin-folding-menu
