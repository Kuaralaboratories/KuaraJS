//import OnChange from "https://unpkg.com/on-change@4.0.2/index.js";

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

export { withDataStore, Input, Output, sharedStore };
