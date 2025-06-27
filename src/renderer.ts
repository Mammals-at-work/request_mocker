const fileInput = document.getElementById('file') as HTMLInputElement;
const portInput = document.getElementById('port') as HTMLInputElement;
const statusLabel = document.getElementById('status') as HTMLSpanElement;
const routesDiv = document.getElementById('routes') as HTMLDivElement;

async function showRoutes(file: string) {
  const routes = await window.api.listRoutes(file);
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

(document.getElementById('browse') as HTMLButtonElement).addEventListener('click', async () => {
  const file = await (window as any).api.selectFile();
  if (file) {
    fileInput.value = file;
    showRoutes(file);
  }
});

(document.getElementById('start') as HTMLButtonElement).addEventListener('click', async () => {
  const file = fileInput.value;
  const port = parseInt(portInput.value, 10) || 8000;
  const ok = await (window as any).api.startServer(file, port);
  if (ok) statusLabel.textContent = `Running on http://localhost:${port}`;
});

(document.getElementById('stop') as HTMLButtonElement).addEventListener('click', async () => {
  const ok = await (window as any).api.stopServer();
  if (ok) statusLabel.textContent = 'Stopped';
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
