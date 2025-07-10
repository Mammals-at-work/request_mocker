const fileInput = document.getElementById('file') as HTMLInputElement;
const portInput = document.getElementById('port') as HTMLInputElement;
const dataInput = document.getElementById('dataFile') as HTMLInputElement;
const statusLabel = document.getElementById('status') as HTMLSpanElement;
const routesDiv = document.getElementById('routes') as HTMLDivElement;
const logsPre = document.getElementById('logs') as HTMLPreElement;

async function showRoutes(file: string) {
  const routes = await window.api.listRoutes(file, dataInput.value || undefined);
  routesDiv.innerHTML = '';
  if (!routes) return;
  const ul = document.createElement('ul');
  for (const key of Object.keys(routes)) {
    const li = document.createElement('li');
    const route = routes[key];
    li.textContent = `${key} -> status ${route.status}`;
    ul.appendChild(li);
  }
  routesDiv.appendChild(ul);
}

async function refreshLogs() {
  const entries = await (window as any).api.getLogs();
  logsPre.textContent = entries.map((l: any) => {
    return `${l.method} ${l.path}\nHeaders: ${JSON.stringify(l.headers)}\nBody: ${l.body}\n---`;
  }).join('\n');
}

(document.getElementById('browse') as HTMLButtonElement).addEventListener('click', async () => {
  const file = await (window as any).api.selectFile();
  if (file) {
    fileInput.value = file;
    showRoutes(file);
  }
});

(document.getElementById('browseData') as HTMLButtonElement).addEventListener('click', async () => {
  const file = await (window as any).api.selectDataFile();
  if (file) {
    dataInput.value = file;
    showRoutes(fileInput.value);
  }
});

(document.getElementById('start') as HTMLButtonElement).addEventListener('click', async () => {
  const file = fileInput.value;
  const port = parseInt(portInput.value, 10) || 8000;
  const ok = await (window as any).api.startServer(file, port, dataInput.value || undefined);
  if (ok) statusLabel.textContent = `Running on http://localhost:${port}`;
});

(document.getElementById('stop') as HTMLButtonElement).addEventListener('click', async () => {
  const ok = await (window as any).api.stopServer();
  if (ok) statusLabel.textContent = 'Stopped';
});

(document.getElementById('refreshLogs') as HTMLButtonElement).addEventListener('click', refreshLogs);
(document.getElementById('clearLogs') as HTMLButtonElement).addEventListener('click', async () => {
  await (window as any).api.clearLogs();
  refreshLogs();
});

const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tabs button');
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab').forEach(tab => {
      if ((tab as HTMLElement).id === 'tab-' + btn.dataset.tab) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  });
});

const dropArea = document.getElementById('drop');
if (dropArea) {
  dropArea.addEventListener('dragover', e => {
    e.preventDefault();
  });
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) {
      const p = (file as any).path;
      fileInput.value = p;
      showRoutes(p);
    }
  });
}
