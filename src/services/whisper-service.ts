import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
import { app } from "electron";
import path from "node:path";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import {
  WHISPER_MODELS,
  isWhisperModel,
  isModelCompatible,
  type WhisperModel,
  type WhisperModelStatus,
} from "@/helpers/whisper-helpers";
import manifest from "@/helpers/whisper-manifest.json";
import { getWhisperLanguageCode } from "@/helpers/language-helpers";

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let currentModel: WhisperModel | null = null;
let activeModel: WhisperModel | null = null;
const states = new Map<WhisperModel, Partial<WhisperModelStatus>>();

function modelDirectory(model: WhisperModel) {
  return path.join(app.getPath("userData"), "transformers", model);
}

function assertModel(model: string): asserts model is WhisperModel {
  if (!isWhisperModel(model)) throw new Error("Unsupported Whisper model");
}

async function inspectFiles(model: WhisperModel) {
  return Promise.all(
    Object.entries(manifest[model].files).map(async ([file, size]) => {
      try {
        const info = await stat(path.join(modelDirectory(model), file));
        return {
          file,
          size,
          cached: info.isFile() && info.size === size,
          bytes: info.size,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return { file, size, cached: false, bytes: 0 };
      }
    }),
  );
}

export async function getWhisperModels(): Promise<WhisperModelStatus[]> {
  return Promise.all(
    WHISPER_MODELS.map(async ({ id }) => {
      const files = await inspectFiles(id);
      const state = states.get(id);
      const cached = files.every((file) => file.cached);
      return {
        id,
        cached,
        hasCache: await stat(modelDirectory(id)).then(
          () => true,
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return false;
            throw error;
          },
        ),
        cachedBytes: files.reduce((sum, file) => sum + file.bytes, 0),
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        remainingBytes: files
          .filter((file) => !file.cached)
          .reduce((sum, file) => sum + file.size, 0),
        phase: state?.phase ?? "idle",
        loadedBytes: state?.loadedBytes ?? 0,
        progressTotalBytes: state?.progressTotalBytes ?? 0,
        error: state?.error ?? null,
        busy: activeModel !== null,
      };
    }),
  );
}

// The lock covers download, disposal, initialization AND inference. A competing
// mutation fails immediately instead of unexpectedly deleting a newly loaded model.
async function exclusive<T>(
  model: WhisperModel,
  operation: () => Promise<T>,
): Promise<T> {
  assertModel(model);
  if (activeModel)
    throw new Error(
      "A Whisper model is in use. Wait for the current operation to finish.",
    );
  activeModel = model;
  states.set(model, { phase: "checking", error: null });
  try {
    const result = await operation();
    states.set(model, { phase: "idle", error: null });
    return result;
  } catch (error) {
    states.set(model, {
      phase: "error",
      error: error instanceof Error ? error.message : "Model operation failed",
    });
    throw error;
  } finally {
    activeModel = null;
  }
}

