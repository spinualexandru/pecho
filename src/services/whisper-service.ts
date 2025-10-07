import { pipeline } from "@xenova/transformers";
import { getWhisperModel, type WhisperModel } from "@/helpers/whisper-helpers";
import {
  getTranscriberLanguage,
  getWhisperLanguageCode,
} from "@/helpers/language-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;
let currentModel: WhisperModel | null = null;

export async function initializeWhisper() {
  const modelId = getWhisperModel();

  // Reinitialize if model changed
  if (!transcriber || currentModel !== modelId) {
    console.log(`Loading Whisper model: ${modelId}...`);
    transcriber = await pipeline("automatic-speech-recognition", modelId, {
      // Cache models locally
      cache_dir: "./.cache/transformers",
    });
    currentModel = modelId;
    console.log("Whisper model loaded successfully");
  }
  return transcriber;
}

export async function transcribeAudio(
  audioData: Float32Array,
): Promise<string> {
  try {
    const model = await initializeWhisper();
    const language = getWhisperLanguageCode(getTranscriberLanguage());

    const result = await model(audioData, {
      // Options for transcription
      return_timestamps: false,
      language: language,
    });

    return result.text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error(
      `Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Helper to convert audio buffer to Float32Array
export function audioBufferToFloat32Array(
  audioBuffer: AudioBuffer,
): Float32Array {
  // Get the first channel (mono)
  const channelData = audioBuffer.getChannelData(0);
  return channelData;
}
