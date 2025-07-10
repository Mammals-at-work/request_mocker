import FileSelector from './FileSelector.js';
import ControlButtons from './ControlButtons.js';
import EndpointsTab from './EndpointsTab.js';
import LogsTab from './LogsTab.js';
import SettingsTab from './SettingsTab.js';
import * as api from '../services/api.js';

export default {
  components: { FileSelector, ControlButtons, EndpointsTab, LogsTab, SettingsTab },
  data() {
    return {
      file: '',
      routes: {},
      port: 8000,
      status: 'Stopped',
      logs: [],
      activeTab: 'endpoints',
      lang: 'en'
    };
  },
  methods: {
    async browseFile() {
      const f = await api.selectFile();
      if (f) {
        this.file = f;
        this.showRoutes();
      }
    },
    async showRoutes() {
      if (!this.file) return;
      const r = await api.listRoutes(this.file);
      this.routes = r || {};
    },
    async startServer() {
      if (!this.file) return;
      const ok = await api.startServer(this.file, this.port);
      if (ok) this.status = `Running on http://localhost:${this.port}`;
    },
    async stopServer() {
      const ok = await api.stopServer();
      if (ok) this.status = 'Stopped';
    },
    async refreshLogs() {
      this.logs = await api.getLogs();
    },
    async clearLogs() {
      await api.clearLogs();
      this.logs = [];
    }
  },
  template: `
  <div class="container">
    <h1>Request Mocker</h1>
    <div class="selector">
      <FileSelector v-model="file" @browse="browseFile" />
    </div>
    <ControlButtons @start="startServer" @stop="stopServer" :status="status" />
    <div class="tabs">
      <button :class="{active: activeTab==='endpoints'}" @click="activeTab='endpoints'">Endpoints</button>
      <button :class="{active: activeTab==='logs'}" @click="activeTab='logs'">Logs</button>
      <button :class="{active: activeTab==='settings'}" @click="activeTab='settings'">Settings</button>
    </div>
    <div v-show="activeTab==='endpoints'">
      <EndpointsTab :routes="routes" />
    </div>
    <div v-show="activeTab==='logs'">
      <LogsTab :logs="logs" @refresh="refreshLogs" @clear="clearLogs" />
    </div>
    <div v-show="activeTab==='settings'">
      <SettingsTab :port="port" :lang="lang" @update:port="port=$event" @update:lang="lang=$event" />
    </div>
  </div>`
};
