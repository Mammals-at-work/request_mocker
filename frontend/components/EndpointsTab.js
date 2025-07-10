export default {
  props: ['routes'],
  template: `
  <div>
    <h3>Loaded Endpoints</h3>
    <ul>
      <li v-for="(route, key) in routes" :key="key">
        {{ key }} -> status {{ route.status }}
      </li>
    </ul>
  </div>`
};
