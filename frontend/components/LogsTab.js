export default {
  props: ['logs'],
  emits: ['refresh', 'clear'],
  template: `
  <div>
    <button @click="$emit('refresh')">Refresh</button>
    <button @click="$emit('clear')">Clear</button>
    <pre>{{ logs.map(l => l.method + ' ' + l.path + '\nHeaders: ' + JSON.stringify(l.headers) + '\nBody:' + l.body + '\n---').join('\n') }}</pre>
  </div>`
};
