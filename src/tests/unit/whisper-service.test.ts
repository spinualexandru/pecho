// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import manifest from "@/helpers/whisper-manifest.json";

const mocks = vi.hoisted(() => {
  const dispose = vi.fn().mockResolvedValue(undefined);
  const transcriber = Object.assign(vi.fn(), { dispose });
  return {
    pipeline: vi.fn().mockResolvedValue(transcriber),
    transcriber,
    dispose,
    profile: "",
  };
});
vi.mock("@huggingface/transformers", () => ({
  pipeline: mocks.pipeline,
  env: {},
}));
vi.mock("electron", () => ({ app: { getPath: () => mocks.profile } }));
const tiny = "Xenova/whisper-tiny.en";
const base = "Xenova/whisper-base.en";
async function seed(
  model: typeof tiny | typeof base | "Xenova/whisper-tiny" = tiny,
) {
  for (const [file, size] of Object.entries(manifest[model].files)) {
    const target = path.join(mocks.profile, "transformers", model, file);
    await mkdir(path.dirname(target), { recursive: true });
    const handle = await open(target, "w");
    await handle.truncate(size);
    await handle.close();
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.profile = await mkdtemp(path.join(os.tmpdir(), "pecho-models-"));
  mocks.transcriber.mockResolvedValue({ text: "Meeting notes" });
  mocks.pipeline.mockResolvedValue(mocks.transcriber);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(mocks.profile, { recursive: true, force: true });
});

describe("Whisper model lifecycle", () => {
  it("rejects unsupported language/model combinations before loading and explicitly transcribes multilingual audio", async () => {
    const service = await import("@/services/whisper-service");
    await expect(
      service.transcribeAudio(new Float32Array(16000), tiny, "ro"),
    ).rejects.toThrow("English-only");
    await expect(
      service.transcribeAudio(new Float32Array(16000), tiny, "xx"),
    ).rejects.toThrow("Unsupported transcription language");
    expect(mocks.pipeline).not.toHaveBeenCalled();
    await seed("Xenova/whisper-tiny");
    await service.transcribeAudio(
      new Float32Array(16000),
      "Xenova/whisper-tiny",
      "ro",
    );
    expect(mocks.transcriber).toHaveBeenCalledWith(expect.any(Float32Array), {
      return_timestamps: false,
      language: "romanian",
      task: "transcribe",
    });
  });

  it("detects an existing cache after restart and loads locally without any network", async () => {
    await seed();
    const fetch = vi.fn(() => {
      throw new Error("Network forbidden");
    });
    vi.stubGlobal("fetch", fetch);
    const service = await import("@/services/whisper-service");
    expect((await service.getWhisperModels())[0]).toMatchObject({
      cached: true,
      remainingBytes: 0,
    });
    await expect(
      service.transcribeAudio(new Float32Array(16000)),
    ).resolves.toBe("Meeting notes");
    expect(mocks.pipeline).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      path.join(mocks.profile, "transformers", tiny),
      expect.objectContaining({
        device: "cpu",
        dtype: "q8",
        local_files_only: true,
      }),
    );
    expect(fetch).not.toHaveBeenCalled();
    await service.transcribeAudio(new Float32Array(16000));
    expect(mocks.pipeline).toHaveBeenCalledTimes(1);
  });

  it("protects active inference from deletion, concurrent inference and model switching", async () => {
    await seed();
    await seed(base);
    const waiting = deferred<{ text: string }>();
    mocks.transcriber.mockReturnValueOnce(waiting.promise);
    const service = await import("@/services/whisper-service");
    const inference = service.transcribeAudio(new Float32Array(16000));
    await vi.waitFor(() => expect(mocks.transcriber).toHaveBeenCalled());
    await expect(service.deleteWhisperModel(tiny)).rejects.toThrow("in use");
    await expect(service.downloadWhisperModel(base)).rejects.toThrow("in use");
    await expect(
      service.transcribeAudio(new Float32Array(16000)),
    ).rejects.toThrow("in use");
    expect(mocks.dispose).not.toHaveBeenCalled();
    waiting.resolve({ text: "Done" });
    await inference;
    await service.deleteWhisperModel(tiny);
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect((await service.getWhisperModels())[0]).toMatchObject({
      cached: false,
      busy: false,
      phase: "idle",
    });
  });

  it("cleans partial failures, keeps completed files, and retries with aggregate byte progress", async () => {
    await seed();
    const target = path.join(
      mocks.profile,
      "transformers",
      tiny,
      "config.json",
    );
    await writeFile(target, "broken");
    const service = await import("@/services/whisper-service");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("incomplete")),
    );
    await expect(service.downloadWhisperModel(tiny)).rejects.toThrow(
      "Incomplete download",
    );
    await expect(stat(`${target}.download`)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect((await service.getWhisperModels())[0]).toMatchObject({
      cached: false,
      phase: "error",
      busy: false,
      remainingBytes: 2202,
    });
    const fetched = deferred<Response>();
    const fetch = vi.fn().mockReturnValue(fetched.promise);
    vi.stubGlobal("fetch", fetch);
    const retry = service.downloadWhisperModel(tiny);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect((await service.getWhisperModels())[0]).toMatchObject({
      phase: "downloading",
      progressTotalBytes: 2202,
      busy: true,
    });
    fetched.resolve(new Response(new Uint8Array(2202)));
    await retry;
    expect(fetch.mock.calls[0][0]).toContain(manifest[tiny].revision);
    expect((await service.getWhisperModels())[0]).toMatchObject({
      cached: true,
      phase: "idle",
      error: null,
      busy: false,
    });
  });

  it("rejects path traversal and clears failed initialization so it can retry", async () => {
    await seed();
    const service = await import("@/services/whisper-service");
    await expect(
      service.deleteWhisperModel("../escape" as typeof tiny),
    ).rejects.toThrow("Unsupported");
    mocks.pipeline.mockRejectedValueOnce(new Error("Initialization failed"));
    await expect(service.downloadWhisperModel(tiny)).rejects.toThrow(
      "Initialization failed",
    );
    await service.downloadWhisperModel(tiny);
    expect(mocks.pipeline).toHaveBeenCalledTimes(2);
    expect((await service.getWhisperModels())[0]).toMatchObject({
      phase: "idle",
      error: null,
    });
  });

  it("disposes an old model only after its replacement has downloaded", async () => {
    await seed();
    const service = await import("@/services/whisper-service");
    await service.downloadWhisperModel(tiny);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    await expect(service.downloadWhisperModel(base)).rejects.toThrow("Offline");
    expect(mocks.dispose).not.toHaveBeenCalled();
    await service.transcribeAudio(new Float32Array(16000));
    expect(mocks.pipeline).toHaveBeenCalledTimes(1);
  });
  it("never reuses a partially disposed model after deletion fails", async () => {
    await seed();
    const service = await import("@/services/whisper-service");
    await service.downloadWhisperModel(tiny);
    mocks.dispose.mockRejectedValueOnce(new Error("Disposal failed"));
    await expect(service.deleteWhisperModel(tiny)).rejects.toThrow(
      "Disposal failed",
    );
    await service.transcribeAudio(new Float32Array(16000));
    expect(mocks.pipeline).toHaveBeenCalledTimes(2);
  });
});
