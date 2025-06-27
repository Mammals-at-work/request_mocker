const fileInput = document.getElementById('file') as HTMLInputElement;
const portInput = document.getElementById('port') as HTMLInputElement;
const statusLabel = document.getElementById('status') as HTMLSpanElement;

(document.getElementById('browse') as HTMLButtonElement).addEventListener('click', async () => {
  const file = await (window as any).api.selectFile();
  if (file) fileInput.value = file;
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
