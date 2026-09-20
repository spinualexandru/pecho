import { contextBridge, ipcRenderer } from "electron";
import { RECORDING_CHANNELS } from "./recording-channels";
import type { WhisperModel } from "@/helpers/whisper-helpers";

export function exposeRecordingContext() {
  contextBridge.exposeInMainWorld("recording", {
    getWhisperModels: () =>
      ipcRenderer.invoke(RECORDING_CHANNELS.GET_WHISPER_MODELS),
    downloadWhisperModel: (model: WhisperModel) =>
      ipcRenderer.invoke(RECORDING_CHANNELS.DOWNLOAD_WHISPER_MODEL, model),
    deleteWhisperModel: (model: WhisperModel) =>
      ipcRenderer.invoke(RECORDING_CHANNELS.DELETE_WHISPER_MODEL, model),
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
    startSummary: (
      request: import("@/helpers/summary-contract").SummaryRequest,
    ) => ipcRenderer.invoke(RECORDING_CHANNELS.SUMMARIZE_TRANSCRIPT, request),
    cancelSummary: (requestId: string) =>
      ipcRenderer.invoke(RECORDING_CHANNELS.CANCEL_SUMMARY, requestId),
    onSummaryEvent: (
      callback: (
        event: import("@/helpers/summary-contract").SummaryEvent,
      ) => void,
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        data: import("@/helpers/summary-contract").SummaryEvent,
      ) => callback(data);
      ipcRenderer.on(RECORDING_CHANNELS.SUMMARY_EVENT, listener);
      return () =>
        ipcRenderer.removeListener(RECORDING_CHANNELS.SUMMARY_EVENT, listener);
    },
    getOllamaStatus: () =>
      ipcRenderer.invoke(RECORDING_CHANNELS.GET_OLLAMA_STATUS),
  });
}
