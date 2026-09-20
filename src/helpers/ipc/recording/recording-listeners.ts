import { ipcMain } from "electron";
import { RECORDING_CHANNELS } from "./recording-channels";
import {
  summarizeTranscript,
  getAvailableModels,
} from "@/services/ollama-service";
import {
  transcribeAudio,
  getWhisperModels,
  downloadWhisperModel,
  deleteWhisperModel,
} from "@/services/whisper-service";
import type { WhisperModel } from "@/helpers/whisper-helpers";

export function registerRecordingListeners() {
  // Reopening a window must not register duplicate process-wide handlers.
  for (const channel of Object.values(RECORDING_CHANNELS))
    ipcMain.removeHandler(channel);
  ipcMain.handle(RECORDING_CHANNELS.GET_WHISPER_MODELS, () =>
    getWhisperModels(),
  );
  ipcMain.handle(
    RECORDING_CHANNELS.DOWNLOAD_WHISPER_MODEL,
    (_event, model: WhisperModel) => downloadWhisperModel(model),
  );
  ipcMain.handle(
    RECORDING_CHANNELS.DELETE_WHISPER_MODEL,
    (_event, model: WhisperModel) => deleteWhisperModel(model),
  );
  ipcMain.handle(
    RECORDING_CHANNELS.TRANSCRIBE_AUDIO,
    async (
      _event,
      audioBuffer: ArrayBuffer,
      model?: WhisperModel,
      language?: string,
    ) => {
      // Convert ArrayBuffer to Float32Array
      const float32Data = new Float32Array(audioBuffer);
      return await transcribeAudio(float32Data, model, language);
    },
  );

  ipcMain.handle(
    RECORDING_CHANNELS.SUMMARIZE_TRANSCRIPT,
    async (_event, transcript: string, model?: string, language?: string) => {
      return await summarizeTranscript(transcript, model, language);
    },
  );

  ipcMain.handle(RECORDING_CHANNELS.GET_OLLAMA_MODELS, async () => {
    return await getAvailableModels();
  });
}
