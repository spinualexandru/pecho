export type WhisperModel =
  | "Xenova/whisper-tiny.en"
  | "Xenova/whisper-base.en"
  | "Xenova/whisper-small.en";

export interface WhisperModelInfo {
  id: WhisperModel;
  name: string;
  description: string;
  size: string;
}

export const WHISPER_MODELS: WhisperModelInfo[] = [
  {
    id: "Xenova/whisper-tiny.en",
    name: "Tiny",
    description: "Fastest model, lower accuracy",
    size: "~39MB",
  },
  {
    id: "Xenova/whisper-base.en",
    name: "Base",
    description: "Good balance of speed and accuracy",
    size: "~74MB",
  },
  {
    id: "Xenova/whisper-small.en",
    name: "Small",
    description: "Higher accuracy, slower",
    size: "~244MB",
  },
];

const WHISPER_MODEL_KEY = "whisper_model";

export function getWhisperModel(): WhisperModel {
  const saved = localStorage.getItem(WHISPER_MODEL_KEY);
  return (saved as WhisperModel) || "Xenova/whisper-tiny.en";
}

export function setWhisperModel(model: WhisperModel): void {
  localStorage.setItem(WHISPER_MODEL_KEY, model);
}
