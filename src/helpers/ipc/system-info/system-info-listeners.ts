import { ipcMain } from "electron";
import { SYSTEM_INFO_CHANNELS } from "./system-info-channels";
import { getGPUVRAM } from "@/services/system-info-service";

export function registerSystemInfoListeners() {
  ipcMain.handle(SYSTEM_INFO_CHANNELS.GET_GPU_VRAM, async () => {
    return await getGPUVRAM();
  });
}
