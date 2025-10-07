import { contextBridge, ipcRenderer } from "electron";
import { RECORDING_CHANNELS } from "./recording-channels";

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export function exposeRecordingContext() {
  contextBridge.exposeInMainWorld("recording", {
    transcribeAudio: async (audioBuffer: ArrayBuffer): Promise<string> => {
      return ipcRenderer.invoke(
        RECORDING_CHANNELS.TRANSCRIBE_AUDIO,
        audioBuffer,
      );
    },
    summarizeTranscript: async (
      transcript: string,
      model?: string,
    ): Promise<string> => {
      return ipcRenderer.invoke(
        RECORDING_CHANNELS.SUMMARIZE_TRANSCRIPT,
        transcript,
        model,
      );
    },
    getOllamaModels: async (): Promise<OllamaModel[]> => {
      return ipcRenderer.invoke(RECORDING_CHANNELS.GET_OLLAMA_MODELS);
    },
  });
}
