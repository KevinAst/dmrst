
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty$1() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.50.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    // taken from: https://github.com/flexdinesh/browser-or-node
    const inBrowser =
      typeof window !== "undefined" &&
      typeof window.document !== "undefined";

    typeof process !== "undefined" &&
      process.versions != null &&
      process.versions.node != null;

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    /**
     * Helpers.
     */
    var s = 1000;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;

    /**
     * Parse or format the given `val`.
     *
     * Options:
     *
     *  - `long` verbose formatting [false]
     *
     * @param {String|Number} val
     * @param {Object} [options]
     * @throws {Error} throw an error if val is not a non-empty string or a number
     * @return {String|Number}
     * @api public
     */

    var ms = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === 'string' && val.length > 0) {
        return parse$1(val);
      } else if (type === 'number' && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        'val is not a non-empty string or a valid number. val=' +
          JSON.stringify(val)
      );
    };

    /**
     * Parse the given `str` and return milliseconds.
     *
     * @param {String} str
     * @return {Number}
     * @api private
     */

    function parse$1(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || 'ms').toLowerCase();
      switch (type) {
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
          return n * y;
        case 'weeks':
        case 'week':
        case 'w':
          return n * w;
        case 'days':
        case 'day':
        case 'd':
          return n * d;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
          return n * h;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
          return n * m;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
          return n * s;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
          return n;
        default:
          return undefined;
      }
    }

    /**
     * Short format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + 'd';
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + 'h';
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + 'm';
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + 's';
      }
      return ms + 'ms';
    }

    /**
     * Long format for `ms`.
     *
     * @param {Number} ms
     * @return {String}
     * @api private
     */

    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, 'day');
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, 'hour');
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, 'minute');
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, 'second');
      }
      return ms + ' ms';
    }

    /**
     * Pluralization helper.
     */

    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
    }

    /**
     * This is the common logic for both the Node.js and web browser
     * implementations of `debug()`.
     */

    function setup(env) {
    	createDebug.debug = createDebug;
    	createDebug.default = createDebug;
    	createDebug.coerce = coerce;
    	createDebug.disable = disable;
    	createDebug.enable = enable;
    	createDebug.enabled = enabled;
    	createDebug.humanize = ms;
    	createDebug.destroy = destroy;

    	Object.keys(env).forEach(key => {
    		createDebug[key] = env[key];
    	});

    	/**
    	* The currently active debug mode names, and names to skip.
    	*/

    	createDebug.names = [];
    	createDebug.skips = [];

    	/**
    	* Map of special "%n" handling functions, for the debug "format" argument.
    	*
    	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
    	*/
    	createDebug.formatters = {};

    	/**
    	* Selects a color for a debug namespace
    	* @param {String} namespace The namespace string for the debug instance to be colored
    	* @return {Number|String} An ANSI color code for the given namespace
    	* @api private
    	*/
    	function selectColor(namespace) {
    		let hash = 0;

    		for (let i = 0; i < namespace.length; i++) {
    			hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
    			hash |= 0; // Convert to 32bit integer
    		}

    		return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    	}
    	createDebug.selectColor = selectColor;

    	/**
    	* Create a debugger with the given `namespace`.
    	*
    	* @param {String} namespace
    	* @return {Function}
    	* @api public
    	*/
    	function createDebug(namespace) {
    		let prevTime;
    		let enableOverride = null;
    		let namespacesCache;
    		let enabledCache;

    		function debug(...args) {
    			// Disabled?
    			if (!debug.enabled) {
    				return;
    			}

    			const self = debug;

    			// Set `diff` timestamp
    			const curr = Number(new Date());
    			const ms = curr - (prevTime || curr);
    			self.diff = ms;
    			self.prev = prevTime;
    			self.curr = curr;
    			prevTime = curr;

    			args[0] = createDebug.coerce(args[0]);

    			if (typeof args[0] !== 'string') {
    				// Anything else let's inspect with %O
    				args.unshift('%O');
    			}

    			// Apply any `formatters` transformations
    			let index = 0;
    			args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
    				// If we encounter an escaped % then don't increase the array index
    				if (match === '%%') {
    					return '%';
    				}
    				index++;
    				const formatter = createDebug.formatters[format];
    				if (typeof formatter === 'function') {
    					const val = args[index];
    					match = formatter.call(self, val);

    					// Now we need to remove `args[index]` since it's inlined in the `format`
    					args.splice(index, 1);
    					index--;
    				}
    				return match;
    			});

    			// Apply env-specific formatting (colors, etc.)
    			createDebug.formatArgs.call(self, args);

    			const logFn = self.log || createDebug.log;
    			logFn.apply(self, args);
    		}

    		debug.namespace = namespace;
    		debug.useColors = createDebug.useColors();
    		debug.color = createDebug.selectColor(namespace);
    		debug.extend = extend;
    		debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.

    		Object.defineProperty(debug, 'enabled', {
    			enumerable: true,
    			configurable: false,
    			get: () => {
    				if (enableOverride !== null) {
    					return enableOverride;
    				}
    				if (namespacesCache !== createDebug.namespaces) {
    					namespacesCache = createDebug.namespaces;
    					enabledCache = createDebug.enabled(namespace);
    				}

    				return enabledCache;
    			},
    			set: v => {
    				enableOverride = v;
    			}
    		});

    		// Env-specific initialization logic for debug instances
    		if (typeof createDebug.init === 'function') {
    			createDebug.init(debug);
    		}

    		return debug;
    	}

    	function extend(namespace, delimiter) {
    		const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
    		newDebug.log = this.log;
    		return newDebug;
    	}

    	/**
    	* Enables a debug mode by namespaces. This can include modes
    	* separated by a colon and wildcards.
    	*
    	* @param {String} namespaces
    	* @api public
    	*/
    	function enable(namespaces) {
    		createDebug.save(namespaces);
    		createDebug.namespaces = namespaces;

    		createDebug.names = [];
    		createDebug.skips = [];

    		let i;
    		const split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
    		const len = split.length;

    		for (i = 0; i < len; i++) {
    			if (!split[i]) {
    				// ignore empty strings
    				continue;
    			}

    			namespaces = split[i].replace(/\*/g, '.*?');

    			if (namespaces[0] === '-') {
    				createDebug.skips.push(new RegExp('^' + namespaces.slice(1) + '$'));
    			} else {
    				createDebug.names.push(new RegExp('^' + namespaces + '$'));
    			}
    		}
    	}

    	/**
    	* Disable debug output.
    	*
    	* @return {String} namespaces
    	* @api public
    	*/
    	function disable() {
    		const namespaces = [
    			...createDebug.names.map(toNamespace),
    			...createDebug.skips.map(toNamespace).map(namespace => '-' + namespace)
    		].join(',');
    		createDebug.enable('');
    		return namespaces;
    	}

    	/**
    	* Returns true if the given mode name is enabled, false otherwise.
    	*
    	* @param {String} name
    	* @return {Boolean}
    	* @api public
    	*/
    	function enabled(name) {
    		if (name[name.length - 1] === '*') {
    			return true;
    		}

    		let i;
    		let len;

    		for (i = 0, len = createDebug.skips.length; i < len; i++) {
    			if (createDebug.skips[i].test(name)) {
    				return false;
    			}
    		}

    		for (i = 0, len = createDebug.names.length; i < len; i++) {
    			if (createDebug.names[i].test(name)) {
    				return true;
    			}
    		}

    		return false;
    	}

    	/**
    	* Convert regexp to namespace
    	*
    	* @param {RegExp} regxep
    	* @return {String} namespace
    	* @api private
    	*/
    	function toNamespace(regexp) {
    		return regexp.toString()
    			.substring(2, regexp.toString().length - 2)
    			.replace(/\.\*\?$/, '*');
    	}

    	/**
    	* Coerce `val`.
    	*
    	* @param {Mixed} val
    	* @return {Mixed}
    	* @api private
    	*/
    	function coerce(val) {
    		if (val instanceof Error) {
    			return val.stack || val.message;
    		}
    		return val;
    	}

    	/**
    	* XXX DO NOT USE. This is a temporary stub function.
    	* XXX It WILL be removed in the next major release.
    	*/
    	function destroy() {
    		console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    	}

    	createDebug.enable(createDebug.load());

    	return createDebug;
    }

    var common = setup;

    /* eslint-env browser */

    var browser = createCommonjsModule(function (module, exports) {
    /**
     * This is the web browser implementation of `debug()`.
     */

    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = (() => {
    	let warned = false;

    	return () => {
    		if (!warned) {
    			warned = true;
    			console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    		}
    	};
    })();

    /**
     * Colors.
     */

    exports.colors = [
    	'#0000CC',
    	'#0000FF',
    	'#0033CC',
    	'#0033FF',
    	'#0066CC',
    	'#0066FF',
    	'#0099CC',
    	'#0099FF',
    	'#00CC00',
    	'#00CC33',
    	'#00CC66',
    	'#00CC99',
    	'#00CCCC',
    	'#00CCFF',
    	'#3300CC',
    	'#3300FF',
    	'#3333CC',
    	'#3333FF',
    	'#3366CC',
    	'#3366FF',
    	'#3399CC',
    	'#3399FF',
    	'#33CC00',
    	'#33CC33',
    	'#33CC66',
    	'#33CC99',
    	'#33CCCC',
    	'#33CCFF',
    	'#6600CC',
    	'#6600FF',
    	'#6633CC',
    	'#6633FF',
    	'#66CC00',
    	'#66CC33',
    	'#9900CC',
    	'#9900FF',
    	'#9933CC',
    	'#9933FF',
    	'#99CC00',
    	'#99CC33',
    	'#CC0000',
    	'#CC0033',
    	'#CC0066',
    	'#CC0099',
    	'#CC00CC',
    	'#CC00FF',
    	'#CC3300',
    	'#CC3333',
    	'#CC3366',
    	'#CC3399',
    	'#CC33CC',
    	'#CC33FF',
    	'#CC6600',
    	'#CC6633',
    	'#CC9900',
    	'#CC9933',
    	'#CCCC00',
    	'#CCCC33',
    	'#FF0000',
    	'#FF0033',
    	'#FF0066',
    	'#FF0099',
    	'#FF00CC',
    	'#FF00FF',
    	'#FF3300',
    	'#FF3333',
    	'#FF3366',
    	'#FF3399',
    	'#FF33CC',
    	'#FF33FF',
    	'#FF6600',
    	'#FF6633',
    	'#FF9900',
    	'#FF9933',
    	'#FFCC00',
    	'#FFCC33'
    ];

    /**
     * Currently only WebKit-based Web Inspectors, Firefox >= v31,
     * and the Firebug extension (any Firefox version) are known
     * to support "%c" CSS customizations.
     *
     * TODO: add a `localStorage` variable to explicitly enable/disable colors
     */

    // eslint-disable-next-line complexity
    function useColors() {
    	// NB: In an Electron preload script, document will be defined but not fully
    	// initialized. Since we know we're in Chrome, we'll just detect this case
    	// explicitly
    	if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
    		return true;
    	}

    	// Internet Explorer and Edge do not support colors.
    	if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    		return false;
    	}

    	// Is webkit? http://stackoverflow.com/a/16459606/376773
    	// document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    	return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    		// Is firebug? http://stackoverflow.com/a/398120/376773
    		(typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    		// Is firefox >= v31?
    		// https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    		// Double check webkit in userAgent just in case we are in a worker
    		(typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
    }

    /**
     * Colorize log arguments if enabled.
     *
     * @api public
     */

    function formatArgs(args) {
    	args[0] = (this.useColors ? '%c' : '') +
    		this.namespace +
    		(this.useColors ? ' %c' : ' ') +
    		args[0] +
    		(this.useColors ? '%c ' : ' ') +
    		'+' + module.exports.humanize(this.diff);

    	if (!this.useColors) {
    		return;
    	}

    	const c = 'color: ' + this.color;
    	args.splice(1, 0, c, 'color: inherit');

    	// The final "%c" is somewhat tricky, because there could be other
    	// arguments passed either before or after the %c, so we need to
    	// figure out the correct index to insert the CSS into
    	let index = 0;
    	let lastC = 0;
    	args[0].replace(/%[a-zA-Z%]/g, match => {
    		if (match === '%%') {
    			return;
    		}
    		index++;
    		if (match === '%c') {
    			// We only are interested in the *last* %c
    			// (the user may have provided their own)
    			lastC = index;
    		}
    	});

    	args.splice(lastC, 0, c);
    }

    /**
     * Invokes `console.debug()` when available.
     * No-op when `console.debug` is not a "function".
     * If `console.debug` is not available, falls back
     * to `console.log`.
     *
     * @api public
     */
    exports.log = console.debug || console.log || (() => {});

    /**
     * Save `namespaces`.
     *
     * @param {String} namespaces
     * @api private
     */
    function save(namespaces) {
    	try {
    		if (namespaces) {
    			exports.storage.setItem('debug', namespaces);
    		} else {
    			exports.storage.removeItem('debug');
    		}
    	} catch (error) {
    		// Swallow
    		// XXX (@Qix-) should we be logging these?
    	}
    }

    /**
     * Load `namespaces`.
     *
     * @return {String} returns the previously persisted debug modes
     * @api private
     */
    function load() {
    	let r;
    	try {
    		r = exports.storage.getItem('debug');
    	} catch (error) {
    		// Swallow
    		// XXX (@Qix-) should we be logging these?
    	}

    	// If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    	if (!r && typeof process !== 'undefined' && 'env' in process) {
    		r = process.env.DEBUG;
    	}

    	return r;
    }

    /**
     * Localstorage attempts to return the localstorage.
     *
     * This is necessary because safari throws
     * when a user disables cookies/localstorage
     * and you attempt to access it.
     *
     * @return {LocalStorage}
     * @api private
     */

    function localstorage() {
    	try {
    		// TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
    		// The Browser also has localStorage in the global context.
    		return localStorage;
    	} catch (error) {
    		// Swallow
    		// XXX (@Qix-) should we be logging these?
    	}
    }

    module.exports = common(exports);

    const {formatters} = module.exports;

    /**
     * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
     */

    formatters.j = function (v) {
    	try {
    		return JSON.stringify(v);
    	} catch (error) {
    		return '[UnexpectedJSONParseError]: ' + error.message;
    	}
    };
    });

    // our cache of logs
    // ... optimizing functional logging probes (that are re-created on each function invocation)
    const _cachedLogs = {}; // KEY: namespace, VALUE: log

    const log$c = logger('vit:core:logger'); // talk about eating our own dog food :-)

    // SEE: README.md for full documentation
    function logger(namespace) {

      // short-circut request if already created
      // ... optimizing functional logging probes (that are re-created on each function invocation)
      if (_cachedLogs[namespace]) {
        log$c(`re-using log with namespace: '${namespace}'`);
        return _cachedLogs[namespace];
      }

      // 1st logger: normal expected logger (returned in our function)
      //             Sample namespace: 'myProj:myModule:myFunct'
      const rtnLog = _cachedLogs[namespace] = browser(namespace);

      // 2nd logger: verbose (exposed via log.v -or- log.verbose)
      //             Sample namespace: 'myProj-v:myModule:myFunct'
      const colonIndx = namespace.indexOf(':');
      const verboseNameSpace = colonIndx === -1 ? `v-${namespace}` : namespace.substring(0, colonIndx) + '-v' + namespace.substring(colonIndx);
      const verbose = browser(verboseNameSpace);
      rtnLog.verbose = rtnLog.v = verbose;

      // 3rd logger: force (exposed via log.f -or- log.force)
      //             Sample namespace: 'myProj:myModule:myFunct' <<< same as original
      const force = browser(namespace);
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

    log$c.f(`our currentLogFilters: '${_currentLogFilters}'`);

    // is the log filter enabled for the given nameSpace
    // RETURNS boolean
    //         should consistently return SAME as log.enabled property (of same nameSpace)
    logger.isLogFilterEnabled = function(nameSpace) {
      // simple layer on top of ...
      return browser.enabled(nameSpace);
    };

    // alter our global log filter
    // RETURNS void
    logger.setLogFilters = function (filterStr) {
      _currentLogFilters = filterStr;
      browser.enable(filterStr); // I tested debug.enable(filterStr) and it ALWAYS returns void (i.e. undefined) IN ALL CASES (even with nothing passed in)
    };

    // clear our global log filter
    // RETURNS string: priorFilter
    logger.clearLogFilters = function() {
      return _currentLogFilters = browser.disable(); // ... simple layer on top of
    };

    // return the current global log filter
    // RETURNS string: filterStr
    logger.currentLogFilters = function() {
      return _currentLogFilters;
    };






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

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    //***

    let timeout = null;

    function createAlert() {
    	const {subscribe, set, update} = writable(''); // empty string for NO alert

    	return {
    		subscribe,
        display: (msg) => {
          clearTimeout(timeout);                    // clear prior timeout (if any)
          set(msg);                                 // display current msg
          timeout = setTimeout(()=> set(''), 5000); // clear msg in 5 seconds
        },
    	};
    }

    // our alert
    // ... a Svelte store
    const alert$1 = createAlert();

    //***
    logger('vit:core:socketIOUtils'); 

    /**
     * socketActFn(): Emits a re-usable function (with access to the
     *                supplied resolve/reject promise artifacts) that
     *                provides a standard way to acknowledge a return
     *                value (and errors) within an asynchronous promise
     *                wrapping a socket.io event (i.e. implementing an
     *                asynchronous request/response API)
     *
     * return:        function ack({value, errMsg, userMsg}): void
     *                - all named params are mutually exclusive
     *                  * value:   emits the supplied value
     *                  * errMsg:  throws an "unexpected" error
     *                  * userMsg: throws an "expected" error (with an embedded userMsg)
     *                - when ALL params are omitted:
     *                  * a void value is emitted (i.e. undefined)
     *
     * USAGE:         CLIENT (sign-in sample):
     *                  export function signIn(userId, pass) {
     *                    // promise wrapper of our socket message protocol
     *                    return new Promise((resolve, reject) => {
     *                      // issue the 'sign-in' socket request to our server
     *                      socket.emit('sign-in', userId, pass, socketAckFn(resolve, reject));
     *                    });
     *                  }
     *                SERVER (sign-in sample):
     *                  socket.on('sign-in', (userId, pass, ack) => {
     *                    ... snip snip (app-specific logic)
     *                    
     *                    // report expected user msg
     *                    return ack({userMsg: 'password incorrect',
     *                                errMsg:  'User Error in sign-in process'});
     *                    
     *                    // report unexpected error
     *                    return ack({errMsg: 'a bad thing happened'});
     *                    
     *                    // communicate successful value
     *                    return ack({value: myResult});
     *                    
     *                    // communicate void value
     *                    return ack();
     *                  });
     * 
     * NOTE:          This utility REQUIRES the activation of ErrorExtensionPolyfill.js
     *                (see Error#defineUserMsg() usage - below).
     */
    function socketAckFn(resolve, reject) {

      // confirm that ErrorExtensionPolyfill has been enabled
      if (!Error.prototype.defineUserMsg) {
        throw new Error('*** ERROR *** socketAckFn() requires the activation of ErrorExtensionPolyfill.js');
      }

      // emit our socket acknowledgment function
      return ({value=undefined, errMsg=undefined, userMsg=undefined}={}) => {
        commonPayloadHandler(resolve, reject, value, errMsg, userMsg);
      }
    }

    function commonPayloadHandler(resolve, reject, value, errMsg, userMsg) {
      // emit an "expected" error (with .defineUserMsg())
      // ... in addition to userMsg, this will supplement any supplied errMsg
      if (userMsg) {
        reject( new Error(errMsg || 'Expected User Defined Condition').defineUserMsg(userMsg) );
      }
      // emit an "unexpected" error
      else if (errMsg) {
        reject( new Error(errMsg) );
      }
      // emit a successful value
      // ... can be an undefined value (for void)
      else {
        resolve(value);
      }
    }

    //***
    const  log$b = logger('vit:client:auth'); 

    let socket$5;  // our active socket (to be used in this module)

    function registerAuthSocketHandlers(_socket) {
      log$b('here we are in registerAuthSocketHandlers');

      // expose socket to this module
      socket$5 = _socket;

      // AI: may also have some listeners to register too
    }

    // convenience signIn utility wrapping the socket protocol with an async request/response
    // RETURN: promise string (user error msg, falsy for successfully signed-in)
    function signIn(userId, pass) {
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'sign-in' socket request to our server
        socket$5.emit('sign-in', userId, pass, socketAckFn(resolve, reject));
      });
    }

    // convenience signOut utility wrapping the socket protocol with an async request/response
    // RETURN: promise void
    function signOut() {
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'sign-out' socket request to our server
        socket$5.emit('sign-out', (errMsg) => {
          // within our acknowledgment callback
          //   response: errMsg <string>, where:
          //    - 'any' - NOT signed-out, errMsg to be wrapped in Error (unexpected condition)
          //    - ''    - falsey: sign-out successful
          if (errMsg) {
            reject(new Error(errMsg)); // an unexpected error
          }
          else {
            resolve(undefined); // successful sign-out ... void (i.e. undefined)
          }
        });
      });
    }

    //***
    const  log$a = logger('vit:client:user');

    function createUser() {
    	const {subscribe, set, update} = writable({userId: null}); // null for signed-out

    	return {
    		subscribe,
        activateUser: (userId) => {
          log$a(`activating userId: ${userId}`);
          update(state => ({userId}));
          localStorage.setItem('vitUserId', userId);
          alert$1.display(`Welcome ${userId} :-)`);
        },
        deactivateUser: () => {
          log$a(`deactivating user`);
          update(state => ({userId: null}));
          localStorage.removeItem('vitUserId');
          alert$1.display(`Now signed out - come back soon :-)`);
        },
    	};
    }

    // our current active user
    // ... a Svelte store
    const user = createUser();

    // auto sign-in if userId retained in localStorage
    // ... keeps server in-sync
    // ... very crude for now
    // ... timeout is crude way of allowing our socket initialization to stabalize :-(
    setTimeout(() => {
      const userId = localStorage.getItem('vitUserId'); // userId retained in localStorage
      if (userId) {
        log$a(`found persistent userId: ${userId} in localStorage ... activating auto sign-in.`);
        signIn(userId, 'a'); // hack: this is async, however we know it "should be" successful
        user.activateUser(userId);
      }
    }, 1); // very short time (1 ms), supporting next event cycle

    /* src\IDE.svelte generated by Svelte v3.50.1 */
    const file$d = "src\\IDE.svelte";

    // (13:6) {:else}
    function create_else_block$3(ctx) {
    	let b;
    	let t1;
    	let i;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "WITHOUT";
    			t1 = text(" the ability to publish your package ");
    			i = element("i");
    			i.textContent = "(you must sign-in for that)";
    			add_location(b, file$d, 13, 8, 295);
    			add_location(i, file$d, 13, 59, 346);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, i, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(i);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(13:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (11:6) {#if $user.userId}
    function create_if_block$4(ctx) {
    	let b;
    	let t1;
    	let i;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "WITH";
    			t1 = text(" the ability to publish your package ");
    			i = element("i");
    			i.textContent = "(because you have signed-in)";
    			add_location(b, file$d, 11, 8, 187);
    			add_location(i, file$d, 11, 56, 235);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, i, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(i);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(11:6) {#if $user.userId}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let div;
    	let center;
    	let h4;
    	let t1;
    	let p;
    	let t2;
    	let br;
    	let t3;

    	function select_block_type(ctx, dirty) {
    		if (/*$user*/ ctx[0].userId) return create_if_block$4;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			center = element("center");
    			h4 = element("h4");
    			h4.textContent = "IDE";
    			t1 = space();
    			p = element("p");
    			t2 = text("Do normal editing of packages here.\r\n      ");
    			br = element("br");
    			t3 = space();
    			if_block.c();
    			add_location(h4, file$d, 6, 4, 75);
    			add_location(br, file$d, 9, 6, 147);
    			add_location(p, file$d, 7, 4, 93);
    			add_location(center, file$d, 5, 2, 61);
    			add_location(div, file$d, 4, 0, 52);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, center);
    			append_dev(center, h4);
    			append_dev(center, t1);
    			append_dev(center, p);
    			append_dev(p, t2);
    			append_dev(p, br);
    			append_dev(p, t3);
    			if_block.m(p, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(p, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let $user;
    	validate_store(user, 'user');
    	component_subscribe($$self, user, $$value => $$invalidate(0, $user = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IDE', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<IDE> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ user, $user });
    	return [$user];
    }

    class IDE extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IDE",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    //***
    const  log$9 = logger('vit:client:systemIO'); 

    let socket$4;  // our active socket (to be used in this module)

    function registerSystemSocketHandlers(_socket) {
      log$9('here we are in registerSystemSocketHandlers');

      // expose socket to this module
      socket$4 = _socket;

      //***
      //*** register our system-based client-side event listeners
      //***

      // NOTE: currently all system-based client-side event listeners are
      //       registered directly in the system store (see system.js)

    }

    // launch/create a system, allowing participants to join (a request/response API)
    // ... invoked by host
    // ... this is a convenience function wrapping the socket protocol with an async request/response
    // RETURN: void ... successful creation of new system
    // ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
    function launchSystem$1(sysId,      // system identifier -and- alias to room (must be unique on server or will error)
                                 accessCode, // access key to be able to join system (a lite password)
                                 model) {    // our data model (JSON key/value)
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'launch-system' socket request to our server
        socket$4.emit('launch-system', sysId, accessCode, model, socketAckFn(resolve, reject));
      });
    }

    // join a system, by participants other than host (a request/response API)
    // ... invoked by non-host
    // ... this is a convenience function wrapping the socket protocol with an async request/response
    // RETURN: model ... the data model (JSON key/value) of successfully joined system
    // ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
    function joinSystem$1(sysId,        // system identifier -and- alias to room (must be unique on server or will error)
                               accessCode) { // access key to be able to join system (a lite password)
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'join-system' socket request to our server
        socket$4.emit('join-system', sysId, accessCode, socketAckFn(resolve, reject));
      });
    }

    // start a system running
    // ... invoked by either host or non-host
    // ... this is a convenience function wrapping the socket protocol with an async request/response
    // RETURN: void
    // ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
    function runSystem$1(sysId) { // system identifier
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'run-system' socket request to our server
        socket$4.emit('run-system', sysId, socketAckFn(resolve, reject));
      });
    }

    // pause a running system
    // ... invoked by either host or non-host
    // ... this is a convenience function wrapping the socket protocol with an async request/response
    // RETURN: void
    // ERROR:  may contain a userMsg (expected condition), or a hard-error (unexpected condition)
    function pauseSystem$1(sysId) { // system identifier
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'pause-system' socket request to our server
        socket$4.emit('pause-system', sysId, socketAckFn(resolve, reject));
      });
    }

    //***
    const  log$8 = logger('vit:client:system');


    // ********************************************************************************
    // create/catalog our client-side system store (an internal -and- reusable routine)
    // RETURN: system (a reactive store)
    function createSystemStore(sysId, accessCode, model, isHost, isRunning=false) {

      // our standard svelte store holding our state
    	const {subscribe, update} = writable({
        sysId,            // system identifier -and- alias to room (must be unique on server or will error)
      //accessCode,       // access code to join system (a lite password) ... L8TR: suspect only needed on server
        isHost,           // boolean: true - host, false - participant
        participants: [/*userId, ...*/], // all active participants in this system ... dynamically maintained when join/leave
        isRunning,        // indicator of whether the system is running
        model,
      });

      // our custom store with value-added methods
    	const system = {
    		subscribe, // makes this a store (i.e. a custom store)

        // value-added store methods follow:

        // update the running status of self
        // INITIATED BY: the server's 'run-system' / 'pause-system' process
        runChanged: (running) => {
          update(state => ( {...state, isRunning: running} ));
        },

        // update the active set of participants
        // INITIATED BY: the server's sysId/room join/leave events
        participantsChanged: (participants) => {
          update(state => ( {...state, participants} ));
        },

        // update self's store value with the supplied delta changes
        // INITIATED BY: the server's runSystem() process
        // SOURCE: the source of these changes can be any of the participants who have joined the System
        // RETURN: void
        stateChanged: (deltaModelChanges) => { // ex: { 'R1.pres': 1210, ... }
          update( state => {
            // make a deep copy of model
            // ... https://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-deep-clone-an-object-in-javascript
            const newModel = structuredClone(state.model);

            // apply delta changes
            // ... use a simple patteren, restricted to what we know we have
            Object.entries(deltaModelChanges).forEach(([key, val]) => {
              const [compKey, propKey] = key.split('.');
              newModel[compKey][propKey] = val;
            });

            return {...state, model: newModel};
          });
        },

        // our local state change cache, to be reflected to ALL participants (synced via our tick processor)
        localStateChange: {}, // ex: { 'R1.open': true, ... }

        // cache local changes to our state, to be reflected to ALL participants (synced via our tick processor)
        // INITIATED BY: our local interactive components (when user makes direct state change)
        // NOTE: an arrow function IS NOT used (supporting proper this connotation)
        cacheLocalStateChange(key, val) { // ex: key: 'R1.open', val: true
          this.localStateChange[key] = val;
        },

        // extract (return & clear) the local state change cache
        // RETURN: localStateChange ... ex: { 'R1.open': true, ... }
        extractLocalStateChange() {
          const localStateChange = this.localStateChange;
          this.localStateChange = {};
          return localStateChange;
        },

        // can't think of real example:
        // pseudo example where we interact with server
        foo: () => { // can't think of anything right now
          // ... either do a direct socket.emit(...) -or- a systemIO.js req/res
        },
      };

      // catalog this new system
      clientSystems.set(sysId, system);

      // that's all folks
      return system;
    }


    // ********************************************************************************
    // launch (i.e. create) a new system store (cataloged locally -and- on
    // server), which is available for external participants to join.
    // RETURN: newly created system reactive store (cataloged)
    // ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
    async function launchSystem(sysId,      // system identifier -and- alias to room (must be unique on server or will error)
                                       accessCode, // access code to join system (a lite password)
                                       model) {    // data model of this system, supplied by initiating host (JSON key/value pairs)

      logger('vit:client:system:launchSystem');

      // verify system does NOT already exist
      // ... this is our client cache check (similar error can occur on server cache)
      // AI: although this works, I'm thinking we simply utilize the server validation exclusively
      // if (getSystem(sysId)) {
      //   log(`local client cache found system '${sysId}' ... erroring out`);
      //   // THIS - NO: this seemed to be a wild goose chase (due to a sepereate app bug)
      //   //? BECAUSE OUR FUNCT IS ASYNC, we must return error differently
      //   //? return Promise.reject( // for ease of client usage, consistently deal with async errors only ... https://makandracards.com/makandra/43653-javascript-don-t-throw-exceptions-from-async-functions
      //   //?   new Error('*** USER ERROR *** in "launchSystem()" function')
      //   //?     .defineUserMsg(`system: '${sysId}' already exists (in client cache)`)
      //   //? );
      //   // OR THiS - BOTH SEEM TO WORK ... I think this was a wild goose chase (due to a sepereate app bug)
      //   throw new Error('*** USER ERROR *** in "launchSystem()" function')
      //     .defineUserMsg(`system '${sysId}' already exists (in client cache)`);
      // }

      // launch server-side system, insuring it is valid
      // NOTE: errors are passed-through to our invoker
      //       EX: - Expected Error: system: {sysId} already exists
      await launchSystem$1(sysId, accessCode, model);

      // create/return our client-side reactive system store
      return createSystemStore(sysId, accessCode, model, true /*isHost*/);
    }

    // ********************************************************************************
    // join an existing system from the server, cataloged locally (i.e. created)
    // RETURN: newly created system reactive store
    // ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
    async function joinSystem(sysId,        // system identifier -and- alias to room (must be unique on server or will error)
                                     accessCode) { // access code to join system (a lite password)

      const log = logger('vit:client:system:joinSystem');

      // verify system does NOT already exist (on the client-side)
      // NOTE: all other validation occurs on the server-side
      if (getSystem(sysId)) {
        log(`local client cache found system '${sysId}' ... erroring out`);
        throw new Error('*** USER ERROR *** in "joinSystem()" function')
          .defineUserMsg(`system '${sysId}' already exists (in client cache)`);
      }

      // join server-side system, insuring it is valid
      // NOTE: errors are passed-through to our invoker
      //       EX: - Expected Error: system: {sysId} already exists
      const {isRunning, model} = await joinSystem$1(sysId, accessCode);

      // create/return our client-side reactive system store
      return createSystemStore(sysId, accessCode, model, false /*isHost*/, isRunning);
    }


    // ********************************************************************************
    // start a system running
    // NOTE:   This function could be a method of the system store's value object
    //         ... runSystem() ... where we get the sysId via this.sysId
    // RETURN: void
    // ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
    async function runSystem(sysId) { // system identifier
      // const log = logger('vit:client:system:runSystem');

      // request server to start the system running
      // NOTE: errors are passed-through to our invoker
      //       EX: - Expected Error: system: {sysId} is already running
      // NOTE: Our internal running status is maintained from the 'system-run-changed' event
      //       broadcast to ALL participants from the server
      await runSystem$1(sysId);
    }


    // ********************************************************************************
    // pause a running system
    // NOTE:   This function could be a method of the system store's value object
    //         ... pauseSystem() ... where we get the sysId via this.sysId
    // RETURN: void
    // ERROR:  either a userMsg (expected condition), or a hard-error (unexpected condition)
    async function pauseSystem(sysId) { // system identifier
      // request server to pause the system
      // NOTE: errors are passed-through to our invoker
      //       EX: - Expected Error: system: {sysId} is already running
      // NOTE: Our internal running status is maintained from the 'system-run-changed' event
      //       broadcast to ALL participants from the server
      await pauseSystem$1(sysId);
    }


    // ********************************************************************************
    // all Systems in-use by THIS client
    //   a Map:
    //   sysId<key>: systemStore<value>
    log$8('creating client-side systems cache');
    const clientSystems = new Map();
    // Usage Summary:
    //  - Array.from(clientSystems.values())
    //  - clientSystems.set(sysId, {...});
    //  - clientSystems.get(sysId);
    //  - clientSystems.delete(sysId);

    // ********************************************************************************
    // return indicator as to whether we have any system entries
    // RETURN: boolean
    function hasClientSystems() {
      return clientSystems.size > 0;
    }

    // ********************************************************************************
    // return all system ids
    // RETURN: [sysId]
    function allClientSysIds() {
      return Array.from(clientSystems.keys())
    }

    // ********************************************************************************
    // return the system store identified by the supplied sysId
    // RETURN: desired system store (undefined for not found)
    function getSystem(sysId) {
      // DEBUGGED VERSION:
      // const system = clientSystems.get(sysId);
      // log(`getSystem('${sysId}') returning: `, system);
      // return system;

      // PRODUCTION VERSION
      return clientSystems.get(sysId);
    }




    //***
    //*** Registration of system-based socket handlers
    //***

    // our active socket (to be used in this module)
    let socket$3;

    function registerSystemStoreSocketHandlers(_socket) {
      log$8('here we are in registerSystemStoreSocketHandlers');

      // expose socket to this module
      socket$3 = _socket;

      // our client tick processor for a running system
      // INITIATED BY: the server's runSystem() process
      // RETURN (via ack): deltaModelChanges
      // ERROR  (via ack): either a userMsg (expected condition), or a hard-error (unexpected condition)
      socket$3.on('system-tick', (sysId, ack) => {
        const log = logger('vit:client:system:system-tick'); 
        log(`processing - sysId: '${sysId}'`);

        // convenience util
        function userErr(userMsg) {
          const errMsg = '*** USER ERROR *** in "system-tick" event';
          log(`${errMsg} ... ${userMsg}`);
          ack({errMsg, userMsg});
        }

        // locate the system store that will service this request
        const system = getSystem(sysId);
        if (!system) {
          return userErr(`'sys-tick" event - sysId: ${sysId} is NOT recognized by this client (something is out-of-sync) :-(`);
        }
        
        // NOTE: This routine simulates some contrived logic that registers changes to the store.
        //       - It does NOT directly update the store.
        //       - RATHER, it returns a deltaModelChanges
        //         (which the server broadcasts to ALL participants of the running system)
        //       - THEREFORE, the changes are applied in stateChanged()
        const model      = get_store_value(system).model;
        const activeUser = get_store_value(user);

        // accumulator of model changes
        let deltaModelChanges = {
          // example:
          // 'K1.pres': newPressure,
        };

        // TEMPORARY CODE: simulate a hard error
        // with NO checks on the server:
        // - the server will crash
        // - and ALL client socket connections are LOST :-(
        // if (activeUser.userId === 'Kevin' && model.K1.pres > 200) {
        //   ack({errMsg: 'valve 1 BLEW UP (over 200 lbs of pressure)'});
        // }

        // TEMPORARY CODE: simulate a timeout condition (by never responding - NO ack())
        // with NO checks on the server:
        // - the server will block forever (simply stops)
        // if (activeUser.userId === 'Resa' && model.R1.pres > 1300) {
        //   return; // by never responding (ack()) server will timeout
        // }

        // apply programatic state changes (via simulated logic) as needed
        // ... iterate through all components of our system model
        Object.entries(model).forEach( ([compName, comp]) => {

          // process selected components:
          if (comp.type === 'valve' && // valves
              comp.open &&             // that are open
              // when the component name begins with same letter as our active user
              compName[0].toLowerCase() === activeUser.userId[0].toLowerCase()) {

            // bump the pressure up by 10
            deltaModelChanges[`${compName}.pres`] = comp.pres + 10;      }
        });

        // ALSO apply the state changes that have been cached by local interactive components
        // ... this cache is retained in the system store (NOT it's value object)
        deltaModelChanges = {...deltaModelChanges, ...system.extractLocalStateChange()};
      
        // that's all folks
        return ack({value: deltaModelChanges});
      });


      // retain changes as to whether our system is running or paused
      // INITIATED BY: the server's 'run-system' / 'pause-system' process
      // NOTE: This event is broadcast, so there is NO opportunity to communicate a response
      socket$3.on('system-run-changed', (sysId, running) => {
        log$8(`processing 'system-run-changed' event - sysId: '${sysId}', running: ${running}`);

        // locate our system store
        const system = getSystem(sysId);
        if (!system) {
          log$8(`sysId: '${sysId}' does NOT exist ... no-oping`);
          return;
        }

        // forward this process into our system store
        system.runChanged(running);

        // notify user of run change
        alert$1.display(`System '${sysId}' is now ${running ? 'running' : 'paused'}!`);
      });


      // retain state changes to our running system
      // INITIATED BY: the server's 'run-system' process
      // NOTE: This event is broadcast, so there is NO opportunity to communicate a response
      socket$3.on('system-state-changed', (sysId, stateChanges) => {
        log$8(`processing 'system-state-changed' event - sysId: '${sysId}', stateChanges: `, stateChanges);

        // locate our system store
        const system = getSystem(sysId);
        if (!system) {
          log$8(`sysId: '${sysId}' does NOT exist ... no-oping`);
          return;
        }

        // forward this process into our system store
        system.stateChanged(stateChanges);
      });


      // retain changes in the system's set of participants
      // INITIATED BY: the server's sysId/room join/leave events
      // NOTE: This event is broadcast, so there is NO opportunity to communicate a response
      socket$3.on('system-participants-changed', (sysId, userMsg, participants) => {
        log$8(`processing 'system-participants-changed' event - sysId: '${sysId}', userMsg: ${userMsg}, participants: ${participants}`);

        // locate our system store
        const system = getSystem(sysId);
        if (!system) {
          log$8(`sysId: '${sysId}' does NOT exist ... no-oping`);
          return;
        }

        // update our store's participants
        system.participantsChanged(participants);

        // notify user of change
        // EX: "'UserA' has joined the 'sys123' system"
        alert$1.display(userMsg);
      });

    }

    /* src\SystemSelector.svelte generated by Svelte v3.50.1 */
    const file$c = "src\\SystemSelector.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (46:0) {#if hasClientSystems()}
    function create_if_block$3(ctx) {
    	let select;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let mounted;
    	let dispose;
    	let each_value = allClientSysIds();
    	validate_each_argument(each_value);
    	const get_key = ctx => /*_sysId*/ ctx[4];
    	validate_each_keys(ctx, each_value, get_each_context$3, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$3(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (/*sysId*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[3].call(select));
    			add_location(select, file$c, 46, 2, 1636);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, select, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*sysId*/ ctx[0]);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*select_change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*allClientSysIds*/ 0) {
    				each_value = allClientSysIds();
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$3, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, select, destroy_block, create_each_block$3, null, get_each_context$3);
    			}

    			if (dirty & /*sysId, allClientSysIds*/ 1) {
    				select_option(select, /*sysId*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(46:0) {#if hasClientSystems()}",
    		ctx
    	});

    	return block;
    }

    // (48:4) {#each allClientSysIds() as _sysId (_sysId)}
    function create_each_block$3(key_1, ctx) {
    	let option;
    	let t_value = /*_sysId*/ ctx[4] + "";
    	let t;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = /*_sysId*/ ctx[4];
    			option.value = option.__value;
    			add_location(option, file$c, 48, 4, 1719);
    			this.first = option;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(48:4) {#each allClientSysIds() as _sysId (_sysId)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let show_if = hasClientSystems();
    	let if_block_anchor;
    	let if_block = show_if && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty$1();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (show_if) if_block.p(ctx, dirty);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function createStateRetention$1() {
    	let sysIdRetained = undefined;

    	return {
    		get() {
    			return sysIdRetained;
    		},
    		set(sysId) {
    			sysIdRetained = sysId;
    		}
    	};
    }

    const stateRetentionDEFAULT$1 = createStateRetention$1();

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SystemSelector', slots, []);
    	let { system } = $$props;
    	let { stateRetention = stateRetentionDEFAULT$1 } = $$props;

    	// the selected sysId (internal) ... bound to our <select> element -and- synced with the system store
    	let sysId = stateRetention.get();

    	// retain last known info for use when component is re-activated
    	onDestroy(() => {
    		stateRetention.set(sysId);
    	});

    	const writable_props = ['system', 'stateRetention'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SystemSelector> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		sysId = select_value(this);
    		$$invalidate(0, sysId);
    	}

    	$$self.$$set = $$props => {
    		if ('system' in $$props) $$invalidate(1, system = $$props.system);
    		if ('stateRetention' in $$props) $$invalidate(2, stateRetention = $$props.stateRetention);
    	};

    	$$self.$capture_state = () => ({
    		onDestroy,
    		hasClientSystems,
    		allClientSysIds,
    		getSystem,
    		createStateRetention: createStateRetention$1,
    		stateRetentionDEFAULT: stateRetentionDEFAULT$1,
    		system,
    		stateRetention,
    		sysId
    	});

    	$$self.$inject_state = $$props => {
    		if ('system' in $$props) $$invalidate(1, system = $$props.system);
    		if ('stateRetention' in $$props) $$invalidate(2, stateRetention = $$props.stateRetention);
    		if ('sysId' in $$props) $$invalidate(0, sysId = $$props.sysId);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*sysId*/ 1) {
    			// reflexively adjust system store when sysId changes (via our selector)
    			{
    				$$invalidate(1, system = getSystem(sysId) || null); // maintain our active system
    			}
    		}
    	};

    	return [sysId, system, stateRetention, select_change_handler];
    }

    class SystemSelector extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, { system: 1, stateRetention: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SystemSelector",
    			options,
    			id: create_fragment$d.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*system*/ ctx[1] === undefined && !('system' in props)) {
    			console.warn("<SystemSelector> was created without expected prop 'system'");
    		}
    	}

    	get system() {
    		throw new Error("<SystemSelector>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set system(value) {
    		throw new Error("<SystemSelector>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get stateRetention() {
    		throw new Error("<SystemSelector>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stateRetention(value) {
    		throw new Error("<SystemSelector>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\SystemJoin.svelte generated by Svelte v3.50.1 */
    const file$b = "src\\SystemJoin.svelte";

    function create_fragment$c(ctx) {
    	let div1;
    	let h4;
    	let t1;
    	let form;
    	let label0;
    	let t2;
    	let input0;
    	let t3;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let div0;
    	let t6;
    	let t7;
    	let button0;
    	let t9;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h4 = element("h4");
    			h4.textContent = "Join an EXISTING System";
    			t1 = space();
    			form = element("form");
    			label0 = element("label");
    			t2 = text("System ID:   ");
    			input0 = element("input");
    			t3 = space();
    			label1 = element("label");
    			t4 = text("Access Code: ");
    			input1 = element("input");
    			t5 = space();
    			div0 = element("div");
    			t6 = text(/*userMsg*/ ctx[3]);
    			t7 = space();
    			button0 = element("button");
    			button0.textContent = "Join";
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "Cancel";
    			add_location(h4, file$b, 40, 2, 1391);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "autocomplete", "on");
    			input0.autofocus = true;
    			add_location(input0, file$b, 44, 24, 1529);
    			add_location(label0, file$b, 44, 4, 1509);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "autocomplete", "on");
    			add_location(input1, file$b, 45, 24, 1631);
    			add_location(label1, file$b, 45, 4, 1611);
    			attr_dev(div0, "class", "error svelte-1t6gmo2");
    			add_location(div0, file$b, 47, 4, 1710);
    			add_location(button0, file$b, 49, 4, 1752);
    			add_location(button1, file$b, 50, 4, 1807);
    			attr_dev(form, "onsubmit", "return false;");
    			add_location(form, file$b, 42, 2, 1429);
    			add_location(div1, file$b, 39, 0, 1382);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h4);
    			append_dev(div1, t1);
    			append_dev(div1, form);
    			append_dev(form, label0);
    			append_dev(label0, t2);
    			append_dev(label0, input0);
    			set_input_value(input0, /*sysId*/ ctx[1]);
    			append_dev(form, t3);
    			append_dev(form, label1);
    			append_dev(label1, t4);
    			append_dev(label1, input1);
    			set_input_value(input1, /*accessCode*/ ctx[2]);
    			append_dev(form, t5);
    			append_dev(form, div0);
    			append_dev(div0, t6);
    			append_dev(form, t7);
    			append_dev(form, button0);
    			append_dev(form, t9);
    			append_dev(form, button1);
    			input0.focus();

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen_dev(button0, "click", /*handleJoinSystem*/ ctx[4], false, false, false),
    					listen_dev(button1, "click", /*click_handler*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*sysId*/ 2 && input0.value !== /*sysId*/ ctx[1]) {
    				set_input_value(input0, /*sysId*/ ctx[1]);
    			}

    			if (dirty & /*accessCode*/ 4 && input1.value !== /*accessCode*/ ctx[2]) {
    				set_input_value(input1, /*accessCode*/ ctx[2]);
    			}

    			if (dirty & /*userMsg*/ 8) set_data_dev(t6, /*userMsg*/ ctx[3]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SystemJoin', slots, []);
    	const log = logger('vit:client:SystemJoin');
    	let { newSystemIntroduced } = $$props;
    	let { resetSubCompDisp } = $$props;

    	// our input state (bound to input controls)
    	let sysId = '';

    	let accessCode = '';
    	let userMsg = '';

    	async function handleJoinSystem() {
    		// join the system, making server aware of this
    		try {
    			const system = await joinSystem(sysId, accessCode);
    			alert$1.display(`System '${sysId}' has been successfully joined!`);
    			newSystemIntroduced(sysId);
    			resetSubCompDisp();
    		} catch(e) {
    			// AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
    			//     ... c:/dev/visualize-it/src/util/discloseError.js
    			if (e.isExpected()) {
    				// notify user of expected errors
    				$$invalidate(3, userMsg = e.userMsg);
    			} else {
    				// notify user of unexpected errors, and log detail
    				$$invalidate(3, userMsg = 'Unexpected error in joinSystem process ... see logs for detail');

    				log.v(`*** ERROR *** Unexpected error in joinSystem process: ${e}`, e);
    			}
    		}
    	}

    	const writable_props = ['newSystemIntroduced', 'resetSubCompDisp'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SystemJoin> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		sysId = this.value;
    		$$invalidate(1, sysId);
    	}

    	function input1_input_handler() {
    		accessCode = this.value;
    		$$invalidate(2, accessCode);
    	}

    	const click_handler = () => resetSubCompDisp();

    	$$self.$$set = $$props => {
    		if ('newSystemIntroduced' in $$props) $$invalidate(5, newSystemIntroduced = $$props.newSystemIntroduced);
    		if ('resetSubCompDisp' in $$props) $$invalidate(0, resetSubCompDisp = $$props.resetSubCompDisp);
    	};

    	$$self.$capture_state = () => ({
    		joinSystem,
    		alert: alert$1,
    		logger,
    		log,
    		newSystemIntroduced,
    		resetSubCompDisp,
    		sysId,
    		accessCode,
    		userMsg,
    		handleJoinSystem
    	});

    	$$self.$inject_state = $$props => {
    		if ('newSystemIntroduced' in $$props) $$invalidate(5, newSystemIntroduced = $$props.newSystemIntroduced);
    		if ('resetSubCompDisp' in $$props) $$invalidate(0, resetSubCompDisp = $$props.resetSubCompDisp);
    		if ('sysId' in $$props) $$invalidate(1, sysId = $$props.sysId);
    		if ('accessCode' in $$props) $$invalidate(2, accessCode = $$props.accessCode);
    		if ('userMsg' in $$props) $$invalidate(3, userMsg = $$props.userMsg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		resetSubCompDisp,
    		sysId,
    		accessCode,
    		userMsg,
    		handleJoinSystem,
    		newSystemIntroduced,
    		input0_input_handler,
    		input1_input_handler,
    		click_handler
    	];
    }

    class SystemJoin extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			newSystemIntroduced: 5,
    			resetSubCompDisp: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SystemJoin",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*newSystemIntroduced*/ ctx[5] === undefined && !('newSystemIntroduced' in props)) {
    			console.warn("<SystemJoin> was created without expected prop 'newSystemIntroduced'");
    		}

    		if (/*resetSubCompDisp*/ ctx[0] === undefined && !('resetSubCompDisp' in props)) {
    			console.warn("<SystemJoin> was created without expected prop 'resetSubCompDisp'");
    		}
    	}

    	get newSystemIntroduced() {
    		throw new Error("<SystemJoin>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set newSystemIntroduced(value) {
    		throw new Error("<SystemJoin>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get resetSubCompDisp() {
    		throw new Error("<SystemJoin>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set resetSubCompDisp(value) {
    		throw new Error("<SystemJoin>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\SystemLaunch.svelte generated by Svelte v3.50.1 */
    const file$a = "src\\SystemLaunch.svelte";

    function create_fragment$b(ctx) {
    	let div1;
    	let h4;
    	let t1;
    	let form;
    	let label0;
    	let t2;
    	let input0;
    	let t3;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let label2;
    	let t6;
    	let textarea;
    	let t7;
    	let div0;
    	let t8;
    	let t9;
    	let button0;
    	let t11;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h4 = element("h4");
    			h4.textContent = "Launch a NEW System";
    			t1 = space();
    			form = element("form");
    			label0 = element("label");
    			t2 = text("System ID:   ");
    			input0 = element("input");
    			t3 = space();
    			label1 = element("label");
    			t4 = text("Access Code: ");
    			input1 = element("input");
    			t5 = space();
    			label2 = element("label");
    			t6 = text("Model:       ");
    			textarea = element("textarea");
    			t7 = space();
    			div0 = element("div");
    			t8 = text(/*userMsg*/ ctx[4]);
    			t9 = space();
    			button0 = element("button");
    			button0.textContent = "Launch";
    			t11 = space();
    			button1 = element("button");
    			button1.textContent = "Cancel";
    			add_location(h4, file$a, 63, 2, 1936);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "autocomplete", "on");
    			input0.autofocus = true;
    			add_location(input0, file$a, 67, 24, 2070);
    			attr_dev(label0, "class", "svelte-e84wh9");
    			add_location(label0, file$a, 67, 4, 2050);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "autocomplete", "on");
    			add_location(input1, file$a, 68, 24, 2172);
    			attr_dev(label1, "class", "svelte-e84wh9");
    			add_location(label1, file$a, 68, 4, 2152);
    			attr_dev(textarea, "class", "svelte-e84wh9");
    			add_location(textarea, file$a, 69, 24, 2269);
    			attr_dev(div0, "class", "error svelte-e84wh9");
    			add_location(div0, file$a, 71, 4, 2320);
    			add_location(button0, file$a, 73, 4, 2362);
    			add_location(button1, file$a, 74, 4, 2421);
    			attr_dev(label2, "class", "svelte-e84wh9");
    			add_location(label2, file$a, 69, 4, 2249);
    			attr_dev(form, "onsubmit", "return false;");
    			add_location(form, file$a, 65, 2, 1970);
    			add_location(div1, file$a, 62, 0, 1927);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h4);
    			append_dev(div1, t1);
    			append_dev(div1, form);
    			append_dev(form, label0);
    			append_dev(label0, t2);
    			append_dev(label0, input0);
    			set_input_value(input0, /*sysId*/ ctx[1]);
    			append_dev(form, t3);
    			append_dev(form, label1);
    			append_dev(label1, t4);
    			append_dev(label1, input1);
    			set_input_value(input1, /*accessCode*/ ctx[2]);
    			append_dev(form, t5);
    			append_dev(form, label2);
    			append_dev(label2, t6);
    			append_dev(label2, textarea);
    			set_input_value(textarea, /*modelStr*/ ctx[3]);
    			append_dev(label2, t7);
    			append_dev(label2, div0);
    			append_dev(div0, t8);
    			append_dev(label2, t9);
    			append_dev(label2, button0);
    			append_dev(label2, t11);
    			append_dev(label2, button1);
    			input0.focus();

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[9]),
    					listen_dev(button0, "click", /*handleLaunchSystem*/ ctx[5], false, false, false),
    					listen_dev(button1, "click", /*click_handler*/ ctx[10], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*sysId*/ 2 && input0.value !== /*sysId*/ ctx[1]) {
    				set_input_value(input0, /*sysId*/ ctx[1]);
    			}

    			if (dirty & /*accessCode*/ 4 && input1.value !== /*accessCode*/ ctx[2]) {
    				set_input_value(input1, /*accessCode*/ ctx[2]);
    			}

    			if (dirty & /*modelStr*/ 8) {
    				set_input_value(textarea, /*modelStr*/ ctx[3]);
    			}

    			if (dirty & /*userMsg*/ 16) set_data_dev(t8, /*userMsg*/ ctx[4]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SystemLaunch', slots, []);
    	const log = logger('vit:client:SystemLaunch');
    	let { newSystemIntroduced } = $$props;
    	let { resetSubCompDisp } = $$props;

    	// our input state (bound to input controls)
    	let sysId = '';

    	let accessCode = '';

    	// AI: input model from user (requires some way to edit JSON) ... for now just use RAW JSON
    	let modelStr = `{
   "K1": {
     "type": "valve",
     "open": false,
     "pres": 120
   },
   "R1": {
     "type": "valve",
     "open": true,
     "pres": 1200
   }
 }`;

    	let userMsg = '';

    	async function handleLaunchSystem() {
    		// convert model string into json
    		let modelJSON = {};

    		try {
    			modelJSON = JSON.parse(modelStr);
    		} catch(e) {
    			$$invalidate(4, userMsg = `Model contains invalid JSON ... ${e.message}`);
    			return;
    		}

    		// launch the system, making server aware of this
    		try {
    			const system = await launchSystem(sysId, accessCode, modelJSON);
    			alert$1.display(`System '${sysId}' has successfully launched ... users may now join!`);
    			newSystemIntroduced(sysId);
    			resetSubCompDisp();
    		} catch(e) {
    			// AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
    			//     ... c:/dev/visualize-it/src/util/discloseError.js
    			if (e.isExpected()) {
    				// notify user of expected errors
    				$$invalidate(4, userMsg = e.userMsg);
    			} else {
    				// notify user of unexpected errors, and log detail
    				$$invalidate(4, userMsg = 'Unexpected error in launchSystem process ... see logs for detail');

    				log.v(`*** ERROR *** Unexpected error in launchSystem process: ${e}`, e);
    			}
    		}
    	}

    	const writable_props = ['newSystemIntroduced', 'resetSubCompDisp'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SystemLaunch> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		sysId = this.value;
    		$$invalidate(1, sysId);
    	}

    	function input1_input_handler() {
    		accessCode = this.value;
    		$$invalidate(2, accessCode);
    	}

    	function textarea_input_handler() {
    		modelStr = this.value;
    		$$invalidate(3, modelStr);
    	}

    	const click_handler = () => resetSubCompDisp();

    	$$self.$$set = $$props => {
    		if ('newSystemIntroduced' in $$props) $$invalidate(6, newSystemIntroduced = $$props.newSystemIntroduced);
    		if ('resetSubCompDisp' in $$props) $$invalidate(0, resetSubCompDisp = $$props.resetSubCompDisp);
    	};

    	$$self.$capture_state = () => ({
    		launchSystem,
    		alert: alert$1,
    		logger,
    		log,
    		newSystemIntroduced,
    		resetSubCompDisp,
    		sysId,
    		accessCode,
    		modelStr,
    		userMsg,
    		handleLaunchSystem
    	});

    	$$self.$inject_state = $$props => {
    		if ('newSystemIntroduced' in $$props) $$invalidate(6, newSystemIntroduced = $$props.newSystemIntroduced);
    		if ('resetSubCompDisp' in $$props) $$invalidate(0, resetSubCompDisp = $$props.resetSubCompDisp);
    		if ('sysId' in $$props) $$invalidate(1, sysId = $$props.sysId);
    		if ('accessCode' in $$props) $$invalidate(2, accessCode = $$props.accessCode);
    		if ('modelStr' in $$props) $$invalidate(3, modelStr = $$props.modelStr);
    		if ('userMsg' in $$props) $$invalidate(4, userMsg = $$props.userMsg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		resetSubCompDisp,
    		sysId,
    		accessCode,
    		modelStr,
    		userMsg,
    		handleLaunchSystem,
    		newSystemIntroduced,
    		input0_input_handler,
    		input1_input_handler,
    		textarea_input_handler,
    		click_handler
    	];
    }

    class SystemLaunch extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {
    			newSystemIntroduced: 6,
    			resetSubCompDisp: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SystemLaunch",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*newSystemIntroduced*/ ctx[6] === undefined && !('newSystemIntroduced' in props)) {
    			console.warn("<SystemLaunch> was created without expected prop 'newSystemIntroduced'");
    		}

    		if (/*resetSubCompDisp*/ ctx[0] === undefined && !('resetSubCompDisp' in props)) {
    			console.warn("<SystemLaunch> was created without expected prop 'resetSubCompDisp'");
    		}
    	}

    	get newSystemIntroduced() {
    		throw new Error("<SystemLaunch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set newSystemIntroduced(value) {
    		throw new Error("<SystemLaunch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get resetSubCompDisp() {
    		throw new Error("<SystemLaunch>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set resetSubCompDisp(value) {
    		throw new Error("<SystemLaunch>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\System.svelte generated by Svelte v3.50.1 */

    const { Object: Object_1 } = globals;
    const file$9 = "src\\System.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i][0];
    	child_ctx[12] = list[i][1];
    	child_ctx[13] = list;
    	child_ctx[14] = i;
    	return child_ctx;
    }

    // (74:0) {:else}
    function create_else_block$2(ctx) {
    	let div;
    	let center;
    	let h4;
    	let t1;
    	let p;
    	let systemselector;
    	let updating_system;
    	let t2;
    	let button0;
    	let t4;
    	let button1;
    	let t6;
    	let current;
    	let mounted;
    	let dispose;

    	function systemselector_system_binding(value) {
    		/*systemselector_system_binding*/ ctx[6](value);
    	}

    	let systemselector_props = {
    		stateRetention: systemSelectorStateRetention
    	};

    	if (/*system*/ ctx[0] !== void 0) {
    		systemselector_props.system = /*system*/ ctx[0];
    	}

    	systemselector = new SystemSelector({
    			props: systemselector_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(systemselector, 'system', systemselector_system_binding));
    	let if_block = /*system*/ ctx[0] && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			center = element("center");
    			h4 = element("h4");
    			h4.textContent = "System";
    			t1 = space();
    			p = element("p");
    			create_component(systemselector.$$.fragment);
    			t2 = text("\r\n\r\n      \r\n          \r\n      ");
    			button0 = element("button");
    			button0.textContent = "Launch New System";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Join Existing System";
    			t6 = space();
    			if (if_block) if_block.c();
    			add_location(h4, file$9, 76, 4, 2896);
    			add_location(button0, file$9, 83, 6, 3124);
    			add_location(button1, file$9, 84, 6, 3214);
    			add_location(p, file$9, 77, 4, 2917);
    			add_location(center, file$9, 75, 2, 2882);
    			add_location(div, file$9, 74, 0, 2873);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, center);
    			append_dev(center, h4);
    			append_dev(center, t1);
    			append_dev(center, p);
    			mount_component(systemselector, p, null);
    			append_dev(p, t2);
    			append_dev(p, button0);
    			append_dev(p, t4);
    			append_dev(p, button1);
    			append_dev(div, t6);
    			if (if_block) if_block.m(div, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[7], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const systemselector_changes = {};

    			if (!updating_system && dirty & /*system*/ 1) {
    				updating_system = true;
    				systemselector_changes.system = /*system*/ ctx[0];
    				add_flush_callback(() => updating_system = false);
    			}

    			systemselector.$set(systemselector_changes);

    			if (/*system*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(systemselector.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(systemselector.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(systemselector);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(74:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (72:0) {#if $subComp}
    function create_if_block$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*$subComp*/ ctx[3];

    	function switch_props(ctx) {
    		return {
    			props: { newSystemIntroduced, resetSubCompDisp },
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty$1();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (switch_value !== (switch_value = /*$subComp*/ ctx[3])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(72:0) {#if $subComp}",
    		ctx
    	});

    	return block;
    }

    // (90:2) {#if system}
    function create_if_block_1$1(ctx) {
    	let b0;
    	let t1;
    	let t2_value = /*$system*/ ctx[2].sysId + "";
    	let t2;
    	let t3;
    	let i;
    	let t4;
    	let t5_value = (/*$system*/ ctx[2].isHost ? 'host' : 'participant') + "";
    	let t5;
    	let t6;
    	let t7;
    	let br0;
    	let t8;
    	let b1;
    	let t10;
    	let t11_value = /*$system*/ ctx[2].participants + "";
    	let t11;
    	let t12;
    	let br1;
    	let t13;
    	let b2;
    	let t15;
    	let t16_value = (/*$system*/ ctx[2].isRunning ? 'running' : 'paused') + "";
    	let t16;
    	let t17;
    	let t18;
    	let br2;
    	let t19;
    	let b3;
    	let t21;
    	let ul;
    	let t22;
    	let div;
    	let t23;

    	function select_block_type_1(ctx, dirty) {
    		if (/*$system*/ ctx[2].isRunning) return create_if_block_3$1;
    		return create_else_block_2$1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value = Object.entries(/*$system*/ ctx[2].model);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			b0 = element("b");
    			b0.textContent = "System:";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			i = element("i");
    			t4 = text("(");
    			t5 = text(t5_value);
    			t6 = text(")");
    			t7 = space();
    			br0 = element("br");
    			t8 = space();
    			b1 = element("b");
    			b1.textContent = "Participants:";
    			t10 = space();
    			t11 = text(t11_value);
    			t12 = space();
    			br1 = element("br");
    			t13 = space();
    			b2 = element("b");
    			b2.textContent = "Status:";
    			t15 = space();
    			t16 = text(t16_value);
    			t17 = space();
    			if_block.c();
    			t18 = space();
    			br2 = element("br");
    			t19 = space();
    			b3 = element("b");
    			b3.textContent = "Model:";
    			t21 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t22 = space();
    			div = element("div");
    			t23 = text(/*userMsg*/ ctx[1]);
    			add_location(b0, file$9, 90, 4, 3393);
    			add_location(i, file$9, 90, 35, 3424);
    			add_location(br0, file$9, 91, 4, 3480);
    			add_location(b1, file$9, 92, 4, 3491);
    			add_location(br1, file$9, 93, 4, 3540);
    			add_location(b2, file$9, 94, 4, 3551);
    			add_location(br2, file$9, 100, 4, 3781);
    			add_location(b3, file$9, 101, 4, 3792);
    			add_location(ul, file$9, 106, 4, 3940);
    			attr_dev(div, "class", "error svelte-1t6gmo2");
    			add_location(div, file$9, 132, 4, 5178);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, i, anchor);
    			append_dev(i, t4);
    			append_dev(i, t5);
    			append_dev(i, t6);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, b1, anchor);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, t11, anchor);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, b2, anchor);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, t16, anchor);
    			insert_dev(target, t17, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, t18, anchor);
    			insert_dev(target, br2, anchor);
    			insert_dev(target, t19, anchor);
    			insert_dev(target, b3, anchor);
    			insert_dev(target, t21, anchor);
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			insert_dev(target, t22, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, t23);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$system*/ 4 && t2_value !== (t2_value = /*$system*/ ctx[2].sysId + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$system*/ 4 && t5_value !== (t5_value = (/*$system*/ ctx[2].isHost ? 'host' : 'participant') + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*$system*/ 4 && t11_value !== (t11_value = /*$system*/ ctx[2].participants + "")) set_data_dev(t11, t11_value);
    			if (dirty & /*$system*/ 4 && t16_value !== (t16_value = (/*$system*/ ctx[2].isRunning ? 'running' : 'paused') + "")) set_data_dev(t16, t16_value);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(t18.parentNode, t18);
    				}
    			}

    			if (dirty & /*Object, $system, system, JSON*/ 5) {
    				each_value = Object.entries(/*$system*/ ctx[2].model);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*userMsg*/ 2) set_data_dev(t23, /*userMsg*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(i);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(b1);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(b2);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(t16);
    			if (detaching) detach_dev(t17);
    			if_block.d(detaching);
    			if (detaching) detach_dev(t18);
    			if (detaching) detach_dev(br2);
    			if (detaching) detach_dev(t19);
    			if (detaching) detach_dev(b3);
    			if (detaching) detach_dev(t21);
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t22);
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(90:2) {#if system}",
    		ctx
    	});

    	return block;
    }

    // (98:4) {:else}
    function create_else_block_2$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Run";
    			add_location(button, file$9, 98, 6, 3717);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handleRunSystem*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$1.name,
    		type: "else",
    		source: "(98:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (96:4) {#if $system.isRunning}
    function create_if_block_3$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Pause";
    			add_location(button, file$9, 96, 6, 3645);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handlePauseSystem*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(96:4) {#if $system.isRunning}",
    		ctx
    	});

    	return block;
    }

    // (126:8) {:else}
    function create_else_block_1$1(ctx) {
    	let pre;
    	let t_value = JSON.stringify(/*compModel*/ ctx[12], null, 2) + "";
    	let t;

    	const block = {
    		c: function create() {
    			pre = element("pre");
    			t = text(t_value);
    			add_location(pre, file$9, 126, 10, 5070);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, pre, anchor);
    			append_dev(pre, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$system*/ 4 && t_value !== (t_value = JSON.stringify(/*compModel*/ ctx[12], null, 2) + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(pre);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(126:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (111:8) {#if compModel.type === 'valve'}
    function create_if_block_2$1(ctx) {
    	let t0;
    	let input;
    	let t1;
    	let b;
    	let t2_value = /*compModel*/ ctx[12].pres + "";
    	let t2;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[9].call(input, /*each_value*/ ctx[13], /*each_index*/ ctx[14]);
    	}

    	function change_handler(...args) {
    		return /*change_handler*/ ctx[10](/*compName*/ ctx[11], ...args);
    	}

    	const block = {
    		c: function create() {
    			t0 = text("a valve ...\r\n          \r\n          ");
    			input = element("input");
    			t1 = text("\r\n          open, with pressure ");
    			b = element("b");
    			t2 = text(t2_value);
    			attr_dev(input, "type", "checkbox");
    			add_location(input, file$9, 121, 10, 4770);
    			add_location(b, file$9, 124, 30, 4977);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, input, anchor);
    			input.checked = /*compModel*/ ctx[12].open;
    			insert_dev(target, t1, anchor);
    			insert_dev(target, b, anchor);
    			append_dev(b, t2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", input_change_handler),
    					listen_dev(input, "change", change_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*Object, $system*/ 4) {
    				input.checked = /*compModel*/ ctx[12].open;
    			}

    			if (dirty & /*$system*/ 4 && t2_value !== (t2_value = /*compModel*/ ctx[12].pres + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(b);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(111:8) {#if compModel.type === 'valve'}",
    		ctx
    	});

    	return block;
    }

    // (108:6) {#each Object.entries($system.model) as [compName, compModel]}
    function create_each_block$2(ctx) {
    	let p;
    	let b;
    	let t0_value = /*compName*/ ctx[11] + "";
    	let t0;
    	let t1;
    	let t2;
    	let t3;

    	function select_block_type_2(ctx, dirty) {
    		if (/*compModel*/ ctx[12].type === 'valve') return create_if_block_2$1;
    		return create_else_block_1$1;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			p = element("p");
    			b = element("b");
    			t0 = text(t0_value);
    			t1 = text(":");
    			t2 = space();
    			if_block.c();
    			t3 = space();
    			add_location(b, file$9, 109, 8, 4035);
    			add_location(p, file$9, 108, 6, 4022);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, b);
    			append_dev(b, t0);
    			append_dev(b, t1);
    			append_dev(p, t2);
    			if_block.m(p, null);
    			append_dev(p, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$system*/ 4 && t0_value !== (t0_value = /*compName*/ ctx[11] + "")) set_data_dev(t0, t0_value);

    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(p, t3);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(108:6) {#each Object.entries($system.model) as [compName, compModel]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$2, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$subComp*/ ctx[3]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const log$7 = logger('vit:client:System');

    // retain the selected system IN module-scoped context (when destroyed/re-instantiated)
    // in such a way that we can alter it when a new system is created
    const systemSelectorStateRetention = createStateRetention$1();

    // utility to display new system that has been introduced (either through "launch" or "join")
    const newSystemIntroduced = sysId => systemSelectorStateRetention.set(sysId);

    // system sub-component to display (if any)
    // ... we need module-scoped to retain subComp when moving on/off the System tab
    // ... we use store to make module-scoped changes reactive
    const subComp = writable(null);

    // utility to reset our sub-comp display
    const resetSubCompDisp = (comp = null) => subComp.set(comp); // ... omit param to clear sub-comp display

    function instance$a($$self, $$props, $$invalidate) {
    	let $system,
    		$$unsubscribe_system = noop,
    		$$subscribe_system = () => ($$unsubscribe_system(), $$unsubscribe_system = subscribe(system, $$value => $$invalidate(2, $system = $$value)), system);

    	let $subComp;
    	validate_store(subComp, 'subComp');
    	component_subscribe($$self, subComp, $$value => $$invalidate(3, $subComp = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_system());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('System', slots, []);
    	let system = null;
    	validate_store(system, 'system');
    	$$subscribe_system();
    	let userMsg = '';

    	async function handleRunSystem() {
    		const sysId = $system.sysId;

    		try {
    			$$invalidate(1, userMsg = '');
    			await runSystem(sysId);
    		} catch(e) {
    			// AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
    			//     ... c:/dev/visualize-it/src/util/discloseError.js
    			if (e.isExpected()) {
    				// notify user of expected errors
    				$$invalidate(1, userMsg = e.userMsg);
    			} else {
    				// notify user of unexpected errors, and log detail
    				$$invalidate(1, userMsg = 'Unexpected error in runSystem process ... see logs for detail');

    				log$7.v(`*** ERROR *** Unexpected error in runSystem process: ${e}`, e);
    			}
    		}
    	}

    	async function handlePauseSystem() {
    		const sysId = $system.sysId;

    		try {
    			$$invalidate(1, userMsg = '');
    			await pauseSystem(sysId);
    		} catch(e) {
    			// AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
    			//     ... c:/dev/visualize-it/src/util/discloseError.js
    			if (e.isExpected()) {
    				// notify user of expected errors
    				$$invalidate(1, userMsg = e.userMsg);
    			} else {
    				// notify user of unexpected errors, and log detail
    				$$invalidate(1, userMsg = 'Unexpected error in pauseSystem process ... see logs for detail');

    				log$7.v(`*** ERROR *** Unexpected error in pauseSystem process: ${e}`, e);
    			}
    		}
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<System> was created with unknown prop '${key}'`);
    	});

    	function systemselector_system_binding(value) {
    		system = value;
    		$$subscribe_system($$invalidate(0, system));
    	}

    	const click_handler = () => resetSubCompDisp(SystemLaunch);
    	const click_handler_1 = () => resetSubCompDisp(SystemJoin);

    	function input_change_handler(each_value, each_index) {
    		each_value[each_index][1].open = this.checked;
    	}

    	const change_handler = (compName, e) => system.cacheLocalStateChange(`${compName}.open`, e.target.checked);

    	$$self.$capture_state = () => ({
    		writable,
    		SystemLaunch,
    		SystemJoin,
    		SystemSelector,
    		createStateRetention: createStateRetention$1,
    		runSystem,
    		pauseSystem,
    		logger,
    		log: log$7,
    		systemSelectorStateRetention,
    		newSystemIntroduced,
    		subComp,
    		resetSubCompDisp,
    		system,
    		userMsg,
    		handleRunSystem,
    		handlePauseSystem,
    		$system,
    		$subComp
    	});

    	$$self.$inject_state = $$props => {
    		if ('system' in $$props) $$subscribe_system($$invalidate(0, system = $$props.system));
    		if ('userMsg' in $$props) $$invalidate(1, userMsg = $$props.userMsg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		system,
    		userMsg,
    		$system,
    		$subComp,
    		handleRunSystem,
    		handlePauseSystem,
    		systemselector_system_binding,
    		click_handler,
    		click_handler_1,
    		input_change_handler,
    		change_handler
    	];
    }

    class System extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "System",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

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
        };

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
      };

      return beep;
    }

    const beep = createBeep();

    //***
    const  log$6 = logger('vit:client:chat');

    // the store "session" structure (one for each session)
    // SESSION:
    // {
    //   otherSocketId: 'aSocketId', // the other-user socketId
    //   otherUserId:   'aUserId',   // the other-user userId
    //   msgs: [                     // all the messages in this session
    //     {       // one of many messages
    //       when: date,
    //       who:  boolean, // true: other-user, false: me
    //       msg:  'hello world',
    //     },
    //     ...
    //   ],
    // }

    // our initial store value (defining our value methods)
    const initialChat = {
      session: { // SESSION map
        // otherSocketId1: SESSION, // ... one of many sessions BETWEEN self and this "other" user
        // otherSocketId2: SESSION, // ... ditto
        // ...
      },

      //***
      //*** adorned properties (based on SESSION map - above)
      //***

      sessions: [],    // SESSION[] ... array rendition of SESSION map (sorted by otherUserId)
      isActive: false, // are their active sessions
    };

    // internal function that maintains the adorned properties
    // RETURN: new chat value object
    function adorn(sessionMap) {
      const sessions = Object.values(sessionMap) // extract session array
                             .sort((a,b) => a.otherUserId.localeCompare(b.otherUserId)); // sorted by otherUserId
      const isActive = sessions.length > 0;
      return {
        session: sessionMap,
        sessions,
        isActive,
      };
    }

    function createChat() {
    	const {subscribe, update} = writable(initialChat);

    	return {
    		subscribe,

        // solicit a private message (initiation)
        solicitPrivateMsg: () => { // ... invoked by: client Easter Egg (see: Router.svelte)
          log$6(`solicit a private message to server ... emitting socket private-msg-solicit`);
          socket$2.emit('private-msg-solicit');
          alert$1.display(`Requesting chat :-)`);
        },

        // connect our chat with another user
        connect: (otherSocketId, userId, msg) => { // ... invoked by 'private-msg-connect' event (below)
          // default params appropriatly
          userId = userId || 'Guest';
          msg    = msg    || `Hello from ${userId}`;

          // connect our chat
          log$6(`connecting chat with: ${userId}, msg: "${msg}"`);
          update(state => adorn({...state.session,
                                 [otherSocketId]: {
                                   ...state.session[otherSocketId], // for good measure (not really needed since we are injecting all properties)
                                   otherSocketId,
                                   otherUserId:   userId,
                                   // preserve session content when already active
                                   // ... WITH protection (via empty array) when NOT already active
                                   msgs: [...(state.session[otherSocketId]?.msgs || []), {when: new Date(), who: true, /* other-user */ msg}],
                                 }} ));
          alert$1.display(`Chat now available with ${userId} (see Chat tab)`);
        },

        // send a message to the other party of the given session
        sendMsg: (msg, otherSocketId) => {

          // obtain the designated session that we will be communicating with
          const session = get_store_value(chat).session[otherSocketId];

          // send the message
          log$6(`sending msg: "${msg}" TO: ${session.otherUserId}`);
          //                         TO:                    FROM:
          socket$2.emit('private-msg', session.otherSocketId, socket$2.id,  msg);

          // update this local message in our state
          update(state => adorn({...state.session,
                                 [otherSocketId]: {
                                   ...state.session[otherSocketId],
                                   msgs: [...(state.session[otherSocketId]?.msgs || []), {when: new Date(), who: false, /* me */ msg}],
                                 }} ));
        },

        // receive a message
        receiveMsg: (msg, otherSocketId) => {

          // obtain the designated session that is communicating with us
          const session = get_store_value(chat).session[otherSocketId];

          log$6(`receiving msg: "${msg}" FROM: ${session.otherUserId}`);

          // update this message in our state
          update(state => adorn({...state.session,
                                 [otherSocketId]: {
                                   ...state.session[otherSocketId],
                                   msgs: [...(state.session[otherSocketId]?.msgs || []), {when: new Date(), who: true, /* other-user */ msg}],
                                 }} ));

          // notify user new chat message has arrived
          // ??
          beep();

        },

        // disconnect chat
        // ... this initiates the disconnect
        disconnect: (otherSocketId) => { // ... invoked by: client chat screen

          // obtain the designated session to disconnect
          const session = get_store_value(chat).session[otherSocketId];

          log$6(`disconnect our chat session with ${session.otherUserId}`);

          // update our state to reflect a disconnect
          // ... remove the session completely
          update(state => {
            const {[otherSocketId]: removedSession, ...rest} = state.session;
            return adorn(rest);
          });

          // communicate to the other side that we are disconnected
          //                                    SEND-TO        THEIR-OTHER
          socket$2.emit('private-msg-disconnect', otherSocketId, socket$2.id);
        },

        // our chat has been disconnected
        // ... from the other party
        disconnected: (otherSocketId) => {
          log$6(`our chat session has been disconnected (from the other party)`);

          // obtain the designated session to disconnect
          const session = get_store_value(chat).session[otherSocketId];

          if (session) { // can be undefined WHEN chat to self
            log$6(`chat session with ${session.otherUserId} has been disconnected (by them)`);

            // update our state to reflect a disconnect
            // ... remove the session completely
            update(state => {
              const {[otherSocketId]: removedSession, ...rest} = state.session;
              return adorn(rest);
            });
          }
        },
    	};
    }

    // our current active chat
    // ... a Svelte store
    const chat = createChat();






    // our active socket (to be used in this module)
    let socket$2;

    function registerChatSocketHandlers(_socket) {
      log$6('here we are in registerChatSocketHandlers');

      // expose socket to this module
      socket$2 = _socket;

      // handle private-msg connection request
      socket$2.on('private-msg-connect', (otherSocketId, userId) => {
        chat.connect(otherSocketId, userId);
      });

      // receive private-msg
      // ... receiving BECAUSE we are on the client side
      socket$2.on('private-msg', (toSocketId, fromSocketId, msg) => {
        chat.receiveMsg(msg, fromSocketId);
      });

      // handle disconnect request from other side
      socket$2.on('private-msg-disconnect', (otherSocketId) => {
        chat.disconnected(otherSocketId);
      });
    }

    /* src\ChatSessionSelector.svelte generated by Svelte v3.50.1 */
    const file$8 = "src\\ChatSessionSelector.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (48:2) {#each $chat.sessions as sess (sess.otherSocketId)}
    function create_each_block$1(key_1, ctx) {
    	let option;
    	let t_value = /*sess*/ ctx[6].otherUserId + "";
    	let t;
    	let option_value_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*sess*/ ctx[6].otherSocketId;
    			option.value = option.__value;
    			add_location(option, file$8, 48, 4, 2103);
    			this.first = option;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*$chat*/ 4 && t_value !== (t_value = /*sess*/ ctx[6].otherUserId + "")) set_data_dev(t, t_value);

    			if (dirty & /*$chat*/ 4 && option_value_value !== (option_value_value = /*sess*/ ctx[6].otherSocketId)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(48:2) {#each $chat.sessions as sess (sess.otherSocketId)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let select;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let mounted;
    	let dispose;
    	let each_value = /*$chat*/ ctx[2].sessions;
    	validate_each_argument(each_value);
    	const get_key = ctx => /*sess*/ ctx[6].otherSocketId;
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (/*sessionId*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[5].call(select));
    			add_location(select, file$8, 46, 0, 1970);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, select, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*sessionId*/ ctx[1]);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*select_change_handler*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$chat*/ 4) {
    				each_value = /*$chat*/ ctx[2].sessions;
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, select, destroy_block, create_each_block$1, null, get_each_context$1);
    			}

    			if (dirty & /*sessionId, $chat*/ 6) {
    				select_option(select, /*sessionId*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function createStateRetention() {
    	let sessionIdRetained = undefined;

    	return {
    		get() {
    			return sessionIdRetained;
    		},
    		set(sessionId) {
    			sessionIdRetained = sessionId;
    		}
    	};
    }

    const stateRetentionDEFAULT = createStateRetention();

    function instance$9($$self, $$props, $$invalidate) {
    	let $chat,
    		$$unsubscribe_chat = noop,
    		$$subscribe_chat = () => ($$unsubscribe_chat(), $$unsubscribe_chat = subscribe(chat, $$value => $$invalidate(2, $chat = $$value)), chat);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_chat());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ChatSessionSelector', slots, []);
    	let { chat } = $$props;
    	validate_store(chat, 'chat');
    	$$subscribe_chat();
    	let { session } = $$props;
    	let { stateRetention = stateRetentionDEFAULT } = $$props;

    	// retain last known info for use when component is re-activated
    	onDestroy(() => {
    		stateRetention.set(sessionId);
    	});

    	// the active sessionId/session we are displaying (from all active chat sessions)
    	// ... sessionId is an alias of SESSION.otherSocketId
    	// ... we NEED sessionId (in addition to session) because it is non-volital
    	//     ... the session object instance will change over time
    	// start out with our initial value (if any)
    	let sessionId = stateRetention.get();

    	const writable_props = ['chat', 'session', 'stateRetention'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ChatSessionSelector> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		sessionId = select_value(this);
    		($$invalidate(1, sessionId), $$invalidate(2, $chat));
    	}

    	$$self.$$set = $$props => {
    		if ('chat' in $$props) $$subscribe_chat($$invalidate(0, chat = $$props.chat));
    		if ('session' in $$props) $$invalidate(3, session = $$props.session);
    		if ('stateRetention' in $$props) $$invalidate(4, stateRetention = $$props.stateRetention);
    	};

    	$$self.$capture_state = () => ({
    		onDestroy,
    		createStateRetention,
    		stateRetentionDEFAULT,
    		chat,
    		session,
    		stateRetention,
    		sessionId,
    		$chat
    	});

    	$$self.$inject_state = $$props => {
    		if ('chat' in $$props) $$subscribe_chat($$invalidate(0, chat = $$props.chat));
    		if ('session' in $$props) $$invalidate(3, session = $$props.session);
    		if ('stateRetention' in $$props) $$invalidate(4, stateRetention = $$props.stateRetention);
    		if ('sessionId' in $$props) $$invalidate(1, sessionId = $$props.sessionId);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$chat, sessionId*/ 6) {
    			// reflexively adjust sessionId when chat store changes
    			// ... checking for existance (say when disconnected ... even when Chat component is NOT active)
    			//     reverting to first one
    			{
    				$$invalidate(1, sessionId = $chat.session[sessionId]
    				? sessionId
    				: $chat.sessions[0]?.otherSocketId);

    				$$invalidate(3, session = $chat.session[sessionId]); // maintain our active session
    			}
    		}
    	};

    	return [chat, sessionId, $chat, session, stateRetention, select_change_handler];
    }

    class ChatSessionSelector extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { chat: 0, session: 3, stateRetention: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ChatSessionSelector",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*chat*/ ctx[0] === undefined && !('chat' in props)) {
    			console.warn("<ChatSessionSelector> was created without expected prop 'chat'");
    		}

    		if (/*session*/ ctx[3] === undefined && !('session' in props)) {
    			console.warn("<ChatSessionSelector> was created without expected prop 'session'");
    		}
    	}

    	get chat() {
    		throw new Error("<ChatSessionSelector>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set chat(value) {
    		throw new Error("<ChatSessionSelector>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get session() {
    		throw new Error("<ChatSessionSelector>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set session(value) {
    		throw new Error("<ChatSessionSelector>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get stateRetention() {
    		throw new Error("<ChatSessionSelector>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set stateRetention(value) {
    		throw new Error("<ChatSessionSelector>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Chat.svelte generated by Svelte v3.50.1 */
    const file$7 = "src\\Chat.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (51:4) {#each session?.msgs || [] as msg (msg.when)}
    function create_each_block(key_1, ctx) {
    	let span;
    	let t_value = /*msg*/ ctx[7].msg + "";
    	let t;
    	let span_class_value;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", span_class_value = "" + (null_to_empty(/*msg*/ ctx[7].who ? 'other' : 'me') + " svelte-14rj4bs"));
    			add_location(span, file$7, 51, 6, 1528);
    			this.first = span;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*session*/ 1 && t_value !== (t_value = /*msg*/ ctx[7].msg + "")) set_data_dev(t, t_value);

    			if (dirty & /*session*/ 1 && span_class_value !== (span_class_value = "" + (null_to_empty(/*msg*/ ctx[7].who ? 'other' : 'me') + " svelte-14rj4bs"))) {
    				attr_dev(span, "class", span_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(51:4) {#each session?.msgs || [] as msg (msg.when)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div2;
    	let center0;
    	let h4;
    	let t1;
    	let chatsessionselector;
    	let updating_session;
    	let t2;
    	let div0;
    	let span0;
    	let t3_value = /*session*/ ctx[0]?.otherUserId + "";
    	let t3;
    	let t4;
    	let span1;
    	let t5;

    	let t6_value = (/*$user*/ ctx[2].userId
    	? `(${/*$user*/ ctx[2].userId})`
    	: '') + "";

    	let t6;
    	let t7;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t8;
    	let div1;
    	let form;
    	let label;
    	let input;
    	let t9;
    	let button0;
    	let t11;
    	let center1;
    	let button1;
    	let current;
    	let mounted;
    	let dispose;

    	function chatsessionselector_session_binding(value) {
    		/*chatsessionselector_session_binding*/ ctx[5](value);
    	}

    	let chatsessionselector_props = { chat };

    	if (/*session*/ ctx[0] !== void 0) {
    		chatsessionselector_props.session = /*session*/ ctx[0];
    	}

    	chatsessionselector = new ChatSessionSelector({
    			props: chatsessionselector_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(chatsessionselector, 'session', chatsessionselector_session_binding));
    	let each_value = /*session*/ ctx[0]?.msgs || [];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*msg*/ ctx[7].when;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			center0 = element("center");
    			h4 = element("h4");
    			h4.textContent = "Chat";
    			t1 = space();
    			create_component(chatsessionselector.$$.fragment);
    			t2 = space();
    			div0 = element("div");
    			span0 = element("span");
    			t3 = text(t3_value);
    			t4 = space();
    			span1 = element("span");
    			t5 = text("Me ");
    			t6 = text(t6_value);
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			div1 = element("div");
    			form = element("form");
    			label = element("label");
    			input = element("input");
    			t9 = text("\r\n          \r\n        ");
    			button0 = element("button");
    			button0.textContent = "Send";
    			t11 = space();
    			center1 = element("center");
    			button1 = element("button");
    			button1.textContent = "Disconnect";
    			add_location(h4, file$7, 40, 4, 1187);
    			add_location(center0, file$7, 39, 2, 1173);
    			attr_dev(span0, "class", "other svelte-14rj4bs");
    			add_location(span0, file$7, 48, 4, 1345);
    			attr_dev(span1, "class", "me svelte-14rj4bs");
    			add_location(span1, file$7, 49, 4, 1400);
    			attr_dev(div0, "class", "chatlist svelte-14rj4bs");
    			add_location(div0, file$7, 47, 2, 1317);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "size", "50");
    			input.autofocus = true;
    			add_location(input, file$7, 59, 8, 1761);
    			add_location(button0, file$7, 61, 8, 1852);
    			add_location(label, file$7, 57, 6, 1697);
    			attr_dev(form, "id", "chatform");
    			attr_dev(form, "onsubmit", "return false;");
    			attr_dev(form, "class", "svelte-14rj4bs");
    			add_location(form, file$7, 56, 4, 1644);
    			attr_dev(div1, "class", "chatbox-area svelte-14rj4bs");
    			add_location(div1, file$7, 55, 2, 1612);
    			add_location(button1, file$7, 67, 4, 1957);
    			add_location(center1, file$7, 66, 2, 1943);
    			add_location(div2, file$7, 38, 0, 1164);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, center0);
    			append_dev(center0, h4);
    			append_dev(center0, t1);
    			mount_component(chatsessionselector, center0, null);
    			append_dev(div2, t2);
    			append_dev(div2, div0);
    			append_dev(div0, span0);
    			append_dev(span0, t3);
    			append_dev(div0, t4);
    			append_dev(div0, span1);
    			append_dev(span1, t5);
    			append_dev(span1, t6);
    			append_dev(div0, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_dev(div2, t8);
    			append_dev(div2, div1);
    			append_dev(div1, form);
    			append_dev(form, label);
    			append_dev(label, input);
    			set_input_value(input, /*myMsg*/ ctx[1]);
    			append_dev(label, t9);
    			append_dev(label, button0);
    			append_dev(div2, t11);
    			append_dev(div2, center1);
    			append_dev(center1, button1);
    			current = true;
    			input.focus();

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[6]),
    					listen_dev(button0, "click", /*handleSendMsg*/ ctx[3], false, false, false),
    					listen_dev(button1, "click", /*handleDisconnect*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const chatsessionselector_changes = {};

    			if (!updating_session && dirty & /*session*/ 1) {
    				updating_session = true;
    				chatsessionselector_changes.session = /*session*/ ctx[0];
    				add_flush_callback(() => updating_session = false);
    			}

    			chatsessionselector.$set(chatsessionselector_changes);
    			if ((!current || dirty & /*session*/ 1) && t3_value !== (t3_value = /*session*/ ctx[0]?.otherUserId + "")) set_data_dev(t3, t3_value);

    			if ((!current || dirty & /*$user*/ 4) && t6_value !== (t6_value = (/*$user*/ ctx[2].userId
    			? `(${/*$user*/ ctx[2].userId})`
    			: '') + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*session*/ 1) {
    				each_value = /*session*/ ctx[0]?.msgs || [];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div0, destroy_block, create_each_block, null, get_each_context);
    			}

    			if (dirty & /*myMsg*/ 2 && input.value !== /*myMsg*/ ctx[1]) {
    				set_input_value(input, /*myMsg*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chatsessionselector.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chatsessionselector.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(chatsessionselector);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const log$5 = logger('vit:client:Chat');

    // module-scoped retention of state (when component is destroyed)
    // ... only works for a singleton Chat component (because state a single occurance)
    let myMsgInitial = '';

    function instance$8($$self, $$props, $$invalidate) {
    	let $user;
    	validate_store(user, 'user');
    	component_subscribe($$self, user, $$value => $$invalidate(2, $user = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Chat', slots, []);

    	onDestroy(() => {
    		myMsgInitial = myMsg;
    	});

    	// our "selected" chat session (bound to ChatSessionSelector)
    	let session;

    	// the unprocessed message to send (typed in but NOT YET sent)
    	let myMsg = myMsgInitial; // AI: technically myMsg should be related to a session (to be more proper)

    	function handleSendMsg() {
    		if (myMsg) {
    			chat.sendMsg(myMsg, session.otherSocketId);
    			$$invalidate(1, myMsg = '');
    		}
    	}

    	function handleDisconnect() {
    		// disconnect from this session
    		chat.disconnect(session.otherSocketId);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Chat> was created with unknown prop '${key}'`);
    	});

    	function chatsessionselector_session_binding(value) {
    		session = value;
    		$$invalidate(0, session);
    	}

    	function input_input_handler() {
    		myMsg = this.value;
    		$$invalidate(1, myMsg);
    	}

    	$$self.$capture_state = () => ({
    		onDestroy,
    		ChatSessionSelector,
    		chat,
    		user,
    		logger,
    		log: log$5,
    		myMsgInitial,
    		session,
    		myMsg,
    		handleSendMsg,
    		handleDisconnect,
    		$user
    	});

    	$$self.$inject_state = $$props => {
    		if ('session' in $$props) $$invalidate(0, session = $$props.session);
    		if ('myMsg' in $$props) $$invalidate(1, myMsg = $$props.myMsg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		session,
    		myMsg,
    		$user,
    		handleSendMsg,
    		handleDisconnect,
    		chatsessionselector_session_binding,
    		input_input_handler
    	];
    }

    class Chat extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Chat",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* ..\server\src\core\util\logger\FilterMyLogs.svelte generated by Svelte v3.50.1 */
    const file$6 = "..\\server\\src\\core\\util\\logger\\FilterMyLogs.svelte";

    function create_fragment$7(ctx) {
    	let form;
    	let label;
    	let t0;
    	let input;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			label = element("label");
    			t0 = text("My Logs Filter:\r\n    ");
    			input = element("input");
    			t1 = text("\r\n      \r\n    ");
    			button = element("button");
    			button.textContent = "Change";
    			attr_dev(input, "type", "text");
    			input.autofocus = true;
    			add_location(input, file$6, 23, 4, 1018);
    			add_location(button, file$6, 25, 4, 1105);
    			add_location(label, file$6, 21, 2, 984);
    			attr_dev(form, "onsubmit", "return false;");
    			add_location(form, file$6, 19, 0, 908);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, label);
    			append_dev(label, t0);
    			append_dev(label, input);
    			set_input_value(input, /*clientLoggingFilter*/ ctx[0]);
    			append_dev(label, t1);
    			append_dev(label, button);
    			input.focus();

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[2]),
    					listen_dev(button, "click", /*handleClientLoggingFilter*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*clientLoggingFilter*/ 1 && input.value !== /*clientLoggingFilter*/ ctx[0]) {
    				set_input_value(input, /*clientLoggingFilter*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FilterMyLogs', slots, []);
    	const log = logger('vit:core:logger:FilterMyLogs');
    	let clientLoggingFilter = logger.currentLogFilters();

    	function handleClientLoggingFilter() {
    		// NOTE: this local logging filter change has a bit more diagnostic logs :-)
    		log(`before enabling this filter, our vit:core:logger:FilterMyLogs log enabled status is: log: ${log.enabled} ... logger: ${logger.isLogFilterEnabled('vit:core:logger:FilterMyLogs')}`);

    		logger.setLogFilters(clientLoggingFilter);
    		log.f(`client logging filter now set to: '${clientLoggingFilter}'`);
    		log(`after enabling this filter, our vit:core:logger:FilterMyLogs log enabled status is: log: ${log.enabled} ... logger: ${logger.isLogFilterEnabled('vit:core:logger:FilterMyLogs')}`);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FilterMyLogs> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		clientLoggingFilter = this.value;
    		$$invalidate(0, clientLoggingFilter);
    	}

    	$$self.$capture_state = () => ({
    		logger,
    		log,
    		clientLoggingFilter,
    		handleClientLoggingFilter
    	});

    	$$self.$inject_state = $$props => {
    		if ('clientLoggingFilter' in $$props) $$invalidate(0, clientLoggingFilter = $$props.clientLoggingFilter);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [clientLoggingFilter, handleClientLoggingFilter, input_input_handler];
    }

    class FilterMyLogs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FilterMyLogs",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    //***
    const  log$4 = logger('vit:core:logger:filterLogsIOClient');

    let socket$1;  // our active socket (to be used in this module)

    function registerLogFilterSocketHandlers(_socket) {
      log$4('here we are in registerLogFilterSocketHandlers');

      // expose socket to this module
      socket$1 = _socket;

      // handle getting other client log filters (request/response)
      // NOTE: The server does a pass-through to other client (i.e. this process).
      //       BECAUSE we are "listening" to this event (not emitting it), we are the "other" client.
      socket$1.on('get-other-log-filters', (ack) => {
        ack(logger.currentLogFilters());
      });

      // handle setting other client log filters
      // NOTE: The server does a pass-through to other client (i.e. this process).
      //       BECAUSE we are "listening" to this event (not emitting it), we are the "other" client.
      // NOTE: otherSocketId IS NEEDED (from client-server) but NOT NEEDED (in server-client - THIS PROCESS)
      //       but maintained for consistancy (since we use the same event name)
      socket$1.on('set-other-log-filters', (otherSocketId, filter) => {
        logger.setLogFilters(filter);
        log$4.f(`our logging filter has been REMOTELY set set to: '${filter}'`);
      });
    }

    // convenience setServerLogFilters(filter) wrapping the socket protocol
    // RETURN: void
    function setServerLogFilters(filter) {
      socket$1.emit('set-server-log-filters', filter);
    }

    // convenience getServerLogFilters() utility wrapping the socket protocol with an async request/response
    // RETURN: promise string
    function getServerLogFilters() {
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'get-server-log-filters' socket request to our server
        socket$1.emit('get-server-log-filters', (serverLogFilters) => {
          // within our acknowledgment callback
          resolve(serverLogFilters);
        });
      });
    }

    // convenience setOtherLogFilters(otherSocketId, filter) wrapping the socket protocol
    // RETURN: void
    function setOtherLogFilters(otherSocketId, filter) {
      socket$1.emit('set-other-log-filters', otherSocketId, filter);
    }

    // convenience getOtherLogFilters(otherSocketId) utility wrapping the socket protocol with an async request/response
    // RETURN: promise string
    function getOtherLogFilters(otherSocketId) {
      // promise wrapper of our socket message protocol
      return new Promise((resolve, reject) => {
        // issue the 'get-other-log-filters' socket request to the other client
        socket$1.emit('get-other-log-filters', otherSocketId, (otherLogFilters) => {
          if (otherLogFilters.startsWith('ERROR')) {
            reject(otherLogFilters);
          }
          else {
            resolve(otherLogFilters);
          }
        });
      });
    }

    /* ..\server\src\core\util\logger\FilterOtherLogs.svelte generated by Svelte v3.50.1 */
    const file$5 = "..\\server\\src\\core\\util\\logger\\FilterOtherLogs.svelte";

    // (82:0) {:else}
    function create_else_block$1(ctx) {
    	let i;

    	const block = {
    		c: function create() {
    			i = element("i");
    			i.textContent = "For \"Other\" Client Logging Filter, establish a chat privite message to that client";
    			add_location(i, file$5, 82, 2, 3429);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, i, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(i);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(82:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (73:0) {#if $chat.isActive}
    function create_if_block$1(ctx) {
    	let form;
    	let label;
    	let t0;
    	let chatsessionselector;
    	let updating_session;
    	let t1;
    	let input;
    	let t2;
    	let button;
    	let current;
    	let mounted;
    	let dispose;

    	function chatsessionselector_session_binding(value) {
    		/*chatsessionselector_session_binding*/ ctx[8](value);
    	}

    	let chatsessionselector_props = {
    		chat: /*chat*/ ctx[3],
    		stateRetention: /*stateRetention*/ ctx[5]
    	};

    	if (/*session*/ ctx[0] !== void 0) {
    		chatsessionselector_props.session = /*session*/ ctx[0];
    	}

    	chatsessionselector = new /*ChatSessionSelector*/ ctx[4]({
    			props: chatsessionselector_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(chatsessionselector, 'session', chatsessionselector_session_binding));

    	const block = {
    		c: function create() {
    			form = element("form");
    			label = element("label");
    			t0 = text("Client Logging Filter for ");
    			create_component(chatsessionselector.$$.fragment);
    			t1 = text(":\r\n      ");
    			input = element("input");
    			t2 = text("\r\n        \r\n      ");
    			button = element("button");
    			button.textContent = "Change";
    			attr_dev(input, "type", "text");
    			add_location(input, file$5, 76, 6, 3252);
    			add_location(button, file$5, 78, 6, 3332);
    			add_location(label, file$5, 74, 4, 3143);
    			attr_dev(form, "onsubmit", "return false;");
    			add_location(form, file$5, 73, 2, 3106);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, label);
    			append_dev(label, t0);
    			mount_component(chatsessionselector, label, null);
    			append_dev(label, t1);
    			append_dev(label, input);
    			set_input_value(input, /*otherLoggingFilter*/ ctx[1]);
    			append_dev(label, t2);
    			append_dev(label, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[9]),
    					listen_dev(button, "click", /*handleOtherLoggingFilter*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const chatsessionselector_changes = {};

    			if (!updating_session && dirty & /*session*/ 1) {
    				updating_session = true;
    				chatsessionselector_changes.session = /*session*/ ctx[0];
    				add_flush_callback(() => updating_session = false);
    			}

    			chatsessionselector.$set(chatsessionselector_changes);

    			if (dirty & /*otherLoggingFilter*/ 2 && input.value !== /*otherLoggingFilter*/ ctx[1]) {
    				set_input_value(input, /*otherLoggingFilter*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chatsessionselector.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chatsessionselector.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			destroy_component(chatsessionselector);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(73:0) {#if $chat.isActive}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$chat*/ ctx[2].isActive) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty$1();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $chat;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FilterOtherLogs', slots, []);
    	const log = logger('vit:core:logger:FilterOtherLogs');
    	let { otherClientSelector } = $$props;
    	const { chat, ChatSessionSelector, stateRetention } = otherClientSelector;
    	validate_store(chat, 'chat');
    	component_subscribe($$self, chat, value => $$invalidate(2, $chat = value));

    	// our "selected" chat session (bound to ChatSessionSelector)
    	let session;

    	let otherLoggingFilter = ''; // because the initialization of this is async, we use delayedOtherInit (AI: technically we should prob keep in sync with other processes that set this (but would require a notification from the server)

    	async function delayedOtherInit(sessionId) {
    		// handle initialization timing ... will re-execute when we have a sessionId
    		if (!sessionId) {
    			log(`delayedOtherInit(${sessionId}): NO sessionId due to initialization timing (no-op till re-executed '')`);
    			$$invalidate(1, otherLoggingFilter = '');
    			return;
    		}

    		try {
    			log(`delayedOtherInit('${sessionId}') ... invoking async getOtherLogFilters()`);
    			$$invalidate(1, otherLoggingFilter = await getOtherLogFilters(sessionId));
    			log(`delayedOtherInit('${sessionId}') RESULT: '${otherLoggingFilter}'`);
    		} catch(err) {
    			alert('' + err);
    		}
    	}

    	function handleOtherLoggingFilter() {
    		setOtherLogFilters(session.otherSocketId, otherLoggingFilter);
    		log.f(`other logging filter (for ${session.otherUserId}) is now set to: '${otherLoggingFilter}'`);
    	}

    	const writable_props = ['otherClientSelector'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FilterOtherLogs> was created with unknown prop '${key}'`);
    	});

    	function chatsessionselector_session_binding(value) {
    		session = value;
    		$$invalidate(0, session);
    	}

    	function input_input_handler() {
    		otherLoggingFilter = this.value;
    		$$invalidate(1, otherLoggingFilter);
    	}

    	$$self.$$set = $$props => {
    		if ('otherClientSelector' in $$props) $$invalidate(7, otherClientSelector = $$props.otherClientSelector);
    	};

    	$$self.$capture_state = () => ({
    		setOtherLogFilters,
    		getOtherLogFilters,
    		logger,
    		log,
    		otherClientSelector,
    		chat,
    		ChatSessionSelector,
    		stateRetention,
    		session,
    		otherLoggingFilter,
    		delayedOtherInit,
    		handleOtherLoggingFilter,
    		$chat
    	});

    	$$self.$inject_state = $$props => {
    		if ('otherClientSelector' in $$props) $$invalidate(7, otherClientSelector = $$props.otherClientSelector);
    		if ('session' in $$props) $$invalidate(0, session = $$props.session);
    		if ('otherLoggingFilter' in $$props) $$invalidate(1, otherLoggingFilter = $$props.otherLoggingFilter);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*session*/ 1) {
    			{
    				// re-initialize otherLoggingFilter whenever session changes
    				delayedOtherInit(session?.otherSocketId);
    			}
    		}
    	};

    	return [
    		session,
    		otherLoggingFilter,
    		$chat,
    		chat,
    		ChatSessionSelector,
    		stateRetention,
    		handleOtherLoggingFilter,
    		otherClientSelector,
    		chatsessionselector_session_binding,
    		input_input_handler
    	];
    }

    class FilterOtherLogs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { otherClientSelector: 7 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FilterOtherLogs",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*otherClientSelector*/ ctx[7] === undefined && !('otherClientSelector' in props)) {
    			console.warn("<FilterOtherLogs> was created without expected prop 'otherClientSelector'");
    		}
    	}

    	get otherClientSelector() {
    		throw new Error("<FilterOtherLogs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set otherClientSelector(value) {
    		throw new Error("<FilterOtherLogs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* ..\server\src\core\util\logger\FilterServerLogs.svelte generated by Svelte v3.50.1 */
    const file$4 = "..\\server\\src\\core\\util\\logger\\FilterServerLogs.svelte";

    function create_fragment$5(ctx) {
    	let form;
    	let label;
    	let t0;
    	let input;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			label = element("label");
    			t0 = text("Server Logging Filter:\r\n    ");
    			input = element("input");
    			t1 = text("\r\n      \r\n    ");
    			button = element("button");
    			button.textContent = "Change";
    			attr_dev(input, "type", "text");
    			add_location(input, file$4, 43, 4, 1717);
    			add_location(button, file$4, 45, 4, 1794);
    			add_location(label, file$4, 41, 2, 1676);
    			attr_dev(form, "onsubmit", "return false;");
    			add_location(form, file$4, 40, 0, 1641);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, label);
    			append_dev(label, t0);
    			append_dev(label, input);
    			set_input_value(input, /*serverLoggingFilter*/ ctx[0]);
    			append_dev(label, t1);
    			append_dev(label, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[2]),
    					listen_dev(button, "click", /*handleServerLoggingFilter*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*serverLoggingFilter*/ 1 && input.value !== /*serverLoggingFilter*/ ctx[0]) {
    				set_input_value(input, /*serverLoggingFilter*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FilterServerLogs', slots, []);
    	const log = logger('vit:core:logger:FilterServerLogs');
    	let serverLoggingFilter = ''; // because the initialization of this is async, we use delayedServerInit (AI: technically we should prob keep in sync with other processes that set this (but would require a notification from the server)

    	async function delayedServerInit() {
    		$$invalidate(0, serverLoggingFilter = await getServerLogFilters());
    	}

    	delayedServerInit();

    	function handleServerLoggingFilter() {
    		setServerLogFilters(serverLoggingFilter);
    		log.f(`server logging filter now set to: '${serverLoggingFilter}'`);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FilterServerLogs> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		serverLoggingFilter = this.value;
    		$$invalidate(0, serverLoggingFilter);
    	}

    	$$self.$capture_state = () => ({
    		setServerLogFilters,
    		getServerLogFilters,
    		logger,
    		log,
    		serverLoggingFilter,
    		delayedServerInit,
    		handleServerLoggingFilter
    	});

    	$$self.$inject_state = $$props => {
    		if ('serverLoggingFilter' in $$props) $$invalidate(0, serverLoggingFilter = $$props.serverLoggingFilter);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [serverLoggingFilter, handleServerLoggingFilter, input_input_handler];
    }

    class FilterServerLogs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FilterServerLogs",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* ..\server\src\core\util\logger\FilterLogs.svelte generated by Svelte v3.50.1 */

    function create_fragment$4(ctx) {
    	let filtermylogs;
    	let t0;
    	let filterotherlogs;
    	let t1;
    	let filterserverlogs;
    	let current;
    	filtermylogs = new FilterMyLogs({ $$inline: true });

    	filterotherlogs = new FilterOtherLogs({
    			props: {
    				otherClientSelector: /*otherClientSelector*/ ctx[0]
    			},
    			$$inline: true
    		});

    	filterserverlogs = new FilterServerLogs({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(filtermylogs.$$.fragment);
    			t0 = space();
    			create_component(filterotherlogs.$$.fragment);
    			t1 = space();
    			create_component(filterserverlogs.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(filtermylogs, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(filterotherlogs, target, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(filterserverlogs, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const filterotherlogs_changes = {};
    			if (dirty & /*otherClientSelector*/ 1) filterotherlogs_changes.otherClientSelector = /*otherClientSelector*/ ctx[0];
    			filterotherlogs.$set(filterotherlogs_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(filtermylogs.$$.fragment, local);
    			transition_in(filterotherlogs.$$.fragment, local);
    			transition_in(filterserverlogs.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(filtermylogs.$$.fragment, local);
    			transition_out(filterotherlogs.$$.fragment, local);
    			transition_out(filterserverlogs.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(filtermylogs, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(filterotherlogs, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(filterserverlogs, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FilterLogs', slots, []);
    	let { otherClientSelector } = $$props;
    	const writable_props = ['otherClientSelector'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FilterLogs> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('otherClientSelector' in $$props) $$invalidate(0, otherClientSelector = $$props.otherClientSelector);
    	};

    	$$self.$capture_state = () => ({
    		FilterMyLogs,
    		FilterOtherLogs,
    		FilterServerLogs,
    		otherClientSelector
    	});

    	$$self.$inject_state = $$props => {
    		if ('otherClientSelector' in $$props) $$invalidate(0, otherClientSelector = $$props.otherClientSelector);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [otherClientSelector];
    }

    class FilterLogs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { otherClientSelector: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FilterLogs",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*otherClientSelector*/ ctx[0] === undefined && !('otherClientSelector' in props)) {
    			console.warn("<FilterLogs> was created without expected prop 'otherClientSelector'");
    		}
    	}

    	get otherClientSelector() {
    		throw new Error("<FilterLogs>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set otherClientSelector(value) {
    		throw new Error("<FilterLogs>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Admin.svelte generated by Svelte v3.50.1 */
    const file$3 = "src\\Admin.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let center;
    	let h4;
    	let t1;
    	let filterlogs;
    	let current;

    	filterlogs = new FilterLogs({
    			props: {
    				otherClientSelector: {
    					chat,
    					ChatSessionSelector,
    					stateRetention
    				}
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			center = element("center");
    			h4 = element("h4");
    			h4.textContent = "Admin";
    			t1 = space();
    			create_component(filterlogs.$$.fragment);
    			add_location(h4, file$3, 12, 4, 452);
    			add_location(center, file$3, 11, 2, 438);
    			add_location(div, file$3, 10, 0, 429);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, center);
    			append_dev(center, h4);
    			append_dev(div, t1);
    			mount_component(filterlogs, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(filterlogs.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(filterlogs.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(filterlogs);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const stateRetention = createStateRetention();

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Admin', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Admin> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		chat,
    		ChatSessionSelector,
    		createStateRetention,
    		FilterLogs,
    		stateRetention
    	});

    	return [];
    }

    class Admin extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Admin",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\SignIn.svelte generated by Svelte v3.50.1 */
    const file$2 = "src\\SignIn.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let h4;
    	let t1;
    	let i;
    	let br0;
    	let br1;
    	let t3;
    	let form;
    	let label0;
    	let t4;
    	let input0;
    	let t5;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div0;
    	let t8;
    	let t9;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h4 = element("h4");
    			h4.textContent = "Welcome to visualize-it!  Please Sign In:";
    			t1 = space();
    			i = element("i");
    			i.textContent = "By signing in to visualize-it, you can perform advanced features (like publish packages) :-)";
    			br0 = element("br");
    			br1 = element("br");
    			t3 = space();
    			form = element("form");
    			label0 = element("label");
    			t4 = text("User ID:  ");
    			input0 = element("input");
    			t5 = space();
    			label1 = element("label");
    			t6 = text("Password: ");
    			input1 = element("input");
    			t7 = space();
    			div0 = element("div");
    			t8 = text(/*userMsg*/ ctx[2]);
    			t9 = space();
    			button = element("button");
    			button.textContent = "Sign In";
    			add_location(h4, file$2, 42, 2, 1349);
    			add_location(i, file$2, 44, 2, 1405);
    			add_location(br0, file$2, 44, 101, 1504);
    			add_location(br1, file$2, 44, 106, 1509);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "autocomplete", "username");
    			input0.autofocus = true;
    			add_location(input0, file$2, 48, 21, 1617);
    			add_location(label0, file$2, 48, 4, 1600);
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "autocomplete", "current-password");
    			add_location(input1, file$2, 49, 21, 1734);
    			add_location(label1, file$2, 49, 4, 1717);
    			attr_dev(div0, "class", "error svelte-1t6gmo2");
    			add_location(div0, file$2, 51, 4, 1824);
    			button.value = "submit";
    			add_location(button, file$2, 53, 4, 1870);
    			attr_dev(form, "onsubmit", "return false;");
    			add_location(form, file$2, 46, 2, 1520);
    			add_location(div1, file$2, 41, 0, 1340);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h4);
    			append_dev(div1, t1);
    			append_dev(div1, i);
    			append_dev(div1, br0);
    			append_dev(div1, br1);
    			append_dev(div1, t3);
    			append_dev(div1, form);
    			append_dev(form, label0);
    			append_dev(label0, t4);
    			append_dev(label0, input0);
    			set_input_value(input0, /*userId*/ ctx[0]);
    			append_dev(form, t5);
    			append_dev(form, label1);
    			append_dev(label1, t6);
    			append_dev(label1, input1);
    			set_input_value(input1, /*pass*/ ctx[1]);
    			append_dev(form, t7);
    			append_dev(form, div0);
    			append_dev(div0, t8);
    			append_dev(form, t9);
    			append_dev(form, button);
    			input0.focus();

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[5]),
    					listen_dev(button, "click", /*handleSignIn*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*userId*/ 1 && input0.value !== /*userId*/ ctx[0]) {
    				set_input_value(input0, /*userId*/ ctx[0]);
    			}

    			if (dirty & /*pass*/ 2 && input1.value !== /*pass*/ ctx[1]) {
    				set_input_value(input1, /*pass*/ ctx[1]);
    			}

    			if (dirty & /*userMsg*/ 4) set_data_dev(t8, /*userMsg*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const log$3 = logger('vit:client:SignIn');

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('SignIn', slots, []);
    	let userId = '';
    	let pass = '';
    	let userMsg = '';

    	async function handleSignIn() {
    		try {
    			// sign-in to server
    			// ... pulling back any message to display to user
    			log$3(`invoking server's signIn process for ${userId}`);

    			$$invalidate(2, userMsg = await signIn(userId, pass));
    			userMsg && log$3(`user problem: ${userMsg}`);

    			// activate our user on our client-side, when successfully signed-in
    			// NOTE: the reflexive user state will cause our router to leave this page!
    			user.activateUser(userId);
    		} catch(e) {
    			// AI: This entire logic is accomplished by discloseError.js BUT needs cleaned up a bit (with it's coupling)
    			//     ... c:/dev/visualize-it/src/util/discloseError.js
    			if (e.isExpected()) {
    				// notify user of expected errors
    				$$invalidate(2, userMsg = e.userMsg);
    			} else {
    				// notify user of unexpected errors, and log detail
    				$$invalidate(2, userMsg = 'Unexpected error in SignIn process ... see logs for detail');

    				log$3.v(`*** ERROR *** Unexpected error in SignIn process: ${e}`, e);
    			}
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<SignIn> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		userId = this.value;
    		$$invalidate(0, userId);
    	}

    	function input1_input_handler() {
    		pass = this.value;
    		$$invalidate(1, pass);
    	}

    	$$self.$capture_state = () => ({
    		logger,
    		log: log$3,
    		user,
    		signIn,
    		userId,
    		pass,
    		userMsg,
    		handleSignIn
    	});

    	$$self.$inject_state = $$props => {
    		if ('userId' in $$props) $$invalidate(0, userId = $$props.userId);
    		if ('pass' in $$props) $$invalidate(1, pass = $$props.pass);
    		if ('userMsg' in $$props) $$invalidate(2, userMsg = $$props.userMsg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		userId,
    		pass,
    		userMsg,
    		handleSignIn,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class SignIn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "SignIn",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    const  log$2 = logger('vit:client:util:longpress');

    // A svelte action that captures and emits a custom "longpress" event
    // ... see: https://stackoverflow.com/questions/56844807/svelte-long-press
    // USAGE:
    //   <p use:longpress={2000} on:longpress={e => alert('long press')}>Long Press Me</p>

    function longpress(node, threshold=500) {

      log$2('USING longpress action');

      let timeout = null;

      function handleMouseDown() {
        log$2('in handleMouseDown()');
    		timeout = setTimeout(handleLongPress, threshold);
    	}

      function handleMouseUp() {
        if (timeout !== null) {
          log$2('canceling longpress processing');
    		  clearTimeout(timeout);
          timeout = null;
        }
      }

      function handleLongPress() {
        log$2('timeout has occurred ... emitting "longpress" CustomEvent');
    		node.dispatchEvent(new CustomEvent('longpress'));
        timeout = null;
      }
    	
      // activate "longpress" processing via "mousedown/mouseup" events
      log$2('activating "mousedown/mouseup" event to implement "longpress"');
    	node.addEventListener('mousedown', handleMouseDown);
    	node.addEventListener('mouseup',   handleMouseUp);
    	
    	return {
    		destroy() {
          log$2('cleaning up longpress action');
    			node.removeEventListener('mousedown', handleMouseDown);
    			node.removeEventListener('mouseup',   handleMouseUp);
    		}
    	};
    }

    /* src\Router.svelte generated by Svelte v3.50.1 */
    const file$1 = "src\\Router.svelte";

    // (73:2) {:else}
    function create_else_block_3(ctx) {
    	let b;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "IDE";
    			attr_dev(b, "class", "link svelte-1p1s816");
    			add_location(b, file$1, 73, 4, 2093);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);

    			if (!mounted) {
    				dispose = listen_dev(b, "click", /*click_handler*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(73:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (71:2) {#if dispComp === IDE}
    function create_if_block_8(ctx) {
    	let b;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "IDE";
    			attr_dev(b, "class", "active svelte-1p1s816");
    			add_location(b, file$1, 71, 4, 2051);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(71:2) {#if dispComp === IDE}",
    		ctx
    	});

    	return block;
    }

    // (83:2) {:else}
    function create_else_block_2(ctx) {
    	let i;

    	const block = {
    		c: function create() {
    			i = element("i");
    			i.textContent = "System";
    			add_location(i, file$1, 83, 4, 2382);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, i, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(i);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(83:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (81:25) 
    function create_if_block_7(ctx) {
    	let b;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "System";
    			attr_dev(b, "class", "link svelte-1p1s816");
    			add_location(b, file$1, 81, 4, 2304);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);

    			if (!mounted) {
    				dispose = listen_dev(b, "click", /*click_handler_1*/ ctx[8], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(81:25) ",
    		ctx
    	});

    	return block;
    }

    // (79:2) {#if dispComp === System}
    function create_if_block_6(ctx) {
    	let b;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "System";
    			attr_dev(b, "class", "active svelte-1p1s816");
    			add_location(b, file$1, 79, 4, 2243);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(79:2) {#if dispComp === System}",
    		ctx
    	});

    	return block;
    }

    // (93:2) {:else}
    function create_else_block_1(ctx) {
    	const block = { c: noop, m: noop, p: noop, d: noop };

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(93:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (91:27) 
    function create_if_block_5(ctx) {
    	let b;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "Chat";
    			attr_dev(b, "class", "link svelte-1p1s816");
    			add_location(b, file$1, 91, 2, 2542);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);

    			if (!mounted) {
    				dispose = listen_dev(b, "click", /*click_handler_2*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(91:27) ",
    		ctx
    	});

    	return block;
    }

    // (89:2) {#if dispComp === Chat}
    function create_if_block_4(ctx) {
    	let b;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "Chat";
    			attr_dev(b, "class", "active svelte-1p1s816");
    			add_location(b, file$1, 89, 2, 2483);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(89:2) {#if dispComp === Chat}",
    		ctx
    	});

    	return block;
    }

    // (101:37) 
    function create_if_block_3(ctx) {
    	let b;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "Admin";
    			attr_dev(b, "class", "link svelte-1p1s816");
    			add_location(b, file$1, 101, 4, 2816);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);

    			if (!mounted) {
    				dispose = listen_dev(b, "click", /*click_handler_3*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(101:37) ",
    		ctx
    	});

    	return block;
    }

    // (99:2) {#if dispComp === Admin}
    function create_if_block_2(ctx) {
    	let b;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "Admin";
    			attr_dev(b, "class", "active svelte-1p1s816");
    			add_location(b, file$1, 99, 4, 2744);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(99:2) {#if dispComp === Admin}",
    		ctx
    	});

    	return block;
    }

    // (118:2) {:else}
    function create_else_block(ctx) {
    	let b;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "Sign In";
    			attr_dev(b, "class", "link svelte-1p1s816");
    			add_location(b, file$1, 118, 4, 3271);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);

    			if (!mounted) {
    				dispose = listen_dev(b, "click", /*handleSignIn*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(118:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (116:32) 
    function create_if_block_1(ctx) {
    	let b;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "Sign In";
    			attr_dev(b, "class", "active svelte-1p1s816");
    			add_location(b, file$1, 116, 4, 3225);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(116:32) ",
    		ctx
    	});

    	return block;
    }

    // (114:2) {#if $user.userId}
    function create_if_block(ctx) {
    	let b;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			b = element("b");
    			b.textContent = "Sign Out";
    			attr_dev(b, "class", "link svelte-1p1s816");
    			add_location(b, file$1, 114, 4, 3132);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, b, anchor);

    			if (!mounted) {
    				dispose = listen_dev(b, "click", /*handleSignOut*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(b);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(114:2) {#if $user.userId}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let b0;
    	let i0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let b1;
    	let t7;

    	let t8_value = (/*$user*/ ctx[2].userId
    	? /*$user*/ ctx[2].userId
    	: 'not-signed-in') + "";

    	let t8;
    	let t9;
    	let t10;
    	let div0;
    	let i1;
    	let t11;
    	let t12;
    	let t13;
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*dispComp*/ ctx[0] === IDE) return create_if_block_8;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*dispComp*/ ctx[0] === System) return create_if_block_6;
    		if (/*$user*/ ctx[2].userId) return create_if_block_7;
    		return create_else_block_2;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*dispComp*/ ctx[0] === Chat) return create_if_block_4;
    		if (/*$chat*/ ctx[1].isActive) return create_if_block_5;
    		return create_else_block_1;
    	}

    	let current_block_type_2 = select_block_type_2(ctx);
    	let if_block2 = current_block_type_2(ctx);

    	function select_block_type_3(ctx, dirty) {
    		if (/*dispComp*/ ctx[0] === Admin) return create_if_block_2;
    		if (/*$user*/ ctx[2].userId === 'admin') return create_if_block_3;
    	}

    	let current_block_type_3 = select_block_type_3(ctx);
    	let if_block3 = current_block_type_3 && current_block_type_3(ctx);

    	function select_block_type_4(ctx, dirty) {
    		if (/*$user*/ ctx[2].userId) return create_if_block;
    		if (/*dispComp*/ ctx[0] === SignIn) return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type_4 = select_block_type_4(ctx);
    	let if_block4 = current_block_type_4(ctx);
    	var switch_value = /*dispComp*/ ctx[0];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			b0 = element("b");
    			i0 = element("i");
    			i0.textContent = "visualize-it";
    			t1 = text("\r\n\r\n     \r\n     \r\n     \r\n\r\n  \r\n     \r\n  ");
    			if_block0.c();
    			t2 = text("  \r\n\r\n  \r\n     \r\n  ");
    			if_block1.c();
    			t3 = text("  \r\n\r\n  \r\n     \r\n  ");
    			if_block2.c();
    			t4 = text("  \r\n\r\n  \r\n     \r\n  ");
    			if (if_block3) if_block3.c();
    			t5 = text("  \r\n\r\n     \r\n     \r\n     \r\n     \r\n  ");
    			b1 = element("b");
    			b1.textContent = "User:";
    			t7 = space();
    			t8 = text(t8_value);
    			t9 = text("\r\n\r\n  \r\n     \r\n  ");
    			if_block4.c();
    			t10 = space();
    			div0 = element("div");
    			i1 = element("i");
    			t11 = text(/*$alert*/ ctx[3]);
    			t12 = text(" ");
    			t13 = space();
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty$1();
    			add_location(i0, file$1, 62, 5, 1830);
    			add_location(b0, file$1, 62, 2, 1827);
    			add_location(b1, file$1, 108, 2, 2980);
    			attr_dev(i1, "class", "alert svelte-1p1s816");
    			add_location(i1, file$1, 123, 4, 3374);
    			add_location(div0, file$1, 122, 2, 3363);
    			add_location(div1, file$1, 60, 0, 1789);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, b0);
    			append_dev(b0, i0);
    			append_dev(div1, t1);
    			if_block0.m(div1, null);
    			append_dev(div1, t2);
    			if_block1.m(div1, null);
    			append_dev(div1, t3);
    			if_block2.m(div1, null);
    			append_dev(div1, t4);
    			if (if_block3) if_block3.m(div1, null);
    			append_dev(div1, t5);
    			append_dev(div1, b1);
    			append_dev(div1, t7);
    			append_dev(div1, t8);
    			append_dev(div1, t9);
    			if_block4.m(div1, null);
    			append_dev(div1, t10);
    			append_dev(div1, div0);
    			append_dev(div0, i1);
    			append_dev(i1, t11);
    			append_dev(i1, t12);
    			insert_dev(target, t13, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(longpress.call(null, i0, 2000)),
    					listen_dev(i0, "longpress", /*handleEasterEgg*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div1, t2);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div1, t3);
    				}
    			}

    			if (current_block_type_2 === (current_block_type_2 = select_block_type_2(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type_2(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div1, t4);
    				}
    			}

    			if (current_block_type_3 === (current_block_type_3 = select_block_type_3(ctx)) && if_block3) {
    				if_block3.p(ctx, dirty);
    			} else {
    				if (if_block3) if_block3.d(1);
    				if_block3 = current_block_type_3 && current_block_type_3(ctx);

    				if (if_block3) {
    					if_block3.c();
    					if_block3.m(div1, t5);
    				}
    			}

    			if ((!current || dirty & /*$user*/ 4) && t8_value !== (t8_value = (/*$user*/ ctx[2].userId
    			? /*$user*/ ctx[2].userId
    			: 'not-signed-in') + "")) set_data_dev(t8, t8_value);

    			if (current_block_type_4 === (current_block_type_4 = select_block_type_4(ctx)) && if_block4) {
    				if_block4.p(ctx, dirty);
    			} else {
    				if_block4.d(1);
    				if_block4 = current_block_type_4(ctx);

    				if (if_block4) {
    					if_block4.c();
    					if_block4.m(div1, t10);
    				}
    			}

    			if (!current || dirty & /*$alert*/ 8) set_data_dev(t11, /*$alert*/ ctx[3]);

    			if (switch_value !== (switch_value = /*dispComp*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if_block0.d();
    			if_block1.d();
    			if_block2.d();

    			if (if_block3) {
    				if_block3.d();
    			}

    			if_block4.d();
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const log$1 = logger('vit:client:Router');

    function instance$1($$self, $$props, $$invalidate) {
    	let $chat;
    	let $user;
    	let $alert;
    	validate_store(chat, 'chat');
    	component_subscribe($$self, chat, $$value => $$invalidate(1, $chat = $$value));
    	validate_store(user, 'user');
    	component_subscribe($$self, user, $$value => $$invalidate(2, $user = $$value));
    	validate_store(alert$1, 'alert');
    	component_subscribe($$self, alert$1, $$value => $$invalidate(3, $alert = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, []);
    	let dispComp = IDE; // default to IDE

    	function handleSignIn() {
    		$$invalidate(0, dispComp = SignIn); // display sign-in screen
    	}

    	function handleSignOut() {
    		signOut(); // sign-out of server
    		user.deactivateUser(); // de-activate our user on our client-side
    	}

    	function handleEasterEgg() {
    		log$1('handleEasterEgg ... longpress event occurred!');
    		chat.solicitPrivateMsg(); // ?? test
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, dispComp = IDE);
    	const click_handler_1 = () => $$invalidate(0, dispComp = System);
    	const click_handler_2 = () => $$invalidate(0, dispComp = Chat);
    	const click_handler_3 = () => $$invalidate(0, dispComp = Admin);

    	$$self.$capture_state = () => ({
    		logger,
    		log: log$1,
    		IDE,
    		System,
    		Chat,
    		Admin,
    		SignIn,
    		user,
    		chat,
    		signOut,
    		alert: alert$1,
    		longpress,
    		dispComp,
    		handleSignIn,
    		handleSignOut,
    		handleEasterEgg,
    		$chat,
    		$user,
    		$alert
    	});

    	$$self.$inject_state = $$props => {
    		if ('dispComp' in $$props) $$invalidate(0, dispComp = $$props.dispComp);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$user, dispComp, $chat*/ 7) {
    			{
    				// ... some reflexive routing logic
    				// reflexively move OFF the SignIn screen, once user has successfully signed-in
    				if ($user.userId && dispComp === SignIn) {
    					$$invalidate(0, dispComp = IDE);
    				} else // reflexively move OFF the System screen, if user signed-out
    				if (!$user.userId && dispComp === System) {
    					$$invalidate(0, dispComp = IDE);
    				} else // reflexively move OFF the Admin screen, if NOT an administrive user (or logged out)
    				if ($user.userId !== 'admin' && dispComp === Admin) {
    					$$invalidate(0, dispComp = IDE);
    				} else // reflexively move OFF the Chat screen, if user deactivates chat
    				if (!$chat.isActive && dispComp === Chat) {
    					$$invalidate(0, dispComp = IDE);
    				}
    			}
    		}
    	};

    	return [
    		dispComp,
    		$chat,
    		$user,
    		$alert,
    		handleSignIn,
    		handleSignOut,
    		handleEasterEgg,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.50.1 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let router;
    	let current;
    	router = new Router({ $$inline: true });

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(router.$$.fragment);
    			attr_dev(main, "class", "svelte-102bp21");
    			add_location(main, file, 4, 0, 59);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(router, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(router);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Router });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /**
     * Standardize the ability to handle ALL errors more generically, by
     * adding these value-added extensions to ALL Error objects (via this
     * Error class polyfill - a monkey patch).
     * 
     * All Error instances (created anywhere) are extended to include the
     * following characteristics:
     * 
     * - A new error.userMsg property is defined.
     * 
     *   This message is intended to be seen by users, so it should be
     *   suitable for human consumption:
     *     - both in meaning, 
     *     - and in sanitation (so as to not reveal any internal
     *       architecture)
     * 
     *   By default, error.userMsg = 'Unexpected Condition'
     *   and can be changed by: 
     *     + error.defineUserMsg(userMsg): error
     * 
     * - There is a delineation of expected vs. unexpected conditions.  For
     *   example:
     * 
     *     - An error communicating "invalid password" is an expected
     *       condition, because it is stimulated by user input.
     * 
     *     - Contrast that with an error communicating "DB is down", which is
     *       an unexpected condition, because this is outside the user's
     *       control.
     * 
     *   This distinction is controlled by whether an error.userMsg has
     *   been defined (expected) or not (unexpected).
     * 
     *   In other words, all errors start out as unexpected, and can be
     *   changed to expected by simply invoking:
     *     + error.defineUserMsg(userMsg): error
     * 
     *   This distinction may be programmatically delineated through one of
     *   the following methods:
     *     + error.isExpected(): boolean
     *     + error.isUnexpected(): boolean
     * 
     * - A new error.attemptingToMsg property is defined.
     * 
     *   This message is also intended to be seen by users, and provides
     *   additional detail of what was being attempted (over and above the
     *   error.userMsg).
     * 
     *   By default, error.attemptingToMsg = ''
     *   and can be changed by: 
     *     + error.defineAttemptingToMsg(attemptingToMsg): error
     * 
     * - A new error.formatUserMsg() is provided that combines all
     *   user-specific messages (userMsg and attemptingToMsg).
     * 
     *     + error.formatUserMsg(): string
     * 
     * - The toString() method has been extended to suffix the base
     *   toString() with user-specific messages.
     * 
     * - All of the new "defining" methods return the receiving error,
     *   so as to allow them to be conveniently chained.  For example:
     * 
     *     throw new Error('catastrophic details here').defineAttemptingToMsg('sign in');
     * 
     * **Usage Scenarios** are as follows:
     * 
     * - Error Origination
     * 
     *   In throwing a new Error, you can:
     *     throw new Error('internal technical error details')
     *                 .defineUserMsg('You did not bla')           // ONLY INVOKE if this is an expected condition - otherwise default to: 'Unexpected Condition'
     *                 .defineAttemptingToMsg('log into the app'); // optionally provide additional clarification in either case (expected/unexpected)
     * 
     * - Error Pass Through
     * 
     *   Within a mid-level service, you may capture an error from a lower
     *   point and supplement it as follows:
     * 
     *     catch(err) {
     *       throw err.defineUserMsg('You did not bla')           // ONLY INVOKE if this is an expected condition - otherwise default to: 'Unexpected Condition'
     *                .defineAttemptingToMsg('log into the app'); // optionally provide additional clarification in either case (expected/unexpected)
     *     }
     * 
     * - Error Consumption (by client)
     * 
     *   Using these enhancements, the client can abstractly apply various
     *   heuristics, such as:
     *
     *     - if logging is necessary
     *       * if so, reveal complete context (internal details and user context)
     *     - if user notification necessary
     *       * if so supply info suitable for human consumption
     * 
     *   For more usage scenarios, please refer to the discloseError.js utility.
     */

    /* eslint-disable no-extend-native */  // we are very careful NOT to break native behavior of the Error object

    if (!Error.prototype.defineUserMsg) { // key off of one of several extension points

      /**
       * Define a user-specific message, that is applicable for human
       * consumption:
       *  - both in meaning, 
       *  - and in sanitization (so as to not reveal any internal architecture).
       *
       * This method also delineates the error as an expected condition.
       *
       * @param {String} userMsg the user message to define
       *
       * @return {Error} self, supporting convenient Error method chaining.
       */
      Error.prototype.defineUserMsg = function(userMsg) {
        this.userMsg  = userMsg;
        this.expected = true;
        return this;
      };
      Error.prototype.userMsg = "Unexpected Condition"; // prototype provides the default


      /**
       * Return an indicator as to whether this error was
       * expected (say user input error),
       * or not (say a catastrophic error).
       *
       * @return {boolean} error expected (true) or not (false).
       */
      Error.prototype.isExpected = function() {
        return this.expected;
      };
      Error.prototype.expected = false; // prototype provides the default


      /**
       * Return an indicator as to whether this error was
       * unexpected (say a catastrophic error),
       * or not (say user input error).
       *
       * @return {boolean} error unexpected (true) or not (false).
       */
      Error.prototype.isUnexpected = function() {
        return !this.expected;
      };


      /**
       * Define a user-specific 'attempting to' message, that provides
       * additional details of what was being attempted.
       *
       * Errors with this context are prefixed with ' ... attempting to: ',
       * so word your phrasing appropriately.
       * 
       * Multiple attempting-to phrases can be used, which will be
       * combined with the ', -and- ' phrase.
       *
       * @param {String} attemptingToMsg the user-specific attempting
       * to' message.
       *
       * @return {Error} self, supporting convenient Error method chaining.
       */
      Error.prototype.defineAttemptingToMsg = function(attemptingToMsg) {
        if (this.attemptingToMsg) // append multiples
          this.attemptingToMsg += `, -and- ${attemptingToMsg}`;
        else                      // initial definition
          this.attemptingToMsg += ` ... attempting to: ${attemptingToMsg}`;
        return this;
      };
      Error.prototype.attemptingToMsg = ''; // prototype provides the default


      /**
       * Format a user-specific message, combining all user-specific contexts.
       *
       * @return {string} formatted user message.
       */
      Error.prototype.formatUserMsg = function() {
        return this.userMsg + this.attemptingToMsg;
      };


      /**
       * Extend the Error toString() to prefix user-specific context.
       */
      const prior_toString = Error.prototype.toString; // monkey patch
      Error.prototype.toString = function() {
        return prior_toString.call(this) + '\n\nUser Msg: ' + this.formatUserMsg();
      };


      // L8TR:
      // /**
      //  * Define an indicator as to the cause of this error ... used to apply
      //  * various heuristics, such as whether logging is necessary.
      //  *
      //  * The following indicators are available:
      //  *   Error.Cause {
      //  *     UNEXPECTED_CONDITION        [default]
      //  *     RECOGNIZED_USER_ERROR
      //  *   }
      //  *
      //  * @param {String} cause one of Error.Cause.
      //  *
      //  * @return {Error} self, supporting convenient Error method chaining.
      //  */
      // Error.prototype.defineCause = function(cause) {
      //   this.cause = cause;
      //   return this;
      // };
      // 
      // Error.Cause = {
      //   UNEXPECTED_CONDITION:    'UNEXPECTED_CONDITION',
      //   RECOGNIZED_USER_ERROR: 'RECOGNIZED_USER_ERROR'
      // };
      // 
      // Error.prototype.cause = Error.Cause.UNEXPECTED_CONDITION; // prototype provides the default

    }

    const PACKET_TYPES = Object.create(null); // no Map = no polyfill
    PACKET_TYPES["open"] = "0";
    PACKET_TYPES["close"] = "1";
    PACKET_TYPES["ping"] = "2";
    PACKET_TYPES["pong"] = "3";
    PACKET_TYPES["message"] = "4";
    PACKET_TYPES["upgrade"] = "5";
    PACKET_TYPES["noop"] = "6";
    const PACKET_TYPES_REVERSE = Object.create(null);
    Object.keys(PACKET_TYPES).forEach(key => {
        PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
    });
    const ERROR_PACKET = { type: "error", data: "parser error" };

    const withNativeBlob$1 = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
    const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
    // ArrayBuffer.isView method is not defined in IE10
    const isView$1 = obj => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj && obj.buffer instanceof ArrayBuffer;
    };
    const encodePacket = ({ type, data }, supportsBinary, callback) => {
        if (withNativeBlob$1 && data instanceof Blob) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(data, callback);
            }
        }
        else if (withNativeArrayBuffer$2 &&
            (data instanceof ArrayBuffer || isView$1(data))) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(new Blob([data]), callback);
            }
        }
        // plain string
        return callback(PACKET_TYPES[type] + (data || ""));
    };
    const encodeBlobAsBase64 = (data, callback) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const content = fileReader.result.split(",")[1];
            callback("b" + content);
        };
        return fileReader.readAsDataURL(data);
    };

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // Use a lookup table to find the index.
    const lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup$1[chars.charCodeAt(i)] = i;
    }
    const decode$1 = (base64) => {
        let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
        if (base64[base64.length - 1] === '=') {
            bufferLength--;
            if (base64[base64.length - 2] === '=') {
                bufferLength--;
            }
        }
        const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
        for (i = 0; i < len; i += 4) {
            encoded1 = lookup$1[base64.charCodeAt(i)];
            encoded2 = lookup$1[base64.charCodeAt(i + 1)];
            encoded3 = lookup$1[base64.charCodeAt(i + 2)];
            encoded4 = lookup$1[base64.charCodeAt(i + 3)];
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
        return arraybuffer;
    };

    const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
    const decodePacket = (encodedPacket, binaryType) => {
        if (typeof encodedPacket !== "string") {
            return {
                type: "message",
                data: mapBinary(encodedPacket, binaryType)
            };
        }
        const type = encodedPacket.charAt(0);
        if (type === "b") {
            return {
                type: "message",
                data: decodeBase64Packet(encodedPacket.substring(1), binaryType)
            };
        }
        const packetType = PACKET_TYPES_REVERSE[type];
        if (!packetType) {
            return ERROR_PACKET;
        }
        return encodedPacket.length > 1
            ? {
                type: PACKET_TYPES_REVERSE[type],
                data: encodedPacket.substring(1)
            }
            : {
                type: PACKET_TYPES_REVERSE[type]
            };
    };
    const decodeBase64Packet = (data, binaryType) => {
        if (withNativeArrayBuffer$1) {
            const decoded = decode$1(data);
            return mapBinary(decoded, binaryType);
        }
        else {
            return { base64: true, data }; // fallback for old browsers
        }
    };
    const mapBinary = (data, binaryType) => {
        switch (binaryType) {
            case "blob":
                return data instanceof ArrayBuffer ? new Blob([data]) : data;
            case "arraybuffer":
            default:
                return data; // assuming the data is already an ArrayBuffer
        }
    };

    const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
    const encodePayload = (packets, callback) => {
        // some packets may be added to the array while encoding, so the initial length must be saved
        const length = packets.length;
        const encodedPackets = new Array(length);
        let count = 0;
        packets.forEach((packet, i) => {
            // force base64 encoding for binary packets
            encodePacket(packet, false, encodedPacket => {
                encodedPackets[i] = encodedPacket;
                if (++count === length) {
                    callback(encodedPackets.join(SEPARATOR));
                }
            });
        });
    };
    const decodePayload = (encodedPayload, binaryType) => {
        const encodedPackets = encodedPayload.split(SEPARATOR);
        const packets = [];
        for (let i = 0; i < encodedPackets.length; i++) {
            const decodedPacket = decodePacket(encodedPackets[i], binaryType);
            packets.push(decodedPacket);
            if (decodedPacket.type === "error") {
                break;
            }
        }
        return packets;
    };
    const protocol$1 = 4;

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter(obj) {
      if (obj) return mixin(obj);
    }

    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin(obj) {
      for (var key in Emitter.prototype) {
        obj[key] = Emitter.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.on =
    Emitter.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.off =
    Emitter.prototype.removeListener =
    Emitter.prototype.removeAllListeners =
    Emitter.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }

      // Remove event specific arrays for event types that no
      // one is subscribed for to avoid memory leak.
      if (callbacks.length === 0) {
        delete this._callbacks['$' + event];
      }

      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};

      var args = new Array(arguments.length - 1)
        , callbacks = this._callbacks['$' + event];

      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    // alias used for reserved events (protected method)
    Emitter.prototype.emitReserved = Emitter.prototype.emit;

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };

    const globalThisShim = (() => {
        if (typeof self !== "undefined") {
            return self;
        }
        else if (typeof window !== "undefined") {
            return window;
        }
        else {
            return Function("return this")();
        }
    })();

    function pick(obj, ...attr) {
        return attr.reduce((acc, k) => {
            if (obj.hasOwnProperty(k)) {
                acc[k] = obj[k];
            }
            return acc;
        }, {});
    }
    // Keep a reference to the real timeout functions so they can be used when overridden
    const NATIVE_SET_TIMEOUT = setTimeout;
    const NATIVE_CLEAR_TIMEOUT = clearTimeout;
    function installTimerFunctions(obj, opts) {
        if (opts.useNativeTimers) {
            obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
            obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
        }
        else {
            obj.setTimeoutFn = setTimeout.bind(globalThisShim);
            obj.clearTimeoutFn = clearTimeout.bind(globalThisShim);
        }
    }
    // base64 encoded buffers are about 33% bigger (https://en.wikipedia.org/wiki/Base64)
    const BASE64_OVERHEAD = 1.33;
    // we could also have used `new Blob([obj]).size`, but it isn't supported in IE9
    function byteLength(obj) {
        if (typeof obj === "string") {
            return utf8Length(obj);
        }
        // arraybuffer or blob
        return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
    }
    function utf8Length(str) {
        let c = 0, length = 0;
        for (let i = 0, l = str.length; i < l; i++) {
            c = str.charCodeAt(i);
            if (c < 0x80) {
                length += 1;
            }
            else if (c < 0x800) {
                length += 2;
            }
            else if (c < 0xd800 || c >= 0xe000) {
                length += 3;
            }
            else {
                i++;
                length += 4;
            }
        }
        return length;
    }

    class TransportError extends Error {
        constructor(reason, description, context) {
            super(reason);
            this.description = description;
            this.context = context;
            this.type = "TransportError";
        }
    }
    class Transport extends Emitter {
        /**
         * Transport abstract constructor.
         *
         * @param {Object} options.
         * @api private
         */
        constructor(opts) {
            super();
            this.writable = false;
            installTimerFunctions(this, opts);
            this.opts = opts;
            this.query = opts.query;
            this.readyState = "";
            this.socket = opts.socket;
        }
        /**
         * Emits an error.
         *
         * @param {String} reason
         * @param description
         * @param context - the error context
         * @return {Transport} for chaining
         * @api protected
         */
        onError(reason, description, context) {
            super.emitReserved("error", new TransportError(reason, description, context));
            return this;
        }
        /**
         * Opens the transport.
         *
         * @api public
         */
        open() {
            if ("closed" === this.readyState || "" === this.readyState) {
                this.readyState = "opening";
                this.doOpen();
            }
            return this;
        }
        /**
         * Closes the transport.
         *
         * @api public
         */
        close() {
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.doClose();
                this.onClose();
            }
            return this;
        }
        /**
         * Sends multiple packets.
         *
         * @param {Array} packets
         * @api public
         */
        send(packets) {
            if ("open" === this.readyState) {
                this.write(packets);
            }
        }
        /**
         * Called upon open
         *
         * @api protected
         */
        onOpen() {
            this.readyState = "open";
            this.writable = true;
            super.emitReserved("open");
        }
        /**
         * Called with data.
         *
         * @param {String} data
         * @api protected
         */
        onData(data) {
            const packet = decodePacket(data, this.socket.binaryType);
            this.onPacket(packet);
        }
        /**
         * Called with a decoded packet.
         *
         * @api protected
         */
        onPacket(packet) {
            super.emitReserved("packet", packet);
        }
        /**
         * Called upon close.
         *
         * @api protected
         */
        onClose(details) {
            this.readyState = "closed";
            super.emitReserved("close", details);
        }
    }

    // imported from https://github.com/unshiftio/yeast
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split(''), length = 64, map = {};
    let seed = 0, i = 0, prev;
    /**
     * Return a string representing the specified number.
     *
     * @param {Number} num The number to convert.
     * @returns {String} The string representation of the number.
     * @api public
     */
    function encode$1(num) {
        let encoded = '';
        do {
            encoded = alphabet[num % length] + encoded;
            num = Math.floor(num / length);
        } while (num > 0);
        return encoded;
    }
    /**
     * Yeast: A tiny growing id generator.
     *
     * @returns {String} A unique id.
     * @api public
     */
    function yeast() {
        const now = encode$1(+new Date());
        if (now !== prev)
            return seed = 0, prev = now;
        return now + '.' + encode$1(seed++);
    }
    //
    // Map each character to its index.
    //
    for (; i < length; i++)
        map[alphabet[i]] = i;

    // imported from https://github.com/galkn/querystring
    /**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */
    function encode(obj) {
        let str = '';
        for (let i in obj) {
            if (obj.hasOwnProperty(i)) {
                if (str.length)
                    str += '&';
                str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
            }
        }
        return str;
    }
    /**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */
    function decode(qs) {
        let qry = {};
        let pairs = qs.split('&');
        for (let i = 0, l = pairs.length; i < l; i++) {
            let pair = pairs[i].split('=');
            qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
        return qry;
    }

    // imported from https://github.com/component/has-cors
    let value = false;
    try {
        value = typeof XMLHttpRequest !== 'undefined' &&
            'withCredentials' in new XMLHttpRequest();
    }
    catch (err) {
        // if XMLHttp support is disabled in IE then it will throw
        // when trying to create
    }
    const hasCORS = value;

    // browser shim for xmlhttprequest module
    function XHR(opts) {
        const xdomain = opts.xdomain;
        // XMLHttpRequest can be disabled on IE
        try {
            if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
                return new XMLHttpRequest();
            }
        }
        catch (e) { }
        if (!xdomain) {
            try {
                return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
            }
            catch (e) { }
        }
    }

    function empty() { }
    const hasXHR2 = (function () {
        const xhr = new XHR({
            xdomain: false
        });
        return null != xhr.responseType;
    })();
    class Polling extends Transport {
        /**
         * XHR Polling constructor.
         *
         * @param {Object} opts
         * @api public
         */
        constructor(opts) {
            super(opts);
            this.polling = false;
            if (typeof location !== "undefined") {
                const isSSL = "https:" === location.protocol;
                let port = location.port;
                // some user agents have empty `location.port`
                if (!port) {
                    port = isSSL ? "443" : "80";
                }
                this.xd =
                    (typeof location !== "undefined" &&
                        opts.hostname !== location.hostname) ||
                        port !== opts.port;
                this.xs = opts.secure !== isSSL;
            }
            /**
             * XHR supports binary
             */
            const forceBase64 = opts && opts.forceBase64;
            this.supportsBinary = hasXHR2 && !forceBase64;
        }
        /**
         * Transport name.
         */
        get name() {
            return "polling";
        }
        /**
         * Opens the socket (triggers polling). We write a PING message to determine
         * when the transport is open.
         *
         * @api private
         */
        doOpen() {
            this.poll();
        }
        /**
         * Pauses polling.
         *
         * @param {Function} callback upon buffers are flushed and transport is paused
         * @api private
         */
        pause(onPause) {
            this.readyState = "pausing";
            const pause = () => {
                this.readyState = "paused";
                onPause();
            };
            if (this.polling || !this.writable) {
                let total = 0;
                if (this.polling) {
                    total++;
                    this.once("pollComplete", function () {
                        --total || pause();
                    });
                }
                if (!this.writable) {
                    total++;
                    this.once("drain", function () {
                        --total || pause();
                    });
                }
            }
            else {
                pause();
            }
        }
        /**
         * Starts polling cycle.
         *
         * @api public
         */
        poll() {
            this.polling = true;
            this.doPoll();
            this.emitReserved("poll");
        }
        /**
         * Overloads onData to detect payloads.
         *
         * @api private
         */
        onData(data) {
            const callback = packet => {
                // if its the first message we consider the transport open
                if ("opening" === this.readyState && packet.type === "open") {
                    this.onOpen();
                }
                // if its a close packet, we close the ongoing requests
                if ("close" === packet.type) {
                    this.onClose({ description: "transport closed by the server" });
                    return false;
                }
                // otherwise bypass onData and handle the message
                this.onPacket(packet);
            };
            // decode payload
            decodePayload(data, this.socket.binaryType).forEach(callback);
            // if an event did not trigger closing
            if ("closed" !== this.readyState) {
                // if we got data we're not polling
                this.polling = false;
                this.emitReserved("pollComplete");
                if ("open" === this.readyState) {
                    this.poll();
                }
            }
        }
        /**
         * For polling, send a close packet.
         *
         * @api private
         */
        doClose() {
            const close = () => {
                this.write([{ type: "close" }]);
            };
            if ("open" === this.readyState) {
                close();
            }
            else {
                // in case we're trying to close while
                // handshaking is in progress (GH-164)
                this.once("open", close);
            }
        }
        /**
         * Writes a packets payload.
         *
         * @param {Array} data packets
         * @param {Function} drain callback
         * @api private
         */
        write(packets) {
            this.writable = false;
            encodePayload(packets, data => {
                this.doWrite(data, () => {
                    this.writable = true;
                    this.emitReserved("drain");
                });
            });
        }
        /**
         * Generates uri for connection.
         *
         * @api private
         */
        uri() {
            let query = this.query || {};
            const schema = this.opts.secure ? "https" : "http";
            let port = "";
            // cache busting is forced
            if (false !== this.opts.timestampRequests) {
                query[this.opts.timestampParam] = yeast();
            }
            if (!this.supportsBinary && !query.sid) {
                query.b64 = 1;
            }
            // avoid port if default for schema
            if (this.opts.port &&
                (("https" === schema && Number(this.opts.port) !== 443) ||
                    ("http" === schema && Number(this.opts.port) !== 80))) {
                port = ":" + this.opts.port;
            }
            const encodedQuery = encode(query);
            const ipv6 = this.opts.hostname.indexOf(":") !== -1;
            return (schema +
                "://" +
                (ipv6 ? "[" + this.opts.hostname + "]" : this.opts.hostname) +
                port +
                this.opts.path +
                (encodedQuery.length ? "?" + encodedQuery : ""));
        }
        /**
         * Creates a request.
         *
         * @param {String} method
         * @api private
         */
        request(opts = {}) {
            Object.assign(opts, { xd: this.xd, xs: this.xs }, this.opts);
            return new Request(this.uri(), opts);
        }
        /**
         * Sends data.
         *
         * @param {String} data to send.
         * @param {Function} called upon flush.
         * @api private
         */
        doWrite(data, fn) {
            const req = this.request({
                method: "POST",
                data: data
            });
            req.on("success", fn);
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr post error", xhrStatus, context);
            });
        }
        /**
         * Starts a poll cycle.
         *
         * @api private
         */
        doPoll() {
            const req = this.request();
            req.on("data", this.onData.bind(this));
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr poll error", xhrStatus, context);
            });
            this.pollXhr = req;
        }
    }
    class Request extends Emitter {
        /**
         * Request constructor
         *
         * @param {Object} options
         * @api public
         */
        constructor(uri, opts) {
            super();
            installTimerFunctions(this, opts);
            this.opts = opts;
            this.method = opts.method || "GET";
            this.uri = uri;
            this.async = false !== opts.async;
            this.data = undefined !== opts.data ? opts.data : null;
            this.create();
        }
        /**
         * Creates the XHR object and sends the request.
         *
         * @api private
         */
        create() {
            const opts = pick(this.opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
            opts.xdomain = !!this.opts.xd;
            opts.xscheme = !!this.opts.xs;
            const xhr = (this.xhr = new XHR(opts));
            try {
                xhr.open(this.method, this.uri, this.async);
                try {
                    if (this.opts.extraHeaders) {
                        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                        for (let i in this.opts.extraHeaders) {
                            if (this.opts.extraHeaders.hasOwnProperty(i)) {
                                xhr.setRequestHeader(i, this.opts.extraHeaders[i]);
                            }
                        }
                    }
                }
                catch (e) { }
                if ("POST" === this.method) {
                    try {
                        xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                    }
                    catch (e) { }
                }
                try {
                    xhr.setRequestHeader("Accept", "*/*");
                }
                catch (e) { }
                // ie6 check
                if ("withCredentials" in xhr) {
                    xhr.withCredentials = this.opts.withCredentials;
                }
                if (this.opts.requestTimeout) {
                    xhr.timeout = this.opts.requestTimeout;
                }
                xhr.onreadystatechange = () => {
                    if (4 !== xhr.readyState)
                        return;
                    if (200 === xhr.status || 1223 === xhr.status) {
                        this.onLoad();
                    }
                    else {
                        // make sure the `error` event handler that's user-set
                        // does not throw in the same tick and gets caught here
                        this.setTimeoutFn(() => {
                            this.onError(typeof xhr.status === "number" ? xhr.status : 0);
                        }, 0);
                    }
                };
                xhr.send(this.data);
            }
            catch (e) {
                // Need to defer since .create() is called directly from the constructor
                // and thus the 'error' event can only be only bound *after* this exception
                // occurs.  Therefore, also, we cannot throw here at all.
                this.setTimeoutFn(() => {
                    this.onError(e);
                }, 0);
                return;
            }
            if (typeof document !== "undefined") {
                this.index = Request.requestsCount++;
                Request.requests[this.index] = this;
            }
        }
        /**
         * Called upon error.
         *
         * @api private
         */
        onError(err) {
            this.emitReserved("error", err, this.xhr);
            this.cleanup(true);
        }
        /**
         * Cleans up house.
         *
         * @api private
         */
        cleanup(fromError) {
            if ("undefined" === typeof this.xhr || null === this.xhr) {
                return;
            }
            this.xhr.onreadystatechange = empty;
            if (fromError) {
                try {
                    this.xhr.abort();
                }
                catch (e) { }
            }
            if (typeof document !== "undefined") {
                delete Request.requests[this.index];
            }
            this.xhr = null;
        }
        /**
         * Called upon load.
         *
         * @api private
         */
        onLoad() {
            const data = this.xhr.responseText;
            if (data !== null) {
                this.emitReserved("data", data);
                this.emitReserved("success");
                this.cleanup();
            }
        }
        /**
         * Aborts the request.
         *
         * @api public
         */
        abort() {
            this.cleanup();
        }
    }
    Request.requestsCount = 0;
    Request.requests = {};
    /**
     * Aborts pending requests when unloading the window. This is needed to prevent
     * memory leaks (e.g. when using IE) and to ensure that no spurious error is
     * emitted.
     */
    if (typeof document !== "undefined") {
        // @ts-ignore
        if (typeof attachEvent === "function") {
            // @ts-ignore
            attachEvent("onunload", unloadHandler);
        }
        else if (typeof addEventListener === "function") {
            const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
            addEventListener(terminationEvent, unloadHandler, false);
        }
    }
    function unloadHandler() {
        for (let i in Request.requests) {
            if (Request.requests.hasOwnProperty(i)) {
                Request.requests[i].abort();
            }
        }
    }

    const nextTick = (() => {
        const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
        if (isPromiseAvailable) {
            return cb => Promise.resolve().then(cb);
        }
        else {
            return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
        }
    })();
    const WebSocket = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
    const usingBrowserWebSocket = true;
    const defaultBinaryType = "arraybuffer";

    // detect ReactNative environment
    const isReactNative = typeof navigator !== "undefined" &&
        typeof navigator.product === "string" &&
        navigator.product.toLowerCase() === "reactnative";
    class WS extends Transport {
        /**
         * WebSocket transport constructor.
         *
         * @api {Object} connection options
         * @api public
         */
        constructor(opts) {
            super(opts);
            this.supportsBinary = !opts.forceBase64;
        }
        /**
         * Transport name.
         *
         * @api public
         */
        get name() {
            return "websocket";
        }
        /**
         * Opens socket.
         *
         * @api private
         */
        doOpen() {
            if (!this.check()) {
                // let probe timeout
                return;
            }
            const uri = this.uri();
            const protocols = this.opts.protocols;
            // React Native only supports the 'headers' option, and will print a warning if anything else is passed
            const opts = isReactNative
                ? {}
                : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
            if (this.opts.extraHeaders) {
                opts.headers = this.opts.extraHeaders;
            }
            try {
                this.ws =
                    usingBrowserWebSocket && !isReactNative
                        ? protocols
                            ? new WebSocket(uri, protocols)
                            : new WebSocket(uri)
                        : new WebSocket(uri, protocols, opts);
            }
            catch (err) {
                return this.emitReserved("error", err);
            }
            this.ws.binaryType = this.socket.binaryType || defaultBinaryType;
            this.addEventListeners();
        }
        /**
         * Adds event listeners to the socket
         *
         * @api private
         */
        addEventListeners() {
            this.ws.onopen = () => {
                if (this.opts.autoUnref) {
                    this.ws._socket.unref();
                }
                this.onOpen();
            };
            this.ws.onclose = closeEvent => this.onClose({
                description: "websocket connection closed",
                context: closeEvent
            });
            this.ws.onmessage = ev => this.onData(ev.data);
            this.ws.onerror = e => this.onError("websocket error", e);
        }
        /**
         * Writes data to socket.
         *
         * @param {Array} array of packets.
         * @api private
         */
        write(packets) {
            this.writable = false;
            // encodePacket efficient as it uses WS framing
            // no need for encodePayload
            for (let i = 0; i < packets.length; i++) {
                const packet = packets[i];
                const lastPacket = i === packets.length - 1;
                encodePacket(packet, this.supportsBinary, data => {
                    // always create a new object (GH-437)
                    const opts = {};
                    // Sometimes the websocket has already been closed but the browser didn't
                    // have a chance of informing us about it yet, in that case send will
                    // throw an error
                    try {
                        if (usingBrowserWebSocket) {
                            // TypeError is thrown when passing the second argument on Safari
                            this.ws.send(data);
                        }
                    }
                    catch (e) {
                    }
                    if (lastPacket) {
                        // fake drain
                        // defer to next tick to allow Socket to clear writeBuffer
                        nextTick(() => {
                            this.writable = true;
                            this.emitReserved("drain");
                        }, this.setTimeoutFn);
                    }
                });
            }
        }
        /**
         * Closes socket.
         *
         * @api private
         */
        doClose() {
            if (typeof this.ws !== "undefined") {
                this.ws.close();
                this.ws = null;
            }
        }
        /**
         * Generates uri for connection.
         *
         * @api private
         */
        uri() {
            let query = this.query || {};
            const schema = this.opts.secure ? "wss" : "ws";
            let port = "";
            // avoid port if default for schema
            if (this.opts.port &&
                (("wss" === schema && Number(this.opts.port) !== 443) ||
                    ("ws" === schema && Number(this.opts.port) !== 80))) {
                port = ":" + this.opts.port;
            }
            // append timestamp to URI
            if (this.opts.timestampRequests) {
                query[this.opts.timestampParam] = yeast();
            }
            // communicate binary support capabilities
            if (!this.supportsBinary) {
                query.b64 = 1;
            }
            const encodedQuery = encode(query);
            const ipv6 = this.opts.hostname.indexOf(":") !== -1;
            return (schema +
                "://" +
                (ipv6 ? "[" + this.opts.hostname + "]" : this.opts.hostname) +
                port +
                this.opts.path +
                (encodedQuery.length ? "?" + encodedQuery : ""));
        }
        /**
         * Feature detection for WebSocket.
         *
         * @return {Boolean} whether this transport is available.
         * @api public
         */
        check() {
            return !!WebSocket;
        }
    }

    const transports = {
        websocket: WS,
        polling: Polling
    };

    // imported from https://github.com/galkn/parseuri
    /**
     * Parses an URI
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */
    const re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
    const parts = [
        'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
    ];
    function parse(str) {
        const src = str, b = str.indexOf('['), e = str.indexOf(']');
        if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
        }
        let m = re.exec(str || ''), uri = {}, i = 14;
        while (i--) {
            uri[parts[i]] = m[i] || '';
        }
        if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
            uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
            uri.ipv6uri = true;
        }
        uri.pathNames = pathNames(uri, uri['path']);
        uri.queryKey = queryKey(uri, uri['query']);
        return uri;
    }
    function pathNames(obj, path) {
        const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
        if (path.substr(0, 1) == '/' || path.length === 0) {
            names.splice(0, 1);
        }
        if (path.substr(path.length - 1, 1) == '/') {
            names.splice(names.length - 1, 1);
        }
        return names;
    }
    function queryKey(uri, query) {
        const data = {};
        query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
            if ($1) {
                data[$1] = $2;
            }
        });
        return data;
    }

    class Socket$1 extends Emitter {
        /**
         * Socket constructor.
         *
         * @param {String|Object} uri or options
         * @param {Object} opts - options
         * @api public
         */
        constructor(uri, opts = {}) {
            super();
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = null;
            }
            if (uri) {
                uri = parse(uri);
                opts.hostname = uri.host;
                opts.secure = uri.protocol === "https" || uri.protocol === "wss";
                opts.port = uri.port;
                if (uri.query)
                    opts.query = uri.query;
            }
            else if (opts.host) {
                opts.hostname = parse(opts.host).host;
            }
            installTimerFunctions(this, opts);
            this.secure =
                null != opts.secure
                    ? opts.secure
                    : typeof location !== "undefined" && "https:" === location.protocol;
            if (opts.hostname && !opts.port) {
                // if no port is specified manually, use the protocol default
                opts.port = this.secure ? "443" : "80";
            }
            this.hostname =
                opts.hostname ||
                    (typeof location !== "undefined" ? location.hostname : "localhost");
            this.port =
                opts.port ||
                    (typeof location !== "undefined" && location.port
                        ? location.port
                        : this.secure
                            ? "443"
                            : "80");
            this.transports = opts.transports || ["polling", "websocket"];
            this.readyState = "";
            this.writeBuffer = [];
            this.prevBufferLen = 0;
            this.opts = Object.assign({
                path: "/engine.io",
                agent: false,
                withCredentials: false,
                upgrade: true,
                timestampParam: "t",
                rememberUpgrade: false,
                rejectUnauthorized: true,
                perMessageDeflate: {
                    threshold: 1024
                },
                transportOptions: {},
                closeOnBeforeunload: true
            }, opts);
            this.opts.path = this.opts.path.replace(/\/$/, "") + "/";
            if (typeof this.opts.query === "string") {
                this.opts.query = decode(this.opts.query);
            }
            // set on handshake
            this.id = null;
            this.upgrades = null;
            this.pingInterval = null;
            this.pingTimeout = null;
            // set on heartbeat
            this.pingTimeoutTimer = null;
            if (typeof addEventListener === "function") {
                if (this.opts.closeOnBeforeunload) {
                    // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                    // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                    // closed/reloaded)
                    addEventListener("beforeunload", () => {
                        if (this.transport) {
                            // silently close the transport
                            this.transport.removeAllListeners();
                            this.transport.close();
                        }
                    }, false);
                }
                if (this.hostname !== "localhost") {
                    this.offlineEventListener = () => {
                        this.onClose("transport close", {
                            description: "network connection lost"
                        });
                    };
                    addEventListener("offline", this.offlineEventListener, false);
                }
            }
            this.open();
        }
        /**
         * Creates transport of the given type.
         *
         * @param {String} transport name
         * @return {Transport}
         * @api private
         */
        createTransport(name) {
            const query = Object.assign({}, this.opts.query);
            // append engine.io protocol identifier
            query.EIO = protocol$1;
            // transport name
            query.transport = name;
            // session id if we already have one
            if (this.id)
                query.sid = this.id;
            const opts = Object.assign({}, this.opts.transportOptions[name], this.opts, {
                query,
                socket: this,
                hostname: this.hostname,
                secure: this.secure,
                port: this.port
            });
            return new transports[name](opts);
        }
        /**
         * Initializes transport to use and starts probe.
         *
         * @api private
         */
        open() {
            let transport;
            if (this.opts.rememberUpgrade &&
                Socket$1.priorWebsocketSuccess &&
                this.transports.indexOf("websocket") !== -1) {
                transport = "websocket";
            }
            else if (0 === this.transports.length) {
                // Emit error on next tick so it can be listened to
                this.setTimeoutFn(() => {
                    this.emitReserved("error", "No transports available");
                }, 0);
                return;
            }
            else {
                transport = this.transports[0];
            }
            this.readyState = "opening";
            // Retry with the next transport if the transport is disabled (jsonp: false)
            try {
                transport = this.createTransport(transport);
            }
            catch (e) {
                this.transports.shift();
                this.open();
                return;
            }
            transport.open();
            this.setTransport(transport);
        }
        /**
         * Sets the current transport. Disables the existing one (if any).
         *
         * @api private
         */
        setTransport(transport) {
            if (this.transport) {
                this.transport.removeAllListeners();
            }
            // set up transport
            this.transport = transport;
            // set up transport listeners
            transport
                .on("drain", this.onDrain.bind(this))
                .on("packet", this.onPacket.bind(this))
                .on("error", this.onError.bind(this))
                .on("close", reason => this.onClose("transport close", reason));
        }
        /**
         * Probes a transport.
         *
         * @param {String} transport name
         * @api private
         */
        probe(name) {
            let transport = this.createTransport(name);
            let failed = false;
            Socket$1.priorWebsocketSuccess = false;
            const onTransportOpen = () => {
                if (failed)
                    return;
                transport.send([{ type: "ping", data: "probe" }]);
                transport.once("packet", msg => {
                    if (failed)
                        return;
                    if ("pong" === msg.type && "probe" === msg.data) {
                        this.upgrading = true;
                        this.emitReserved("upgrading", transport);
                        if (!transport)
                            return;
                        Socket$1.priorWebsocketSuccess = "websocket" === transport.name;
                        this.transport.pause(() => {
                            if (failed)
                                return;
                            if ("closed" === this.readyState)
                                return;
                            cleanup();
                            this.setTransport(transport);
                            transport.send([{ type: "upgrade" }]);
                            this.emitReserved("upgrade", transport);
                            transport = null;
                            this.upgrading = false;
                            this.flush();
                        });
                    }
                    else {
                        const err = new Error("probe error");
                        // @ts-ignore
                        err.transport = transport.name;
                        this.emitReserved("upgradeError", err);
                    }
                });
            };
            function freezeTransport() {
                if (failed)
                    return;
                // Any callback called by transport should be ignored since now
                failed = true;
                cleanup();
                transport.close();
                transport = null;
            }
            // Handle any error that happens while probing
            const onerror = err => {
                const error = new Error("probe error: " + err);
                // @ts-ignore
                error.transport = transport.name;
                freezeTransport();
                this.emitReserved("upgradeError", error);
            };
            function onTransportClose() {
                onerror("transport closed");
            }
            // When the socket is closed while we're probing
            function onclose() {
                onerror("socket closed");
            }
            // When the socket is upgraded while we're probing
            function onupgrade(to) {
                if (transport && to.name !== transport.name) {
                    freezeTransport();
                }
            }
            // Remove all listeners on the transport and on self
            const cleanup = () => {
                transport.removeListener("open", onTransportOpen);
                transport.removeListener("error", onerror);
                transport.removeListener("close", onTransportClose);
                this.off("close", onclose);
                this.off("upgrading", onupgrade);
            };
            transport.once("open", onTransportOpen);
            transport.once("error", onerror);
            transport.once("close", onTransportClose);
            this.once("close", onclose);
            this.once("upgrading", onupgrade);
            transport.open();
        }
        /**
         * Called when connection is deemed open.
         *
         * @api private
         */
        onOpen() {
            this.readyState = "open";
            Socket$1.priorWebsocketSuccess = "websocket" === this.transport.name;
            this.emitReserved("open");
            this.flush();
            // we check for `readyState` in case an `open`
            // listener already closed the socket
            if ("open" === this.readyState &&
                this.opts.upgrade &&
                this.transport.pause) {
                let i = 0;
                const l = this.upgrades.length;
                for (; i < l; i++) {
                    this.probe(this.upgrades[i]);
                }
            }
        }
        /**
         * Handles a packet.
         *
         * @api private
         */
        onPacket(packet) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                this.emitReserved("packet", packet);
                // Socket is live - any packet counts
                this.emitReserved("heartbeat");
                switch (packet.type) {
                    case "open":
                        this.onHandshake(JSON.parse(packet.data));
                        break;
                    case "ping":
                        this.resetPingTimeout();
                        this.sendPacket("pong");
                        this.emitReserved("ping");
                        this.emitReserved("pong");
                        break;
                    case "error":
                        const err = new Error("server error");
                        // @ts-ignore
                        err.code = packet.data;
                        this.onError(err);
                        break;
                    case "message":
                        this.emitReserved("data", packet.data);
                        this.emitReserved("message", packet.data);
                        break;
                }
            }
        }
        /**
         * Called upon handshake completion.
         *
         * @param {Object} data - handshake obj
         * @api private
         */
        onHandshake(data) {
            this.emitReserved("handshake", data);
            this.id = data.sid;
            this.transport.query.sid = data.sid;
            this.upgrades = this.filterUpgrades(data.upgrades);
            this.pingInterval = data.pingInterval;
            this.pingTimeout = data.pingTimeout;
            this.maxPayload = data.maxPayload;
            this.onOpen();
            // In case open handler closes socket
            if ("closed" === this.readyState)
                return;
            this.resetPingTimeout();
        }
        /**
         * Sets and resets ping timeout timer based on server pings.
         *
         * @api private
         */
        resetPingTimeout() {
            this.clearTimeoutFn(this.pingTimeoutTimer);
            this.pingTimeoutTimer = this.setTimeoutFn(() => {
                this.onClose("ping timeout");
            }, this.pingInterval + this.pingTimeout);
            if (this.opts.autoUnref) {
                this.pingTimeoutTimer.unref();
            }
        }
        /**
         * Called on `drain` event
         *
         * @api private
         */
        onDrain() {
            this.writeBuffer.splice(0, this.prevBufferLen);
            // setting prevBufferLen = 0 is very important
            // for example, when upgrading, upgrade packet is sent over,
            // and a nonzero prevBufferLen could cause problems on `drain`
            this.prevBufferLen = 0;
            if (0 === this.writeBuffer.length) {
                this.emitReserved("drain");
            }
            else {
                this.flush();
            }
        }
        /**
         * Flush write buffers.
         *
         * @api private
         */
        flush() {
            if ("closed" !== this.readyState &&
                this.transport.writable &&
                !this.upgrading &&
                this.writeBuffer.length) {
                const packets = this.getWritablePackets();
                this.transport.send(packets);
                // keep track of current length of writeBuffer
                // splice writeBuffer and callbackBuffer on `drain`
                this.prevBufferLen = packets.length;
                this.emitReserved("flush");
            }
        }
        /**
         * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
         * long-polling)
         *
         * @private
         */
        getWritablePackets() {
            const shouldCheckPayloadSize = this.maxPayload &&
                this.transport.name === "polling" &&
                this.writeBuffer.length > 1;
            if (!shouldCheckPayloadSize) {
                return this.writeBuffer;
            }
            let payloadSize = 1; // first packet type
            for (let i = 0; i < this.writeBuffer.length; i++) {
                const data = this.writeBuffer[i].data;
                if (data) {
                    payloadSize += byteLength(data);
                }
                if (i > 0 && payloadSize > this.maxPayload) {
                    return this.writeBuffer.slice(0, i);
                }
                payloadSize += 2; // separator + packet type
            }
            return this.writeBuffer;
        }
        /**
         * Sends a message.
         *
         * @param {String} message.
         * @param {Function} callback function.
         * @param {Object} options.
         * @return {Socket} for chaining.
         * @api public
         */
        write(msg, options, fn) {
            this.sendPacket("message", msg, options, fn);
            return this;
        }
        send(msg, options, fn) {
            this.sendPacket("message", msg, options, fn);
            return this;
        }
        /**
         * Sends a packet.
         *
         * @param {String} packet type.
         * @param {String} data.
         * @param {Object} options.
         * @param {Function} callback function.
         * @api private
         */
        sendPacket(type, data, options, fn) {
            if ("function" === typeof data) {
                fn = data;
                data = undefined;
            }
            if ("function" === typeof options) {
                fn = options;
                options = null;
            }
            if ("closing" === this.readyState || "closed" === this.readyState) {
                return;
            }
            options = options || {};
            options.compress = false !== options.compress;
            const packet = {
                type: type,
                data: data,
                options: options
            };
            this.emitReserved("packetCreate", packet);
            this.writeBuffer.push(packet);
            if (fn)
                this.once("flush", fn);
            this.flush();
        }
        /**
         * Closes the connection.
         *
         * @api public
         */
        close() {
            const close = () => {
                this.onClose("forced close");
                this.transport.close();
            };
            const cleanupAndClose = () => {
                this.off("upgrade", cleanupAndClose);
                this.off("upgradeError", cleanupAndClose);
                close();
            };
            const waitForUpgrade = () => {
                // wait for upgrade to finish since we can't send packets while pausing a transport
                this.once("upgrade", cleanupAndClose);
                this.once("upgradeError", cleanupAndClose);
            };
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.readyState = "closing";
                if (this.writeBuffer.length) {
                    this.once("drain", () => {
                        if (this.upgrading) {
                            waitForUpgrade();
                        }
                        else {
                            close();
                        }
                    });
                }
                else if (this.upgrading) {
                    waitForUpgrade();
                }
                else {
                    close();
                }
            }
            return this;
        }
        /**
         * Called upon transport error
         *
         * @api private
         */
        onError(err) {
            Socket$1.priorWebsocketSuccess = false;
            this.emitReserved("error", err);
            this.onClose("transport error", err);
        }
        /**
         * Called upon transport close.
         *
         * @api private
         */
        onClose(reason, description) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                // clear timers
                this.clearTimeoutFn(this.pingTimeoutTimer);
                // stop event from firing again for transport
                this.transport.removeAllListeners("close");
                // ensure transport won't stay open
                this.transport.close();
                // ignore further transport communication
                this.transport.removeAllListeners();
                if (typeof removeEventListener === "function") {
                    removeEventListener("offline", this.offlineEventListener, false);
                }
                // set ready state
                this.readyState = "closed";
                // clear session id
                this.id = null;
                // emit close event
                this.emitReserved("close", reason, description);
                // clean buffers after, so users can still
                // grab the buffers on `close` event
                this.writeBuffer = [];
                this.prevBufferLen = 0;
            }
        }
        /**
         * Filters upgrades, returning only those matching client transports.
         *
         * @param {Array} server upgrades
         * @api private
         *
         */
        filterUpgrades(upgrades) {
            const filteredUpgrades = [];
            let i = 0;
            const j = upgrades.length;
            for (; i < j; i++) {
                if (~this.transports.indexOf(upgrades[i]))
                    filteredUpgrades.push(upgrades[i]);
            }
            return filteredUpgrades;
        }
    }
    Socket$1.protocol = protocol$1;

    /**
     * URL parser.
     *
     * @param uri - url
     * @param path - the request path of the connection
     * @param loc - An object meant to mimic window.location.
     *        Defaults to window.location.
     * @public
     */
    function url(uri, path = "", loc) {
        let obj = uri;
        // default to window.location
        loc = loc || (typeof location !== "undefined" && location);
        if (null == uri)
            uri = loc.protocol + "//" + loc.host;
        // relative path support
        if (typeof uri === "string") {
            if ("/" === uri.charAt(0)) {
                if ("/" === uri.charAt(1)) {
                    uri = loc.protocol + uri;
                }
                else {
                    uri = loc.host + uri;
                }
            }
            if (!/^(https?|wss?):\/\//.test(uri)) {
                if ("undefined" !== typeof loc) {
                    uri = loc.protocol + "//" + uri;
                }
                else {
                    uri = "https://" + uri;
                }
            }
            // parse
            obj = parse(uri);
        }
        // make sure we treat `localhost:80` and `localhost` equally
        if (!obj.port) {
            if (/^(http|ws)$/.test(obj.protocol)) {
                obj.port = "80";
            }
            else if (/^(http|ws)s$/.test(obj.protocol)) {
                obj.port = "443";
            }
        }
        obj.path = obj.path || "/";
        const ipv6 = obj.host.indexOf(":") !== -1;
        const host = ipv6 ? "[" + obj.host + "]" : obj.host;
        // define unique id
        obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
        // define href
        obj.href =
            obj.protocol +
                "://" +
                host +
                (loc && loc.port === obj.port ? "" : ":" + obj.port);
        return obj;
    }

    const withNativeArrayBuffer = typeof ArrayBuffer === "function";
    const isView = (obj) => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj.buffer instanceof ArrayBuffer;
    };
    const toString = Object.prototype.toString;
    const withNativeBlob = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            toString.call(Blob) === "[object BlobConstructor]");
    const withNativeFile = typeof File === "function" ||
        (typeof File !== "undefined" &&
            toString.call(File) === "[object FileConstructor]");
    /**
     * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
     *
     * @private
     */
    function isBinary(obj) {
        return ((withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
            (withNativeBlob && obj instanceof Blob) ||
            (withNativeFile && obj instanceof File));
    }
    function hasBinary(obj, toJSON) {
        if (!obj || typeof obj !== "object") {
            return false;
        }
        if (Array.isArray(obj)) {
            for (let i = 0, l = obj.length; i < l; i++) {
                if (hasBinary(obj[i])) {
                    return true;
                }
            }
            return false;
        }
        if (isBinary(obj)) {
            return true;
        }
        if (obj.toJSON &&
            typeof obj.toJSON === "function" &&
            arguments.length === 1) {
            return hasBinary(obj.toJSON(), true);
        }
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
     *
     * @param {Object} packet - socket.io event packet
     * @return {Object} with deconstructed packet and list of buffers
     * @public
     */
    function deconstructPacket(packet) {
        const buffers = [];
        const packetData = packet.data;
        const pack = packet;
        pack.data = _deconstructPacket(packetData, buffers);
        pack.attachments = buffers.length; // number of binary 'attachments'
        return { packet: pack, buffers: buffers };
    }
    function _deconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (isBinary(data)) {
            const placeholder = { _placeholder: true, num: buffers.length };
            buffers.push(data);
            return placeholder;
        }
        else if (Array.isArray(data)) {
            const newData = new Array(data.length);
            for (let i = 0; i < data.length; i++) {
                newData[i] = _deconstructPacket(data[i], buffers);
            }
            return newData;
        }
        else if (typeof data === "object" && !(data instanceof Date)) {
            const newData = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    newData[key] = _deconstructPacket(data[key], buffers);
                }
            }
            return newData;
        }
        return data;
    }
    /**
     * Reconstructs a binary packet from its placeholder packet and buffers
     *
     * @param {Object} packet - event packet with placeholders
     * @param {Array} buffers - binary buffers to put in placeholder positions
     * @return {Object} reconstructed packet
     * @public
     */
    function reconstructPacket(packet, buffers) {
        packet.data = _reconstructPacket(packet.data, buffers);
        packet.attachments = undefined; // no longer useful
        return packet;
    }
    function _reconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (data && data._placeholder === true) {
            const isIndexValid = typeof data.num === "number" &&
                data.num >= 0 &&
                data.num < buffers.length;
            if (isIndexValid) {
                return buffers[data.num]; // appropriate buffer (should be natural order anyway)
            }
            else {
                throw new Error("illegal attachments");
            }
        }
        else if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                data[i] = _reconstructPacket(data[i], buffers);
            }
        }
        else if (typeof data === "object") {
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    data[key] = _reconstructPacket(data[key], buffers);
                }
            }
        }
        return data;
    }

    /**
     * Protocol version.
     *
     * @public
     */
    const protocol = 5;
    var PacketType;
    (function (PacketType) {
        PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
        PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
        PacketType[PacketType["EVENT"] = 2] = "EVENT";
        PacketType[PacketType["ACK"] = 3] = "ACK";
        PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
        PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
        PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
    })(PacketType || (PacketType = {}));
    /**
     * A socket.io Encoder instance
     */
    class Encoder {
        /**
         * Encoder constructor
         *
         * @param {function} replacer - custom replacer to pass down to JSON.parse
         */
        constructor(replacer) {
            this.replacer = replacer;
        }
        /**
         * Encode a packet as a single string if non-binary, or as a
         * buffer sequence, depending on packet type.
         *
         * @param {Object} obj - packet object
         */
        encode(obj) {
            if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
                if (hasBinary(obj)) {
                    obj.type =
                        obj.type === PacketType.EVENT
                            ? PacketType.BINARY_EVENT
                            : PacketType.BINARY_ACK;
                    return this.encodeAsBinary(obj);
                }
            }
            return [this.encodeAsString(obj)];
        }
        /**
         * Encode packet as string.
         */
        encodeAsString(obj) {
            // first is type
            let str = "" + obj.type;
            // attachments if we have them
            if (obj.type === PacketType.BINARY_EVENT ||
                obj.type === PacketType.BINARY_ACK) {
                str += obj.attachments + "-";
            }
            // if we have a namespace other than `/`
            // we append it followed by a comma `,`
            if (obj.nsp && "/" !== obj.nsp) {
                str += obj.nsp + ",";
            }
            // immediately followed by the id
            if (null != obj.id) {
                str += obj.id;
            }
            // json data
            if (null != obj.data) {
                str += JSON.stringify(obj.data, this.replacer);
            }
            return str;
        }
        /**
         * Encode packet as 'buffer sequence' by removing blobs, and
         * deconstructing packet into object with placeholders and
         * a list of buffers.
         */
        encodeAsBinary(obj) {
            const deconstruction = deconstructPacket(obj);
            const pack = this.encodeAsString(deconstruction.packet);
            const buffers = deconstruction.buffers;
            buffers.unshift(pack); // add packet info to beginning of data list
            return buffers; // write all the buffers
        }
    }
    /**
     * A socket.io Decoder instance
     *
     * @return {Object} decoder
     */
    class Decoder extends Emitter {
        /**
         * Decoder constructor
         *
         * @param {function} reviver - custom reviver to pass down to JSON.stringify
         */
        constructor(reviver) {
            super();
            this.reviver = reviver;
        }
        /**
         * Decodes an encoded packet string into packet JSON.
         *
         * @param {String} obj - encoded packet
         */
        add(obj) {
            let packet;
            if (typeof obj === "string") {
                if (this.reconstructor) {
                    throw new Error("got plaintext data when reconstructing a packet");
                }
                packet = this.decodeString(obj);
                if (packet.type === PacketType.BINARY_EVENT ||
                    packet.type === PacketType.BINARY_ACK) {
                    // binary packet's json
                    this.reconstructor = new BinaryReconstructor(packet);
                    // no attachments, labeled binary but no binary data to follow
                    if (packet.attachments === 0) {
                        super.emitReserved("decoded", packet);
                    }
                }
                else {
                    // non-binary full packet
                    super.emitReserved("decoded", packet);
                }
            }
            else if (isBinary(obj) || obj.base64) {
                // raw binary data
                if (!this.reconstructor) {
                    throw new Error("got binary data when not reconstructing a packet");
                }
                else {
                    packet = this.reconstructor.takeBinaryData(obj);
                    if (packet) {
                        // received final buffer
                        this.reconstructor = null;
                        super.emitReserved("decoded", packet);
                    }
                }
            }
            else {
                throw new Error("Unknown type: " + obj);
            }
        }
        /**
         * Decode a packet String (JSON data)
         *
         * @param {String} str
         * @return {Object} packet
         */
        decodeString(str) {
            let i = 0;
            // look up type
            const p = {
                type: Number(str.charAt(0)),
            };
            if (PacketType[p.type] === undefined) {
                throw new Error("unknown packet type " + p.type);
            }
            // look up attachments if type binary
            if (p.type === PacketType.BINARY_EVENT ||
                p.type === PacketType.BINARY_ACK) {
                const start = i + 1;
                while (str.charAt(++i) !== "-" && i != str.length) { }
                const buf = str.substring(start, i);
                if (buf != Number(buf) || str.charAt(i) !== "-") {
                    throw new Error("Illegal attachments");
                }
                p.attachments = Number(buf);
            }
            // look up namespace (if any)
            if ("/" === str.charAt(i + 1)) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if ("," === c)
                        break;
                    if (i === str.length)
                        break;
                }
                p.nsp = str.substring(start, i);
            }
            else {
                p.nsp = "/";
            }
            // look up id
            const next = str.charAt(i + 1);
            if ("" !== next && Number(next) == next) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if (null == c || Number(c) != c) {
                        --i;
                        break;
                    }
                    if (i === str.length)
                        break;
                }
                p.id = Number(str.substring(start, i + 1));
            }
            // look up json data
            if (str.charAt(++i)) {
                const payload = this.tryParse(str.substr(i));
                if (Decoder.isPayloadValid(p.type, payload)) {
                    p.data = payload;
                }
                else {
                    throw new Error("invalid payload");
                }
            }
            return p;
        }
        tryParse(str) {
            try {
                return JSON.parse(str, this.reviver);
            }
            catch (e) {
                return false;
            }
        }
        static isPayloadValid(type, payload) {
            switch (type) {
                case PacketType.CONNECT:
                    return typeof payload === "object";
                case PacketType.DISCONNECT:
                    return payload === undefined;
                case PacketType.CONNECT_ERROR:
                    return typeof payload === "string" || typeof payload === "object";
                case PacketType.EVENT:
                case PacketType.BINARY_EVENT:
                    return Array.isArray(payload) && payload.length > 0;
                case PacketType.ACK:
                case PacketType.BINARY_ACK:
                    return Array.isArray(payload);
            }
        }
        /**
         * Deallocates a parser's resources
         */
        destroy() {
            if (this.reconstructor) {
                this.reconstructor.finishedReconstruction();
            }
        }
    }
    /**
     * A manager of a binary event's 'buffer sequence'. Should
     * be constructed whenever a packet of type BINARY_EVENT is
     * decoded.
     *
     * @param {Object} packet
     * @return {BinaryReconstructor} initialized reconstructor
     */
    class BinaryReconstructor {
        constructor(packet) {
            this.packet = packet;
            this.buffers = [];
            this.reconPack = packet;
        }
        /**
         * Method to be called when binary data received from connection
         * after a BINARY_EVENT packet.
         *
         * @param {Buffer | ArrayBuffer} binData - the raw binary data received
         * @return {null | Object} returns null if more binary data is expected or
         *   a reconstructed packet object if all buffers have been received.
         */
        takeBinaryData(binData) {
            this.buffers.push(binData);
            if (this.buffers.length === this.reconPack.attachments) {
                // done with buffer list
                const packet = reconstructPacket(this.reconPack, this.buffers);
                this.finishedReconstruction();
                return packet;
            }
            return null;
        }
        /**
         * Cleans up binary packet reconstruction variables.
         */
        finishedReconstruction() {
            this.reconPack = null;
            this.buffers = [];
        }
    }

    var parser = /*#__PURE__*/Object.freeze({
        __proto__: null,
        protocol: protocol,
        get PacketType () { return PacketType; },
        Encoder: Encoder,
        Decoder: Decoder
    });

    function on(obj, ev, fn) {
        obj.on(ev, fn);
        return function subDestroy() {
            obj.off(ev, fn);
        };
    }

    /**
     * Internal events.
     * These events can't be emitted by the user.
     */
    const RESERVED_EVENTS = Object.freeze({
        connect: 1,
        connect_error: 1,
        disconnect: 1,
        disconnecting: 1,
        // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
        newListener: 1,
        removeListener: 1,
    });
    class Socket extends Emitter {
        /**
         * `Socket` constructor.
         *
         * @public
         */
        constructor(io, nsp, opts) {
            super();
            this.connected = false;
            this.receiveBuffer = [];
            this.sendBuffer = [];
            this.ids = 0;
            this.acks = {};
            this.flags = {};
            this.io = io;
            this.nsp = nsp;
            if (opts && opts.auth) {
                this.auth = opts.auth;
            }
            if (this.io._autoConnect)
                this.open();
        }
        /**
         * Whether the socket is currently disconnected
         */
        get disconnected() {
            return !this.connected;
        }
        /**
         * Subscribe to open, close and packet events
         *
         * @private
         */
        subEvents() {
            if (this.subs)
                return;
            const io = this.io;
            this.subs = [
                on(io, "open", this.onopen.bind(this)),
                on(io, "packet", this.onpacket.bind(this)),
                on(io, "error", this.onerror.bind(this)),
                on(io, "close", this.onclose.bind(this)),
            ];
        }
        /**
         * Whether the Socket will try to reconnect when its Manager connects or reconnects
         */
        get active() {
            return !!this.subs;
        }
        /**
         * "Opens" the socket.
         *
         * @public
         */
        connect() {
            if (this.connected)
                return this;
            this.subEvents();
            if (!this.io["_reconnecting"])
                this.io.open(); // ensure open
            if ("open" === this.io._readyState)
                this.onopen();
            return this;
        }
        /**
         * Alias for connect()
         */
        open() {
            return this.connect();
        }
        /**
         * Sends a `message` event.
         *
         * @return self
         * @public
         */
        send(...args) {
            args.unshift("message");
            this.emit.apply(this, args);
            return this;
        }
        /**
         * Override `emit`.
         * If the event is in `events`, it's emitted normally.
         *
         * @return self
         * @public
         */
        emit(ev, ...args) {
            if (RESERVED_EVENTS.hasOwnProperty(ev)) {
                throw new Error('"' + ev.toString() + '" is a reserved event name');
            }
            args.unshift(ev);
            const packet = {
                type: PacketType.EVENT,
                data: args,
            };
            packet.options = {};
            packet.options.compress = this.flags.compress !== false;
            // event ack callback
            if ("function" === typeof args[args.length - 1]) {
                const id = this.ids++;
                const ack = args.pop();
                this._registerAckCallback(id, ack);
                packet.id = id;
            }
            const isTransportWritable = this.io.engine &&
                this.io.engine.transport &&
                this.io.engine.transport.writable;
            const discardPacket = this.flags.volatile && (!isTransportWritable || !this.connected);
            if (discardPacket) ;
            else if (this.connected) {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            }
            else {
                this.sendBuffer.push(packet);
            }
            this.flags = {};
            return this;
        }
        /**
         * @private
         */
        _registerAckCallback(id, ack) {
            const timeout = this.flags.timeout;
            if (timeout === undefined) {
                this.acks[id] = ack;
                return;
            }
            // @ts-ignore
            const timer = this.io.setTimeoutFn(() => {
                delete this.acks[id];
                for (let i = 0; i < this.sendBuffer.length; i++) {
                    if (this.sendBuffer[i].id === id) {
                        this.sendBuffer.splice(i, 1);
                    }
                }
                ack.call(this, new Error("operation has timed out"));
            }, timeout);
            this.acks[id] = (...args) => {
                // @ts-ignore
                this.io.clearTimeoutFn(timer);
                ack.apply(this, [null, ...args]);
            };
        }
        /**
         * Sends a packet.
         *
         * @param packet
         * @private
         */
        packet(packet) {
            packet.nsp = this.nsp;
            this.io._packet(packet);
        }
        /**
         * Called upon engine `open`.
         *
         * @private
         */
        onopen() {
            if (typeof this.auth == "function") {
                this.auth((data) => {
                    this.packet({ type: PacketType.CONNECT, data });
                });
            }
            else {
                this.packet({ type: PacketType.CONNECT, data: this.auth });
            }
        }
        /**
         * Called upon engine or manager `error`.
         *
         * @param err
         * @private
         */
        onerror(err) {
            if (!this.connected) {
                this.emitReserved("connect_error", err);
            }
        }
        /**
         * Called upon engine `close`.
         *
         * @param reason
         * @param description
         * @private
         */
        onclose(reason, description) {
            this.connected = false;
            delete this.id;
            this.emitReserved("disconnect", reason, description);
        }
        /**
         * Called with socket packet.
         *
         * @param packet
         * @private
         */
        onpacket(packet) {
            const sameNamespace = packet.nsp === this.nsp;
            if (!sameNamespace)
                return;
            switch (packet.type) {
                case PacketType.CONNECT:
                    if (packet.data && packet.data.sid) {
                        const id = packet.data.sid;
                        this.onconnect(id);
                    }
                    else {
                        this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                    }
                    break;
                case PacketType.EVENT:
                case PacketType.BINARY_EVENT:
                    this.onevent(packet);
                    break;
                case PacketType.ACK:
                case PacketType.BINARY_ACK:
                    this.onack(packet);
                    break;
                case PacketType.DISCONNECT:
                    this.ondisconnect();
                    break;
                case PacketType.CONNECT_ERROR:
                    this.destroy();
                    const err = new Error(packet.data.message);
                    // @ts-ignore
                    err.data = packet.data.data;
                    this.emitReserved("connect_error", err);
                    break;
            }
        }
        /**
         * Called upon a server event.
         *
         * @param packet
         * @private
         */
        onevent(packet) {
            const args = packet.data || [];
            if (null != packet.id) {
                args.push(this.ack(packet.id));
            }
            if (this.connected) {
                this.emitEvent(args);
            }
            else {
                this.receiveBuffer.push(Object.freeze(args));
            }
        }
        emitEvent(args) {
            if (this._anyListeners && this._anyListeners.length) {
                const listeners = this._anyListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, args);
                }
            }
            super.emit.apply(this, args);
        }
        /**
         * Produces an ack callback to emit with an event.
         *
         * @private
         */
        ack(id) {
            const self = this;
            let sent = false;
            return function (...args) {
                // prevent double callbacks
                if (sent)
                    return;
                sent = true;
                self.packet({
                    type: PacketType.ACK,
                    id: id,
                    data: args,
                });
            };
        }
        /**
         * Called upon a server acknowlegement.
         *
         * @param packet
         * @private
         */
        onack(packet) {
            const ack = this.acks[packet.id];
            if ("function" === typeof ack) {
                ack.apply(this, packet.data);
                delete this.acks[packet.id];
            }
        }
        /**
         * Called upon server connect.
         *
         * @private
         */
        onconnect(id) {
            this.id = id;
            this.connected = true;
            this.emitBuffered();
            this.emitReserved("connect");
        }
        /**
         * Emit buffered events (received and emitted).
         *
         * @private
         */
        emitBuffered() {
            this.receiveBuffer.forEach((args) => this.emitEvent(args));
            this.receiveBuffer = [];
            this.sendBuffer.forEach((packet) => {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            });
            this.sendBuffer = [];
        }
        /**
         * Called upon server disconnect.
         *
         * @private
         */
        ondisconnect() {
            this.destroy();
            this.onclose("io server disconnect");
        }
        /**
         * Called upon forced client/server side disconnections,
         * this method ensures the manager stops tracking us and
         * that reconnections don't get triggered for this.
         *
         * @private
         */
        destroy() {
            if (this.subs) {
                // clean subscriptions to avoid reconnections
                this.subs.forEach((subDestroy) => subDestroy());
                this.subs = undefined;
            }
            this.io["_destroy"](this);
        }
        /**
         * Disconnects the socket manually.
         *
         * @return self
         * @public
         */
        disconnect() {
            if (this.connected) {
                this.packet({ type: PacketType.DISCONNECT });
            }
            // remove socket from pool
            this.destroy();
            if (this.connected) {
                // fire events
                this.onclose("io client disconnect");
            }
            return this;
        }
        /**
         * Alias for disconnect()
         *
         * @return self
         * @public
         */
        close() {
            return this.disconnect();
        }
        /**
         * Sets the compress flag.
         *
         * @param compress - if `true`, compresses the sending data
         * @return self
         * @public
         */
        compress(compress) {
            this.flags.compress = compress;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
         * ready to send messages.
         *
         * @returns self
         * @public
         */
        get volatile() {
            this.flags.volatile = true;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
         * given number of milliseconds have elapsed without an acknowledgement from the server:
         *
         * ```
         * socket.timeout(5000).emit("my-event", (err) => {
         *   if (err) {
         *     // the server did not acknowledge the event in the given delay
         *   }
         * });
         * ```
         *
         * @returns self
         * @public
         */
        timeout(timeout) {
            this.flags.timeout = timeout;
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * @param listener
         * @public
         */
        onAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * @param listener
         * @public
         */
        prependAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @param listener
         * @public
         */
        offAny(listener) {
            if (!this._anyListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         *
         * @public
         */
        listenersAny() {
            return this._anyListeners || [];
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * @param listener
         *
         * <pre><code>
         *
         * socket.onAnyOutgoing((event, ...args) => {
         *   console.log(event);
         * });
         *
         * </pre></code>
         *
         * @public
         */
        onAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * @param listener
         *
         * <pre><code>
         *
         * socket.prependAnyOutgoing((event, ...args) => {
         *   console.log(event);
         * });
         *
         * </pre></code>
         *
         * @public
         */
        prependAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @param listener
         *
         * <pre><code>
         *
         * const handler = (event, ...args) => {
         *   console.log(event);
         * }
         *
         * socket.onAnyOutgoing(handler);
         *
         * // then later
         * socket.offAnyOutgoing(handler);
         *
         * </pre></code>
         *
         * @public
         */
        offAnyOutgoing(listener) {
            if (!this._anyOutgoingListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyOutgoingListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyOutgoingListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         *
         * @public
         */
        listenersAnyOutgoing() {
            return this._anyOutgoingListeners || [];
        }
        /**
         * Notify the listeners for each packet sent
         *
         * @param packet
         *
         * @private
         */
        notifyOutgoingListeners(packet) {
            if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
                const listeners = this._anyOutgoingListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, packet.data);
                }
            }
        }
    }

    /**
     * Initialize backoff timer with `opts`.
     *
     * - `min` initial timeout in milliseconds [100]
     * - `max` max timeout [10000]
     * - `jitter` [0]
     * - `factor` [2]
     *
     * @param {Object} opts
     * @api public
     */
    function Backoff(opts) {
        opts = opts || {};
        this.ms = opts.min || 100;
        this.max = opts.max || 10000;
        this.factor = opts.factor || 2;
        this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
        this.attempts = 0;
    }
    /**
     * Return the backoff duration.
     *
     * @return {Number}
     * @api public
     */
    Backoff.prototype.duration = function () {
        var ms = this.ms * Math.pow(this.factor, this.attempts++);
        if (this.jitter) {
            var rand = Math.random();
            var deviation = Math.floor(rand * this.jitter * ms);
            ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
        }
        return Math.min(ms, this.max) | 0;
    };
    /**
     * Reset the number of attempts.
     *
     * @api public
     */
    Backoff.prototype.reset = function () {
        this.attempts = 0;
    };
    /**
     * Set the minimum duration
     *
     * @api public
     */
    Backoff.prototype.setMin = function (min) {
        this.ms = min;
    };
    /**
     * Set the maximum duration
     *
     * @api public
     */
    Backoff.prototype.setMax = function (max) {
        this.max = max;
    };
    /**
     * Set the jitter
     *
     * @api public
     */
    Backoff.prototype.setJitter = function (jitter) {
        this.jitter = jitter;
    };

    class Manager extends Emitter {
        constructor(uri, opts) {
            var _a;
            super();
            this.nsps = {};
            this.subs = [];
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = undefined;
            }
            opts = opts || {};
            opts.path = opts.path || "/socket.io";
            this.opts = opts;
            installTimerFunctions(this, opts);
            this.reconnection(opts.reconnection !== false);
            this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
            this.reconnectionDelay(opts.reconnectionDelay || 1000);
            this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
            this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
            this.backoff = new Backoff({
                min: this.reconnectionDelay(),
                max: this.reconnectionDelayMax(),
                jitter: this.randomizationFactor(),
            });
            this.timeout(null == opts.timeout ? 20000 : opts.timeout);
            this._readyState = "closed";
            this.uri = uri;
            const _parser = opts.parser || parser;
            this.encoder = new _parser.Encoder();
            this.decoder = new _parser.Decoder();
            this._autoConnect = opts.autoConnect !== false;
            if (this._autoConnect)
                this.open();
        }
        reconnection(v) {
            if (!arguments.length)
                return this._reconnection;
            this._reconnection = !!v;
            return this;
        }
        reconnectionAttempts(v) {
            if (v === undefined)
                return this._reconnectionAttempts;
            this._reconnectionAttempts = v;
            return this;
        }
        reconnectionDelay(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelay;
            this._reconnectionDelay = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
            return this;
        }
        randomizationFactor(v) {
            var _a;
            if (v === undefined)
                return this._randomizationFactor;
            this._randomizationFactor = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
            return this;
        }
        reconnectionDelayMax(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelayMax;
            this._reconnectionDelayMax = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
            return this;
        }
        timeout(v) {
            if (!arguments.length)
                return this._timeout;
            this._timeout = v;
            return this;
        }
        /**
         * Starts trying to reconnect if reconnection is enabled and we have not
         * started reconnecting yet
         *
         * @private
         */
        maybeReconnectOnOpen() {
            // Only try to reconnect if it's the first time we're connecting
            if (!this._reconnecting &&
                this._reconnection &&
                this.backoff.attempts === 0) {
                // keeps reconnection from firing twice for the same reconnection loop
                this.reconnect();
            }
        }
        /**
         * Sets the current transport `socket`.
         *
         * @param {Function} fn - optional, callback
         * @return self
         * @public
         */
        open(fn) {
            if (~this._readyState.indexOf("open"))
                return this;
            this.engine = new Socket$1(this.uri, this.opts);
            const socket = this.engine;
            const self = this;
            this._readyState = "opening";
            this.skipReconnect = false;
            // emit `open`
            const openSubDestroy = on(socket, "open", function () {
                self.onopen();
                fn && fn();
            });
            // emit `error`
            const errorSub = on(socket, "error", (err) => {
                self.cleanup();
                self._readyState = "closed";
                this.emitReserved("error", err);
                if (fn) {
                    fn(err);
                }
                else {
                    // Only do this if there is no fn to handle the error
                    self.maybeReconnectOnOpen();
                }
            });
            if (false !== this._timeout) {
                const timeout = this._timeout;
                if (timeout === 0) {
                    openSubDestroy(); // prevents a race condition with the 'open' event
                }
                // set timer
                const timer = this.setTimeoutFn(() => {
                    openSubDestroy();
                    socket.close();
                    // @ts-ignore
                    socket.emit("error", new Error("timeout"));
                }, timeout);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(function subDestroy() {
                    clearTimeout(timer);
                });
            }
            this.subs.push(openSubDestroy);
            this.subs.push(errorSub);
            return this;
        }
        /**
         * Alias for open()
         *
         * @return self
         * @public
         */
        connect(fn) {
            return this.open(fn);
        }
        /**
         * Called upon transport open.
         *
         * @private
         */
        onopen() {
            // clear old subs
            this.cleanup();
            // mark as open
            this._readyState = "open";
            this.emitReserved("open");
            // add new subs
            const socket = this.engine;
            this.subs.push(on(socket, "ping", this.onping.bind(this)), on(socket, "data", this.ondata.bind(this)), on(socket, "error", this.onerror.bind(this)), on(socket, "close", this.onclose.bind(this)), on(this.decoder, "decoded", this.ondecoded.bind(this)));
        }
        /**
         * Called upon a ping.
         *
         * @private
         */
        onping() {
            this.emitReserved("ping");
        }
        /**
         * Called with data.
         *
         * @private
         */
        ondata(data) {
            try {
                this.decoder.add(data);
            }
            catch (e) {
                this.onclose("parse error");
            }
        }
        /**
         * Called when parser fully decodes a packet.
         *
         * @private
         */
        ondecoded(packet) {
            this.emitReserved("packet", packet);
        }
        /**
         * Called upon socket error.
         *
         * @private
         */
        onerror(err) {
            this.emitReserved("error", err);
        }
        /**
         * Creates a new socket for the given `nsp`.
         *
         * @return {Socket}
         * @public
         */
        socket(nsp, opts) {
            let socket = this.nsps[nsp];
            if (!socket) {
                socket = new Socket(this, nsp, opts);
                this.nsps[nsp] = socket;
            }
            return socket;
        }
        /**
         * Called upon a socket close.
         *
         * @param socket
         * @private
         */
        _destroy(socket) {
            const nsps = Object.keys(this.nsps);
            for (const nsp of nsps) {
                const socket = this.nsps[nsp];
                if (socket.active) {
                    return;
                }
            }
            this._close();
        }
        /**
         * Writes a packet.
         *
         * @param packet
         * @private
         */
        _packet(packet) {
            const encodedPackets = this.encoder.encode(packet);
            for (let i = 0; i < encodedPackets.length; i++) {
                this.engine.write(encodedPackets[i], packet.options);
            }
        }
        /**
         * Clean up transport subscriptions and packet buffer.
         *
         * @private
         */
        cleanup() {
            this.subs.forEach((subDestroy) => subDestroy());
            this.subs.length = 0;
            this.decoder.destroy();
        }
        /**
         * Close the current socket.
         *
         * @private
         */
        _close() {
            this.skipReconnect = true;
            this._reconnecting = false;
            this.onclose("forced close");
            if (this.engine)
                this.engine.close();
        }
        /**
         * Alias for close()
         *
         * @private
         */
        disconnect() {
            return this._close();
        }
        /**
         * Called upon engine close.
         *
         * @private
         */
        onclose(reason, description) {
            this.cleanup();
            this.backoff.reset();
            this._readyState = "closed";
            this.emitReserved("close", reason, description);
            if (this._reconnection && !this.skipReconnect) {
                this.reconnect();
            }
        }
        /**
         * Attempt a reconnection.
         *
         * @private
         */
        reconnect() {
            if (this._reconnecting || this.skipReconnect)
                return this;
            const self = this;
            if (this.backoff.attempts >= this._reconnectionAttempts) {
                this.backoff.reset();
                this.emitReserved("reconnect_failed");
                this._reconnecting = false;
            }
            else {
                const delay = this.backoff.duration();
                this._reconnecting = true;
                const timer = this.setTimeoutFn(() => {
                    if (self.skipReconnect)
                        return;
                    this.emitReserved("reconnect_attempt", self.backoff.attempts);
                    // check again for the case socket closed in above events
                    if (self.skipReconnect)
                        return;
                    self.open((err) => {
                        if (err) {
                            self._reconnecting = false;
                            self.reconnect();
                            this.emitReserved("reconnect_error", err);
                        }
                        else {
                            self.onreconnect();
                        }
                    });
                }, delay);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(function subDestroy() {
                    clearTimeout(timer);
                });
            }
        }
        /**
         * Called upon successful reconnect.
         *
         * @private
         */
        onreconnect() {
            const attempt = this.backoff.attempts;
            this._reconnecting = false;
            this.backoff.reset();
            this.emitReserved("reconnect", attempt);
        }
    }

    /**
     * Managers cache.
     */
    const cache = {};
    function lookup(uri, opts) {
        if (typeof uri === "object") {
            opts = uri;
            uri = undefined;
        }
        opts = opts || {};
        const parsed = url(uri, opts.path || "/socket.io");
        const source = parsed.source;
        const id = parsed.id;
        const path = parsed.path;
        const sameNamespace = cache[id] && path in cache[id]["nsps"];
        const newConnection = opts.forceNew ||
            opts["force new connection"] ||
            false === opts.multiplex ||
            sameNamespace;
        let io;
        if (newConnection) {
            io = new Manager(source, opts);
        }
        else {
            if (!cache[id]) {
                cache[id] = new Manager(source, opts);
            }
            io = cache[id];
        }
        if (parsed.query && !opts.query) {
            opts.query = parsed.queryKey;
        }
        return io.socket(parsed.path, opts);
    }
    // so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
    // namespace (e.g. `io.connect(...)`), for backward compatibility
    Object.assign(lookup, {
        Manager,
        Socket,
        io: lookup,
        connect: lookup,
    });

    //***
    const  log = logger('vit:client:sockets');

    // make our socket connection for this app/browser-window
    // ... dynamically updates this socket obj when connected
    log('client making socket connection to server');
    const serverURL = "http://localhost:5000";
    const socket    = lookup(serverURL);

    // NOTE: to determine if connection is made or NOT, simply monitor 'connect'
    // ... test with 
    //     1. server NOT running:    NEVER receive 'connect' event 
    //                               WITH reoccuring console error:
    //                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=Nxzv673 net::ERR_CONNECTION_REFUSED
    //     2. server cors rejection: NEVER receive 'connect' event  <<< BASICALLY THE SAME THING
    //                               WITH reoccuring console error:
    //                                    Access to XMLHttpRequest at 'http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB' from origin 'http://localhost:8080' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
    //                                    GET http://localhost:5000/socket.io/?EIO=4&transport=polling&t=NxzvTtB net::ERR_FAILED 200
    // ... AI: what about error trapping?
    socket.on('connect', () => {
      log(`client's socket connection to server is now up: ${socket.id} / connected: ${socket.connected}`);
      alert$1.display('Our server connection is now up and running.');
      // AI: maintain state that our socket connetion is UP
    });
    socket.on('disconnect', () => {
      log(`client's socket connection to server has been lost: ${socket.id} / connected: ${socket.connected}`);

      // notify user we have lost our connection to the server
      alert$1.display('Our server connection has been lost.');

      // our user is now deactivated (with no server)
      // NOTE: we keep our socket in-place because socket.io will auto-reconnect when the server is back up!
      user.deactivateUser(); // ... this is OK to do EVEN if the user is NOT currently signed-in

      // AI: maintain state that our socket connetion is DOWN
    });

    // register ALL APP socket event listeners
    registerAuthSocketHandlers(socket);
    registerChatSocketHandlers(socket);
    registerSystemStoreSocketHandlers(socket);
    registerSystemSocketHandlers(socket);
    registerLogFilterSocketHandlers(socket);
    // AI: more

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
