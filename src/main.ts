import { app, BrowserWindow, session } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import { REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";
// Installer 4's loading wrapper uses deprecated Session methods. Keep its
// downloader/cache, but load through Electron's current Extensions API.
import { downloadChromeExtension } from "electron-devtools-installer/dist/downloadChromeExtension";

const inDevelopment = process.env.NODE_ENV === "development";

async function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const mainWindow = new BrowserWindow({
    name: "personal-echo-main",
    windowStatePersistence: true,
    width: 800,
    height: 600,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,
      preload: preload,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    autoHideMenuBar: true,
    trafficLightPosition:
      process.platform === "darwin" ? { x: 5, y: 5 } : undefined,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

async function installExtensions() {
  try {
    const extensions = session.defaultSession.extensions;
    const existing = extensions.getExtension(REACT_DEVELOPER_TOOLS.id);
    const result =
      existing ??
      (await extensions.loadExtension(
        await downloadChromeExtension(REACT_DEVELOPER_TOOLS.id),
        { allowFileAccess: true },
      ));
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch (error) {
    console.error("Failed to install extensions", error);
  }
}

app
  .whenReady()
  .then(() => {
    registerListeners();
    return createWindow();
  })
  .then(() => {
    if (inDevelopment) return installExtensions();
  })
  .catch((error) => {
    console.error("Failed to start Personal Echo", error);
    app.quit();
  });

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error("Failed to open Personal Echo", error);
      app.quit();
    });
  }
});
//osX only ends
