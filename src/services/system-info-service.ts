import si from "systeminformation";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface GPUInfo {
  vram: number; // VRAM in bytes
  name: string;
}

async function getNvidiaVRAMMap(): Promise<Map<string, number> | null> {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", [
      "--query-gpu=memory.total,name",
      "--format=csv,noheader,nounits",
    ]);

    const lines = stdout.trim().split("\n");
    if (lines.length === 0) return null;

    const vramMap = new Map<string, number>();
    for (const line of lines) {
      const [vramMB, name] = line.split(",").map((s) => s.trim());
      const vramBytes = parseInt(vramMB, 10) * 1024 * 1024; // Convert MB to bytes
      vramMap.set(name, vramBytes);
    }

    return vramMap;
  } catch {
    // nvidia-smi not available or failed
    return null;
  }
}

export async function getGPUVRAM(): Promise<GPUInfo | null> {
  try {
    const graphics = await si.graphics();
    const platform = process.platform;

    // Check if there's an NVIDIA GPU in the controllers
    const hasNvidiaGPU = graphics.controllers.some((controller) =>
      controller.vendor?.toLowerCase().includes("nvidia"),
    );

    // On Linux with NVIDIA GPU, get accurate VRAM from nvidia-smi
    let nvidiaVRAMMap: Map<string, number> | null = null;
    if (platform === "linux" && hasNvidiaGPU) {
      nvidiaVRAMMap = await getNvidiaVRAMMap();
    }

    // Get the first dedicated GPU controller with VRAM info
    const gpuVendors = ["nvidia", "amd", "ati", "intel"];

    let dedicatedGPU: si.Systeminformation.GraphicsControllerData | null = null;

    for (const controller of graphics.controllers) {
      if (
        controller.vram &&
        controller.vram > 0 &&
        controller.vendor &&
        controller.pciID !== "" &&
        gpuVendors.some((vendor) =>
          controller.vendor.toLowerCase().includes(vendor),
        )
      ) {
        dedicatedGPU = controller;
        break;
      }
    }

    if (dedicatedGPU && dedicatedGPU.vram) {
      let vram = dedicatedGPU.vram * 1024 * 1024; // Convert MB to bytes
      const name = dedicatedGPU.model || "Unknown GPU";

      // If we have nvidia-smi data, use it to correct the VRAM value
      if (
        nvidiaVRAMMap &&
        dedicatedGPU.vendor?.toLowerCase().includes("nvidia")
      ) {
        // Try to find matching GPU by name in nvidia-smi output
        for (const [nvidiaName, nvidiaVRAM] of nvidiaVRAMMap.entries()) {
          if (name.includes(nvidiaName) || nvidiaName.includes(name)) {
            vram = nvidiaVRAM;
            break;
          }
        }
        // If no match found, use the first NVIDIA GPU from nvidia-smi
        if (vram === dedicatedGPU.vram * 1024 * 1024) {
          const firstNvidiaVRAM = nvidiaVRAMMap.values().next().value;
          if (firstNvidiaVRAM) vram = firstNvidiaVRAM;
        }
      }

      return {
        vram,
        name,
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting GPU VRAM:", error);
    return null;
  }
}
