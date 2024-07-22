/**                             KuaraJS - Offical Repository
 * KuaraJS has the slogan of "less is more" for development. KuaraJS aims to be even more 
 * micro than micro frontends and aims for simple web development. Even though it bears 
 * traces from many frameworks, it continues to prioritize simplicity. KuaraJS was developed 
 * by reviewing Angular, HTMX, React, Vue, Astro and Alpine frameworks. Data communication 
 * as in Angular, simple component creation as in React, and the use of Ajax in the 
 * Alpine-Astro-HTMX trio were taken into consideration. Ajax usage will be increasing 
 * in the future.
 * 
 * made with <3 by Kuaralabs_
 * Assigned department: Web & Mobile Development
 * Assigned person: Yakup Cemil Kayabaş
 * License: The MIT License
 */

import htm from "https://unpkg.com/htm?module";
import Morphdom from "https://unpkg.com/morphdom@2.6.1/dist/morphdom-esm.js";
import OnChange from "https://unpkg.com/on-change@4.0.2/index.js";

const h = (type, props, ...children) => ({ type, props, children: children.flat() });
const html = htm.bind(h);

function createComponent(node) {
  let hasRendered = false;
  const renderFn = node.type(node.props, { reRender, observe, store, diContainer });

  function reRender() {
    if (!hasRendered) console.error("Re-render before initial render");
    Morphdom($root, createElement(renderFn()), { getNodeKey, onBeforeElUpdated });
  }

  const vNodes = renderFn();
  if (Array.isArray(vNodes)) console.error("Component returns multiple root nodes");
  const $root = createElement(vNodes);
  hasRendered = true;

  const unsubscribe = store.subscribe(reRender);
  $root.addEventListener('DOMNodeRemoved', () => unsubscribe());
  return $root;
}

function createElement(node) {
  if (!node?.type) return document.createTextNode(node);
  const $el = typeof node.type === 'function' ? createComponent(node) : document.createElement(node.type);

  if (node.props) {
    Object.entries(node.props).forEach(([key, val]) => {
      if (key === "checked" ? val : !isFunction(val) && typeof val !== "object") $el.setAttribute(key, val);
    });
    addHandlers($el, node.props);
  }
  node.children.map(createElement).forEach($child => $el.appendChild($child));
  return $el;
}

function isFunction(item) { return typeof item === 'function'; }
function addHandlers($el, props) {
  Object.entries(props).filter(([key]) => key.startsWith("on")).forEach(([event, func]) => $el.addEventListener(event.slice(2).toLowerCase(), func));
}

class DataStore {
  constructor(initialData = {}) {
    this.data = initialData;
    this.subscribers = new Set();
    this.proxy = new Proxy(this.data, { set: (target, key, value) => (target[key] = value, this.notifySubscribers(), true) });
  }

  subscribe(subscriber) { this.subscribers.add(subscriber); }
  unsubscribe(subscriber) { this.subscribers.delete(subscriber); }
  notifySubscribers() { this.subscribers.forEach(subscriber => subscriber(this.proxy)); }
  setData(key, value) { this.proxy[key] = value; }
  getData(key) { return this.proxy[key]; }
}

const sharedStore = new DataStore();

function withDataStore(Component) {
  return class extends Component {
    constructor(props) {
      super(props);
      this.store = sharedStore;
      this.store.subscribe(this.update.bind(this));
      this.state = { ...this.state, data: this.store.data };
    }
    update(data) { this.setState({ data }); this.render(); }
    setData(key, value) { this.store.setData(key, value); }
    getData(key) { return this.store.getData(key); }
  }
}

function input(property) {
  return function (target, key) {
    Object.defineProperty(target, key, {
      get() { return this.props[property]; },
      set(value) { this.props[property] = value; this.render(); }
    });
  }
}

function output(property) {
  return function (target, key) {
    const eventName = property + 'Changed';
    target[eventName] = function (value) { this.props[property] = value; this.render(); };
  }
}

class Router {
  constructor(options = {}) {
    this.pathRoot = options.pathRoot || '';
    this.routes = [];
    this.type = options.type || 'path';
    this.path = options.path || null;
    this.hash = options.hash || null;
    this.context = options.context || this;
    this.handler = options.handler || window;

    if (options.routes) {
      for (let [route, callback] of Object.entries(options.routes)) this.add(route, callback);
    }
  }

  add(route, callback) {
    this.routes.push(new Route(route, callback, this));
    return this;
  }

  empty() { this.routes = []; return this; }
  setType(type) { this.type = type; return this; }
  setPathRoot(url) { this.pathRoot = url; return this; }
  setPath(path) { this.path = path; return this; }
  setHash(hash) { this.hash = hash; return this; }
  setContext(context) { this.context = context; return this; }
  setHandler(handler) { this.handler = handler; return this; }

  getUrl() {
    if (this.type === 'path') return decodeURI((this.path || window.location.pathname.substring(1)).replace(new RegExp(`^${this.pathRoot}/?`), ''));
    return decodeURI(this.hash || window.location.hash.substring(1));
  }

  match(path, callback) {
    let route = new Route(path, callback, this);
    if (route.test(this.getUrl())) return route.run();
  }

  run() {
    let url = this.getUrl();
    for (let route of this.routes) if (route.test(url)) return route.run();
  }
}

class Route {
  constructor(path, callback, router) {
    this.path = path;
    this.callback = callback;
    this.router = router;
    this.values = [];
  }

  regex() {
    return typeof this.path === 'string'
      ? new RegExp(`^${this.path.replace(/\//g, '\\/').replace(this.router.namedParam.match, this.router.namedParam.replace)}$`)
      : this.path;
  }

  params() {
    let obj = {};
    (typeof this.path === 'string' ? this.path.match(this.router.namedParam.match) : this.values).forEach((param, i) => {
      obj[typeof this.path === 'string' ? param.replace(this.router.namedParam.match, '$1') : i] = this.values[i];
    });
    return obj;
  }

  test(url) {
    let matches = url.match(this.regex());
    if (matches) { this.values = matches.slice(1); return true; }
    return false;
  }

  run() {
    return typeof this.callback === 'string'
      ? this.router.handler[this.callback](this.params())
      : this.callback.call(this.router.context, this.params());
  }
}

export { html, createElement, createComponent, isFunction, addHandlers, sharedStore, withDataStore, input, output, Router };