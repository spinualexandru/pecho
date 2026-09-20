import { BrowserWindow, ipcMain } from "electron";
import {
  WIN_CLOSE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_MINIMIZE_CHANNEL,
} from "./window-channels";

export function addWindowEventListeners() {
  ipcMain.handle(WIN_MINIMIZE_CHANNEL, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle(WIN_MAXIMIZE_CHANNEL, (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle(WIN_CLOSE_CHANNEL, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}