async function downloadFiles(model: WhisperModel) {
  const files = await inspectFiles(model);
  const missing = files.filter((file) => !file.cached);
  const total = missing.reduce((sum, file) => sum + file.size, 0);
  let completed = 0;
  for (const { file, size } of missing) {
    const target = path.join(modelDirectory(model), file);
    const temporary = `${target}.download`;
    await mkdir(path.dirname(target), { recursive: true });
    states.set(model, {
      phase: "downloading",
      loadedBytes: completed,
      progressTotalBytes: total,
    });
    // Only immutable revisions are fetched. An interrupted transfer never replaces
    // a usable cache file; retries discard its partial temporary file.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const response = await fetch(
        `https://huggingface.co/${model}/resolve/${manifest[model].revision}/${file}`,
        { signal: controller.signal },
      );
      if (!response.ok || !response.body)
        throw new Error(
          `Could not download ${file} (HTTP ${response.status}). Check your connection and retry.`,
        );
      handle = await open(temporary, "w");
      let loaded = 0;
      for await (const chunk of response.body) {
        loaded += chunk.byteLength;
        if (loaded > size)
          throw new Error(
            `Unexpected download size for ${file}. Delete the cache and retry.`,
          );
        // FileHandle.write may write fewer bytes than requested.
        let offset = 0;
        while (offset < chunk.byteLength) {
          const { bytesWritten } = await handle.write(
            chunk,
            offset,
            chunk.byteLength - offset,
          );
          if (!bytesWritten) throw new Error("Could not write model cache");
          offset += bytesWritten;
        }
        states.set(model, {
          phase: "downloading",
          loadedBytes: completed + loaded,
          progressTotalBytes: total,
        });
      }
      if (loaded !== size)
        throw new Error(
          `Incomplete download for ${file}. Check your connection and retry.`,
        );
      await handle.close();
      handle = undefined;
      await rename(temporary, target);
      completed += size;
    } finally {
      controller.abort();
      clearTimeout(timeout);
      await handle?.close();
      await rm(temporary, { force: true });
    }
  }
}

async function disposeWhisper() {
  const previous = transcriber;
  transcriber = null;
  currentModel = null;
  if (previous) await previous.dispose();
}

async function loadWhisper(modelId: WhisperModel) {
  if (transcriber && currentModel === modelId) return transcriber;
  await downloadFiles(modelId);
  await disposeWhisper();
  const cacheDir = path.join(app.getPath("userData"), "transformers");
  env.cacheDir = cacheDir;
  states.set(modelId, { phase: "loading" });
  // Transformers.js 4.3 pipeline discovery does not forward local_files_only or
  // revision. An absolute local model directory also makes discovery offline.
  transcriber = await pipeline(
    "automatic-speech-recognition",
    modelDirectory(modelId),
    {
      device: "cpu",
      dtype: "q8",
      cache_dir: cacheDir,
      local_files_only: true,
      progress_callback: (progress) => {
        if (progress.status === "progress_total") {
          states.set(modelId, {
            phase: "loading",
            loadedBytes: progress.loaded,
            progressTotalBytes: progress.total,
          });
        }
      },
    },
  );
  currentModel = modelId;
  return transcriber;
}

export async function downloadWhisperModel(modelId: WhisperModel) {
  await exclusive(modelId, async () => {
    await loadWhisper(modelId);
  });
}

export async function deleteWhisperModel(modelId: WhisperModel) {
  await exclusive(modelId, async () => {
    states.set(modelId, { phase: "deleting" });
    if (currentModel === modelId) await disposeWhisper();
    // IDs are allowlisted before constructing paths. Remove partial downloads as
    // well as old auxiliary files; never rely on remote discovery for deletion.
    await rm(modelDirectory(modelId), { recursive: true, force: true });
  });
}

export async function transcribeAudio(
  audioData: Float32Array,
  modelId: WhisperModel = "Xenova/whisper-tiny.en",
  languageCode: string = "en",
): Promise<string> {
  try {
    assertModel(modelId);
    const language = getWhisperLanguageCode(languageCode);
    if (!isModelCompatible(modelId, languageCode))
      throw new Error(
        "This English-only model cannot transcribe the selected language. Select a multilingual model in Settings.",
      );
    return await exclusive(modelId, async () => {
      const model = await loadWhisper(modelId);
      states.set(modelId, { phase: "transcribing" });
      const result = await model(audioData, {
        return_timestamps: false,
        ...(modelId.endsWith(".en") ? {} : { language, task: "transcribe" }),
      });
      return Array.isArray(result)
        ? result.map((item) => item.text).join(" ")
        : result.text;
    });
  } catch (error) {
    throw new Error(
      `Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export function audioBufferToFloat32Array(
  audioBuffer: AudioBuffer,
): Float32Array {
  return audioBuffer.getChannelData(0);
}
