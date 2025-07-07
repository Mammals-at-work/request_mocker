export default {
  props: ['status'],
  emits: ['start', 'stop'],
  template: `
  <div class="controls">
    <button @click="$emit('start')">Start Server</button>
    <button @click="$emit('stop')">Stop Server</button>
    <span>{{ status }}</span>
  </div>`
};
