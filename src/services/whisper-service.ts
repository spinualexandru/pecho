import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
import { app } from "electron";
import path from "node:path";
import type { WhisperModel } from "@/helpers/whisper-helpers";
import { getWhisperLanguageCode } from "@/helpers/language-helpers";

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let currentModel: WhisperModel | null = null;

export async function initializeWhisper(
  modelId: WhisperModel = "Xenova/whisper-tiny.en",
) {
  // Some auxiliary model files use the global cache rather than pipeline options.
  const cacheDir = path.join(app.getPath("userData"), "transformers");
  env.cacheDir = cacheDir;
  // Reinitialize if model changed
  if (!transcriber || currentModel !== modelId) {
    console.log(`Loading Whisper model: ${modelId}...`);
    if (transcriber) {
      await transcriber.dispose();
      transcriber = null;
      currentModel = null;
    }
    transcriber = await pipeline("automatic-speech-recognition", modelId, {
      device: "cpu",
      dtype: "q8",
      // Packaged apps may run from a read-only installation directory.
      cache_dir: cacheDir,
    });
    currentModel = modelId;
    console.log("Whisper model loaded successfully");
  }
  return transcriber;
}

export async function transcribeAudio(
  audioData: Float32Array,
  modelId: WhisperModel = "Xenova/whisper-tiny.en",
  languageCode: string = "en",
): Promise<string> {
  try {
    const model = await initializeWhisper(modelId);

    const result = await model(audioData, {
      // Options for transcription
      return_timestamps: false,
      // English-only checkpoints do not accept multilingual language tokens.
      ...(modelId.endsWith(".en")
        ? {}
        : { language: getWhisperLanguageCode(languageCode) }),
    });

    return Array.isArray(result)
      ? result.map((item) => item.text).join(" ")
      : result.text;
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
