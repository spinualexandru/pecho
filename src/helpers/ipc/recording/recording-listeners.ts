import { ipcMain } from "electron";
import { RECORDING_CHANNELS } from "./recording-channels";
import { getOllamaStatus } from "@/services/ollama-service";
import { SummaryJobs } from "@/services/summary-jobs";
import {
  requestIdSchema,
  summaryRequestSchema,
  validateTranscription,
} from "@/helpers/summary-contract";
import { isWhisperModel } from "@/helpers/whisper-helpers";
import {
  transcribeAudio,
  getWhisperModels,
  downloadWhisperModel,
  deleteWhisperModel,
} from "@/services/whisper-service";
import type { WhisperModel } from "@/helpers/whisper-helpers";

import { desktopProgress } from "@/services/desktop-progress";

const summaries = new SummaryJobs();
const watched = new WeakSet<Electron.WebContents>();
function watch(sender: Electron.WebContents) {
  if (watched.has(sender)) return;
  watched.add(sender);
  const owner = sender.id;
  const dispose = () => {
    summaries.dispose(owner);
    desktopProgress.clearOwner(owner);
  };
  sender.on("render-process-gone", dispose);
  sender.once("destroyed", dispose);
  sender.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) dispose();
  });
}
function validateModel(model: unknown) {
  if (!isWhisperModel(model)) throw new Error("Invalid Whisper model");
  return model;
}

export function registerRecordingListeners() {
  // Reopening a window must not register duplicate process-wide handlers.
  for (const channel of Object.values(RECORDING_CHANNELS))
    ipcMain.removeHandler(channel);
  ipcMain.handle(RECORDING_CHANNELS.GET_WHISPER_MODELS, () =>
    getWhisperModels(),
  );
  ipcMain.handle(
    RECORDING_CHANNELS.DOWNLOAD_WHISPER_MODEL,
    (event, model: WhisperModel) => {
      const id = validateModel(model);
      watch(event.sender);
      return desktopProgress.run(
        `${event.sender.id}:download:${crypto.randomUUID()}`,
        () => downloadWhisperModel(id),
        async () => {
          const status = (await getWhisperModels()).find(
            (entry) => entry.id === id,
          );
          return status?.phase === "downloading" &&
            status.progressTotalBytes > 0
            ? Math.min(1, status.loadedBytes / status.progressTotalBytes)
            : 2;
        },
      );
    },
  );
  ipcMain.handle(
    RECORDING_CHANNELS.DELETE_WHISPER_MODEL,
    (_event, model: WhisperModel) => deleteWhisperModel(validateModel(model)),
  );
  ipcMain.handle(
    RECORDING_CHANNELS.TRANSCRIBE_AUDIO,
    async (
      event,
      audioBuffer: ArrayBuffer,
      model?: WhisperModel,
      language?: string,
    ) => {
      const validated = validateTranscription(audioBuffer, model, language);
      watch(event.sender);
      return desktopProgress.run(
        `${event.sender.id}:transcription:${crypto.randomUUID()}`,
        () =>
          transcribeAudio(
            validated.samples,
            validated.model,
            validated.language,
          ),
      );
    },
  );

  ipcMain.handle(
    RECORDING_CHANNELS.SUMMARIZE_TRANSCRIPT,
    (event, payload: unknown) => {
      const request = summaryRequestSchema.parse(payload);
      watch(event.sender);
      summaries.start(event.sender.id, request, (data) => {
        const key = `${event.sender.id}:summary:${data.requestId}`;
        if (data.status === "generating") desktopProgress.set(key, 2);
        else desktopProgress.clear(key);
        if (!event.sender.isDestroyed())
          event.sender.send(RECORDING_CHANNELS.SUMMARY_EVENT, data);
      });
    },
  );
  ipcMain.handle(
    RECORDING_CHANNELS.CANCEL_SUMMARY,
    (event, payload: unknown) => {
      watch(event.sender);
      const requestId = requestIdSchema.parse(payload);
      summaries.cancel(event.sender.id, requestId);
      desktopProgress.clear(`${event.sender.id}:summary:${requestId}`);
      event.sender.send(RECORDING_CHANNELS.SUMMARY_EVENT, {
        requestId,
        status: "canceled",
      });
    },
  );
  ipcMain.handle(RECORDING_CHANNELS.GET_OLLAMA_STATUS, getOllamaStatus);
}
