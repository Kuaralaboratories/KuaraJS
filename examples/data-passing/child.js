import { Input, Output } from './data-passer.js';
import Kuarajs from 'KuaraJS';

class ChildComponent {
  @Input() item = '';

  @Output() itemChanged = function (value) {
    this.props.itemChanged(value);
  }

  handleClick() {
    const newItem = 'Updated Item';
    this.item = newItem;
    this.itemChanged(newItem);
  }

  render() {
    return html`
      <button onClick=${this.handleClick.bind(this)}>
        Click me
      </button>
      <p>Item: ${this.item}</p>
    `;
  }
}

export default ChildComponent;
