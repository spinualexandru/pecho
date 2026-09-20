// Preload types
interface ThemeModeContext {
  toggle: () => Promise<boolean>;
  dark: () => Promise<void>;
  light: () => Promise<void>;
  system: () => Promise<boolean>;
  current: () => Promise<"dark" | "light" | "system">;
}
interface ElectronWindow {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface RecordingContext {
  getWhisperModels: () => Promise<
    import("./helpers/whisper-helpers").WhisperModelStatus[]
  >;
  downloadWhisperModel: (
    model: import("./helpers/whisper-helpers").WhisperModel,
  ) => Promise<void>;
  deleteWhisperModel: (
    model: import("./helpers/whisper-helpers").WhisperModel,
  ) => Promise<void>;
  transcribeAudio: (
    audioBuffer: ArrayBuffer,
    model?: import("./helpers/whisper-helpers").WhisperModel,
    language?: string,
  ) => Promise<string>;
  summarizeTranscript: (
    transcript: string,
    model?: string,
    language?: string,
  ) => Promise<string>;
  getOllamaModels: () => Promise<OllamaModel[]>;
}

interface GPUInfo {
  vram: number; // VRAM in bytes
  name: string;
}

interface SystemInfoContext {
  getGPUVRAM: () => Promise<GPUInfo | null>;
}

declare interface Window {
  themeMode: ThemeModeContext;
  electronWindow: ElectronWindow;
  recording: RecordingContext;
  systemInfo: SystemInfoContext;
}
