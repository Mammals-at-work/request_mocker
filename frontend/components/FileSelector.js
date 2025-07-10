export default {
  props: ['modelValue'],
  emits: ['update:modelValue', 'browse'],
  template: `
  <div class="file-selector">
    <input type="text" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" placeholder="OpenAPI file" />
    <button @click="$emit('browse')">Browse</button>
  </div>`
};
