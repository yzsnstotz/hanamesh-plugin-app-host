// SOURCE fixture: load a producer-built client and render only registered slots
// or the actual provided market seat. Never inject LibraryOverlay props here.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fakeClock} from './client-ui-harness.mjs';

export async function registeredClient({file, fetch, href}) {
  const clock = fakeClock(), listeners = new Map(), slots = new Map(), seats = new Map();
  const effects = [], instances = new Map(), rendered = [];
  let registration, module, active, cursor = 0, tree, root, dead = false, scheduled = false;
  const pendingEffects = [];
  function schedule() {
    if (!dead && !scheduled && root) {
      scheduled = true;
      queueMicrotask(() => {scheduled = false; if (!dead) render();});
    }
  }
  function hook(make) {
    assert.ok(active, 'a hook must run in an actual registered component');
    const id = cursor++;
    return active[id] ??= make();
  }
  const React = {
    createElement: (type, props, ...children) => ({type, props: props ?? {}, children}),
    useState(initial) {
      const state = hook(() => ({value: typeof initial === 'function' ? initial() : initial}));
      return [state.value, next => {state.value = typeof next === 'function' ? next(state.value) : next; schedule();}];
    },
    useRef: initial => hook(() => ({current: initial})),
    useCallback(fn, deps) {
      const state = hook(() => ({}));
      if (!state.deps || deps.some((value, i) => value !== state.deps[i])) Object.assign(state, {value: fn, deps});
      return state.value;
    },
    useEffect(run, deps) {
      const state = hook(() => ({}));
      if (!state.deps || deps.some((value, i) => value !== state.deps[i])) {
        state.deps = deps;
        pendingEffects.push(() => {state.cleanup?.(); state.cleanup = run();});
      }
    },
  };
  function resolve(node, path = 'root') {
    if (Array.isArray(node)) return node.map((child, i) => resolve(child, `${path}/${i}`));
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}`;
      active = instances.get(key) ?? [];
      instances.set(key, active);
      cursor = 0;
      if (node.type === module.LibraryOverlay) rendered.push({...node.props});
      const value = node.type(node.props);
      active = undefined;
      return resolve(value, `${key}/result`);
    }
    return {...node, children: resolve(node.children, `${path}/children`)};
  }
  function render() {
    tree = resolve(root());
    for (const effect of pendingEffects.splice(0)) effect();
  }
  function clearRoot() {
    for (const hooks of instances.values()) for (const state of hooks) state?.cleanup?.();
    instances.clear();
  }
  function find(predicate, node) {
    if (Array.isArray(node)) {for (const child of node) {const value = find(predicate, child); if (value) return value;} return;}
    if (!node || typeof node !== 'object') return;
    return predicate(node) ? node : find(predicate, node.children);
  }
  const scope = {fetch, crypto: globalThis.crypto, URLSearchParams, AbortController, console,
    location: new URL(href), Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock), clearTimeout: clock.clearTimeout.bind(clock),
    addEventListener: (name, run) => listeners.set(name, run),
    removeEventListener: (name, run) => {if (listeners.get(name) === run) listeners.delete(name);}};
  const window = {__ModuleLoader__: {load(value) {assert.equal(registration, undefined); registration = value;}},
    self: {}, top: {}, parent: {postMessage() {}}};
  const document = {visibilityState: 'visible', createElement: () => ({textContent: '', remove() {}}),
    head: {append() {}}, addEventListener() {}, removeEventListener() {}};
  new Function('window', 'document', 'globalThis', 'setTimeout', 'clearTimeout', 'Date', await readFile(file, 'utf8'))(
    window, document, scope, scope.setTimeout, scope.clearTimeout, clock.Date);
  assert.equal(registration.id, '@hanamesh/dsh-app-host', 'normal client Loader identity');
  module = registration.factory(id => {assert.equal(id, 'react'); return React;});
  const ctx = {
    effect(run) {const dispose = run(); effects.push(dispose); return dispose;},
    slots: {inject: (_name, run) => run(), register(descriptor, component) {
      slots.set(descriptor.id, {descriptor, component}); return () => slots.delete(descriptor.id);
    }},
    reflect: {get: name => seats.get(name)},
    provide(name, value) {assert.equal(seats.has(name), false); seats.set(name, value); return () => seats.delete(name);},
  };
  // Deliberately no second argument and no direct LibraryOverlay invocation.
  // A real test packaging must supply its own trusted verification configuration.
  module.apply(ctx);
  return {module, slots, seats, rendered, find: predicate => find(predicate, tree), get tree() {return tree;},
    mountSettings(id){clearRoot();const slot=slots.get(id);assert.ok(slot,'registered settings slot '+id);root=()=>React.createElement(slot.component);render();},
    mountSidebar() {
      clearRoot();
      const action = slots.get('hanamesh-library'), overlay = slots.get('hanamesh-library-overlay');
      assert.ok(action && overlay, 'actual apply must register normal sidebar and overlay slots');
      root = () => [React.createElement(action.component), React.createElement(overlay.component)];
      render();
    },
    mountMarket(options = {}) {
      clearRoot();
      const seat = seats.get('market'); assert.ok(seat, 'actual apply must provide market seat');
      root = () => seat.render(options); render();
    },
    hashchange(hash) {scope.location.hash = hash; listeners.get('hashchange')?.();},
    dispose() {
      dead = true; clearRoot();
      for (const effect of effects.reverse()) effect?.();
    },
  };
}
