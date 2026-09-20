// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

const { pipeline, transcriber, dispose } = vi.hoisted(() => {
  const dispose = vi.fn().mockResolvedValue(undefined);
  const transcriber = Object.assign(vi.fn(), { dispose });
  return {
    pipeline: vi.fn().mockResolvedValue(transcriber),
    transcriber,
    dispose,
  };
});

vi.mock("@huggingface/transformers", () => ({ pipeline, env: {} }));
vi.mock("electron", () => ({ app: { getPath: () => "/tmp/pecho-test" } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  transcriber.mockResolvedValue({ text: "Meeting notes" });
});

describe("Whisper migration", () => {
  it("loads quantized CPU models into the writable user cache without browser storage", async () => {
    const { transcribeAudio } = await import("@/services/whisper-service");
    const audio = new Float32Array(16000);
    await expect(transcribeAudio(audio)).resolves.toBe("Meeting notes");
    const { env } = await import("@huggingface/transformers");
    expect(env.cacheDir).toBe(path.join("/tmp/pecho-test", "transformers"));
    expect(pipeline).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
      {
        device: "cpu",
        dtype: "q8",
        cache_dir: path.join("/tmp/pecho-test", "transformers"),
      },
    );
    expect(transcriber).toHaveBeenCalledWith(audio, {
      return_timestamps: false,
    });
  });

  it("reuses the loaded model and disposes it when the selection changes", async () => {
    const { transcribeAudio } = await import("@/services/whisper-service");
    const audio = new Float32Array(16000);
    await transcribeAudio(audio);
    await transcribeAudio(audio);
    expect(pipeline).toHaveBeenCalledTimes(1);
    await transcribeAudio(audio, "Xenova/whisper-base.en");
    expect(dispose).toHaveBeenCalledOnce();
    expect(pipeline).toHaveBeenLastCalledWith(
      "automatic-speech-recognition",
      "Xenova/whisper-base.en",
      expect.any(Object),
    );
  });

  it("wraps inference failures with a useful message", async () => {
    const { transcribeAudio } = await import("@/services/whisper-service");
    transcriber.mockRejectedValueOnce(new Error("Model unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(transcribeAudio(new Float32Array(16000))).rejects.toThrow(
      "Failed to transcribe audio: Model unavailable",
    );
    vi.restoreAllMocks();
  });
});
