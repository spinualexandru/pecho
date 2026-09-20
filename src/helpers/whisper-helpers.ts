import { getTranscriberLanguage, isSpeechLanguage } from "./language-helpers";
export type WhisperModel =
  | "Xenova/whisper-tiny.en"
  | "Xenova/whisper-base.en"
  | "Xenova/whisper-small.en"
  | "Xenova/whisper-tiny";

export interface WhisperModelInfo {
  id: WhisperModel;
  name: string;
  description:
    | "Fastest model, lower accuracy"
    | "Good balance of speed and accuracy"
    | "Higher accuracy, slower";
}

export const WHISPER_MODELS: WhisperModelInfo[] = [
  {
    id: "Xenova/whisper-tiny.en",
    name: "Tiny",
    description: "Fastest model, lower accuracy",
  },
  {
    id: "Xenova/whisper-base.en",
    name: "Base",
    description: "Good balance of speed and accuracy",
  },
  {
    id: "Xenova/whisper-small.en",
    name: "Small",
    description: "Higher accuracy, slower",
  },
  {
    id: "Xenova/whisper-tiny",
    name: "Tiny multilingual",
    description: "Fastest model, lower accuracy",
  },
];

const WHISPER_MODEL_KEY = "whisper_model";

export function getWhisperModel(): WhisperModel {
  const saved = localStorage.getItem(WHISPER_MODEL_KEY);
  const model = isWhisperModel(saved) ? saved : "Xenova/whisper-tiny.en";
  // Migrate an older non-English preference without ever feeding it to .en.
  const compatible = isModelCompatible(model, getTranscriberLanguage())
    ? model
    : "Xenova/whisper-tiny";
  if (saved !== compatible) localStorage.setItem(WHISPER_MODEL_KEY, compatible);
  return compatible;
}

export function setWhisperModel(model: WhisperModel): void {
  if (
    !isWhisperModel(model) ||
    !isModelCompatible(model, getTranscriberLanguage())
  )
    throw new Error("Unsupported model and transcription language combination");
  localStorage.setItem(WHISPER_MODEL_KEY, model);
}

export function isWhisperModel(model: unknown): model is WhisperModel {
  return WHISPER_MODELS.some(({ id }) => id === model);
}

export interface WhisperModelStatus {
  id: WhisperModel;
  cached: boolean;
  hasCache: boolean;
  cachedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  phase:
    | "idle"
    | "checking"
    | "downloading"
    | "loading"
    | "transcribing"
    | "deleting"
    | "error";
  loadedBytes: number;
  progressTotalBytes: number;
  error: string | null;
  busy: boolean;
}

export function formatModelBytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function isModelCompatible(
  model: WhisperModel,
  language: string,
): boolean {
  return (
    isSpeechLanguage(language) && (language === "en" || !model.endsWith(".en"))
  );
}
