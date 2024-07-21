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

function Input(property) {
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

function Output(property) {
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

export { html, createElement, createComponent,isFunction, isPrimitive, diContainer, withDataStore, Input, Output, sharedStore, addHandlers };