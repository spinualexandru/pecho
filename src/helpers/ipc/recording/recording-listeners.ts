import { ipcMain } from "electron";
import { RECORDING_CHANNELS } from "./recording-channels";
import {
  summarizeTranscript,
  getAvailableModels,
} from "@/services/ollama-service";
import { transcribeAudio } from "@/services/whisper-service";

export function registerRecordingListeners() {
  ipcMain.handle(
    RECORDING_CHANNELS.TRANSCRIBE_AUDIO,
    async (_event, audioBuffer: ArrayBuffer) => {
      // Convert ArrayBuffer to Float32Array
      const float32Data = new Float32Array(audioBuffer);
      return await transcribeAudio(float32Data);
    },
  );

  ipcMain.handle(
    RECORDING_CHANNELS.SUMMARIZE_TRANSCRIPT,
    async (_event, transcript: string, model?: string) => {
      return await summarizeTranscript(transcript, model);
    },
  );

  ipcMain.handle(RECORDING_CHANNELS.GET_OLLAMA_MODELS, async () => {
    return await getAvailableModels();
  });
}
