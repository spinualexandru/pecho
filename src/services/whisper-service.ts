import { pipeline } from "@xenova/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;

export async function initializeWhisper() {
  if (!transcriber) {
    console.log("Loading Whisper model...");
    // Use the base English model for faster performance
    // Other options: "Xenova/whisper-tiny.en", "Xenova/whisper-small.en", "Xenova/whisper-base.en"
    transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
      {
        // Cache models locally
        cache_dir: "./.cache/transformers",
      },
    );
    console.log("Whisper model loaded successfully");
  }
  return transcriber;
}

export async function transcribeAudio(
  audioData: Float32Array,
): Promise<string> {
  try {
    const model = await initializeWhisper();

    const result = await model(audioData, {
      // Options for transcription
      return_timestamps: false,
      language: "english",
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
