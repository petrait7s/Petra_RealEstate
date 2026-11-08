// Electron shell: runs the API in-process on a random localhost port and shows the web UI.
const { app, BrowserWindow, shell, dialog } = require("electron");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

let server;

async function boot() {
  const data = app.getPath("userData");
  process.env.DB_PATH = join(data, "petra.db");
  process.env.DATA_DIR = data;
  process.env.WEB_DIR = join(__dirname, "app", "web");
  process.env.SEED = process.env.PETRA_DEMO === "1" ? "1" : "0"; // real installs start empty -> first-run setup
  const { start } = await import(pathToFileURL(join(__dirname, "app", "api.mjs")).href);
  server = await start({ port: 0, host: "127.0.0.1" }); // loopback only
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600, backgroundColor: "#0c1d35", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith(`http://127.0.0.1:${server.port}`)) e.preventDefault(); });
  await win.loadURL(`http://127.0.0.1:${server.port}`);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(boot).catch((e) => { dialog.showErrorBox("Petra failed to start", String(e && e.stack || e)); app.quit(); });
  app.on("window-all-closed", () => { server?.close().finally(() => app.quit()); });
}
