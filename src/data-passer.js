import OnChange from "https://unpkg.com/on-change@4.0.2/index.js";

class DataStore {
  constructor(initialData = {}) {
    this.data = initialData;
    this.subscribers = new Set();
  }

  subscribe(subscriber) {
    this.subscribers.add(subscriber);
  }

  unsubscribe(subscriber) {
    this.subscribers.delete(subscriber);
  }

  notifySubscribers() {
    this.subscribers.forEach((subscriber) => subscriber(this.data));
  }

  setData(key, value) {
    this.data[key] = value;
    this.notifySubscribers();
  }

  getData(key) {
    return this.data[key];
  }
}

// Create a global shared data store
const sharedStore = new DataStore();

function withDataStore(Component) {
  return class extends Component {
    constructor(props) {
      super(props);
      this.store = sharedStore;
      this.store.subscribe(this.update.bind(this));
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

function injectData(parentComponent, dataKey) {
  return class extends parentComponent.constructor {
    constructor(props) {
      super(props);
      this.data = parentComponent.getData(dataKey);
    }

    render() {
      console.log(`Rendering ${this.constructor.name} with data:`, this.data);
      super.render();
    }
  }
}

export { withDataStore, injectData, sharedStore };
  