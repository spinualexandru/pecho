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
  startSummary: (
    request: import("./helpers/summary-contract").SummaryRequest,
  ) => Promise<void>;
  cancelSummary: (requestId: string) => Promise<void>;
  onSummaryEvent: (
    callback: (
      event: import("./helpers/summary-contract").SummaryEvent,
    ) => void,
  ) => () => void;
  getOllamaStatus: () => Promise<
    import("./helpers/summary-contract").OllamaStatus
  >;
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
