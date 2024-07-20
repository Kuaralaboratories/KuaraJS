/* data-passing.js KuaraJS Data Passing Example */

import Kuarajs from 'KuaraJS';
import { withDataStore, Input, Output, sharedStore } from './data-passer.js';

class ParentComponent {
  constructor(props) {
    this.props = props;
    this.store = sharedStore;
  }

  handleChildEvent(value) {
    console.log('Received event from child:', value);
  }

  render() {
    return html`
      <div>
        <h1>Parent Component</h1>
        <${ChildComponent} item=${this.store.getData('item')} (itemChanged)=${this.handleChildEvent.bind(this)} />
      </div>
    `;
  }
}

export default withDataStore(ParentComponent);
