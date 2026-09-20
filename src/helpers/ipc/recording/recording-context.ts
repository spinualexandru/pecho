import { contextBridge, ipcRenderer } from "electron";
import { RECORDING_CHANNELS } from "./recording-channels";
import type { WhisperModel } from "@/helpers/whisper-helpers";

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export function exposeRecordingContext() {
  contextBridge.exposeInMainWorld("recording", {
    transcribeAudio: async (
      audioBuffer: ArrayBuffer,
      model?: WhisperModel,
      language?: string,
    ): Promise<string> => {
      return ipcRenderer.invoke(
        RECORDING_CHANNELS.TRANSCRIBE_AUDIO,
        audioBuffer,
        model,
        language,
      );
    },
    summarizeTranscript: async (
      transcript: string,
      model?: string,
      language?: string,
    ): Promise<string> => {
      return ipcRenderer.invoke(
        RECORDING_CHANNELS.SUMMARIZE_TRANSCRIPT,
        transcript,
        model,
        language,
      );
    },
    getOllamaModels: async (): Promise<OllamaModel[]> => {
      return ipcRenderer.invoke(RECORDING_CHANNELS.GET_OLLAMA_MODELS);
    },
  });
}
