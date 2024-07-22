import htm from "https://unpkg.com/htm?module";
import Morphdom from "https://unpkg.com/morphdom@2.6.1/dist/morphdom-esm.js";
import OnChange from "https://unpkg.com/on-change@4.0.2/index.js";

const h = (type, props, ...children) => ({ type, props, children: children.flat() });
const html = htm.bind(h);

function createComponent(node) {
  let hasRendered = false;

  const renderFn = node.type(node.props, {
    reRender,
    observe: (obj) => {
      if (isPrimitive(obj)) console.error("observe must be passed an Object or Array, was passed", obj);
      return OnChange(obj, reRender);
    },
    store,
    diContainer, 
  });

  function reRender() {
    console.log("reRender");
    if (!hasRendered) console.error("You may be setting an observable in a render fn triggering re-render before the initial.");
    Morphdom($root, createElement(renderFn()), {
      getNodeKey(node) {
        return node?.dataset?.key;
      },
      onBeforeElUpdated: (fromEl, toEl) => {
        if (toEl.dataset.skip) return false;
        return !fromEl.isEqualNode(toEl);
      },
    });
  }

  const vNodes = renderFn();
  if (Array.isArray(vNodes)) console.error("Component is returning multiple nodes as root. Can only have one.", node.type);
  const $root = createElement(vNodes);
  hasRendered = true;

  const unsubscribe = store.subscribe(reRender);

  $root.addEventListener('DOMNodeRemoved', () => {
    unsubscribe();
  });

  return $root;
}

function createElement(node) {
  if (!node?.type) return document.createTextNode(node);
  const $el = isFunction(node.type) ? createComponent(node) : document.createElement(node.type);

  if (node.props) {
    Object.entries(node.props).forEach(([key, val]) => {
      if (key === "checked") {
        if (val) $el.setAttribute(key, val);
      } else if (isPrimitive(val)) $el.setAttribute(key, val);
    });
    addHandlers($el, node);
  }
  node.children.map(createElement).forEach(($child) => $el.appendChild($child));
  return $el;
}

function isFunction(item) {
  return item instanceof Function;
}

function isPrimitive(item) {
  return !isFunction(item) && typeof item !== "object";
}

/* Old Dependency Injection
class DIContainer {
  constructor() {
    this.services = new Map();
  }

  register(name, instance) {
    this.services.set(name, instance);
  }

  resolve(name) {
    return this.services.get(name);
  }
}

const diContainer = new DIContainer();
*/

const inject = (di = {}) => (define) => {
  const func = define(di);
  func.inject = (overrides) => inject({...di, ...overrides});
  return func;
};

class DataStore {
  constructor(initialData = {}) {
    this.data = initialData;
    this.subscribers = new Set();
    this.proxy = new Proxy(this.data, {
      set: (target, key, value) => {
        target[key] = value;
        this.notifySubscribers();
        return true;
      }
    });
  }

  subscribe(subscriber) {
    this.subscribers.add(subscriber);
  }

  unsubscribe(subscriber) {
    this.subscribers.delete(subscriber);
  }

  notifySubscribers() {
    this.subscribers.forEach(subscriber => subscriber(this.proxy));
  }

  setData(key, value) {
    this.proxy[key] = value;
  }

  getData(key) {
    return this.proxy[key];
  }
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

    update(data) {
      this.setState({ data });
      this.render();
    }

    setData(key, value) {
      this.store.setData(key, value);
    }

    getData(key) {
      return this.store.getData(key);
    }
  }
}

function input(property) {
  return function (target, key) {
    Object.defineProperty(target, key, {
      get: function () {
        return this.props[property];
      },
      set: function (value) {
        this.props[property] = value;
        this.render();
      }
    });
  }
}

function output(property) {
  return function (target, key) {
    const eventName = property + 'Changed';
    target[eventName] = function (value) {
      this.props[property] = value;
      this.render();
    };
  }
}

const eventName = (event) => event.replace("on", "").toLowerCase();

function addHandlers($el, { props }) {
  if (!props) return;

  Object.entries(props)
    .filter(([key]) => key.startsWith("on"))
    .forEach(([event, func]) => {
      $el.addEventListener(eventName(event), func);
    });
}

class router {
  constructor(options = {}) {
    this.pathRoot = '';
    this.routes = [];
    this.type = options.type || 'path';
    this.path = options.path || null;
    this.hash = options.hash || null;
    this.context = options.context || this;
    this.handler = options.handler || window;

    this.namedParam = {
      match: /{([\w-]+)}/g,
      replace: '([\\w-]+)',
    };

    if (options.pathRoot) this.setPathRoot(options.pathRoot);
    if (options.routes) {
      for (let [route, callback] of Object.entries(options.routes)) {
        this.add(route, callback);
      }
    }
  }

  add(route, callback) {
    this.routes.push(new Route(route, callback, this));
    return this;
  }

  empty() {
    this.routes = [];
    return this;
  }

  setType(type) {
    this.type = type;
    return this;
  }

  setPathRoot(url) {
    this.pathRoot = url;
    return this;
  }

  setPath(path) {
    this.path = path;
    return this;
  }

  setHash(hash) {
    this.hash = hash;
    return this;
  }

  setContext(context) {
    this.context = context;
    return this;
  }

  setHandler(handler) {
    this.handler = handler;
    return this;
  }

  getUrl(routeType = this.type) {
    if (routeType === 'path') {
      let rootRegex = new RegExp(`^${this.pathRoot}/?`);
      let url = this.path || window.location.pathname.substring(1);
      return decodeURI(url.replace(rootRegex, ''));
    } else if (routeType === 'hash') {
      return decodeURI(this.hash || window.location.hash.substring(1));
    }
  }

  match(path, callback) {
    let route = new Route(path, callback, this);
    if (route.test(this.getUrl())) {
      return route.run();
    }
  }

  run() {
    let url = this.getUrl();
    for (let route of this.routes) {
      if (route.test(url)) {
        route.run();
        return route;
      }
    }
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
    if (typeof this.path === 'string') {
      return new RegExp(`^${this.path.replace(/\//g, '\\/').replace(this.router.namedParam.match, this.router.namedParam.replace)}$`);
    }
    return this.path;
  }

  params() {
    let obj = {};
    let params = typeof this.path === 'string' ? this.path.match(this.router.namedParam.match) : this.values;
    params.forEach((param, i) => {
      let name = typeof this.path === 'string' ? param.replace(this.router.namedParam.match, '$1') : i;
      obj[name] = this.values[i];
    });
    return obj;
  }

  test(url) {
    let matches = url.match(this.regex());
    if (matches) {
      this.values = matches.slice(1);
      return true;
    }
    return false;
  }

  run() {
    if (typeof this.callback === 'string') {
      return this.router.handler[this.callback](this.params());
    }
    return this.callback.call(this.router.context, this.params());
  }
}

export { 
  html, 
  createElement, 
  createComponent, 
  isFunction, 
  isPrimitive, 
  /* diContainer, */
  withDataStore, 
  input, 
  output, 
  sharedStore, 
  addHandlers, 
  inject,
  router,
};