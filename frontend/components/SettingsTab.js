export default {
  props: ['port', 'lang'],
  emits: ['update:port', 'update:lang'],
  template: `
  <div>
    <div>
      <label>Port: <input type="number" :value="port" @input="$emit('update:port', Number($event.target.value))" /></label>
    </div>
    <div>
      <label>Language:
        <select :value="lang" @change="$emit('update:lang', $event.target.value)">
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>
    </div>
  </div>`
};
