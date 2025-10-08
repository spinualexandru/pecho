import { contextBridge, ipcRenderer } from "electron";
import { SYSTEM_INFO_CHANNELS } from "./system-info-channels";

export interface GPUInfo {
  vram: number; // VRAM in bytes
  name: string;
}

export function exposeSystemInfoContext() {
  contextBridge.exposeInMainWorld("systemInfo", {
    getGPUVRAM: async (): Promise<GPUInfo | null> => {
      return ipcRenderer.invoke(SYSTEM_INFO_CHANNELS.GET_GPU_VRAM);
    },
  });
}
