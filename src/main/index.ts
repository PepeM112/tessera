import { join } from "path";

import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { app, BrowserWindow } from "electron";

import icon from "../../resources/icon.png?asset";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0d10",
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow.show());

  // Deny all new windows. External links will go through a safe-links allowlist (see CLAUDE.md).
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (is.dev && rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
    return;
  }
  void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}

void app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.tessera.app");

  // F12 opens DevTools in dev. Cmd/Ctrl+R reload is ignored in production.
  app.on("browser-window-created", (_, window) => optimizer.watchWindowShortcuts(window));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
