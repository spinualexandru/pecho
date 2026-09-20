export const RECORDING_CHANNELS = {
  GET_WHISPER_MODELS: "recording:get-whisper-models",
  DOWNLOAD_WHISPER_MODEL: "recording:download-whisper-model",
  DELETE_WHISPER_MODEL: "recording:delete-whisper-model",
  TRANSCRIBE_AUDIO: "recording:transcribe-audio",
  SUMMARIZE_TRANSCRIPT: "recording:summarize-transcript",
  GET_OLLAMA_STATUS: "recording:get-ollama-status",
  CANCEL_SUMMARY: "recording:cancel-summary",
  SUMMARY_EVENT: "recording:summary-event",
} as const;
