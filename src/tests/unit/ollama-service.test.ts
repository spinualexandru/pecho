// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import {
  getOllamaStatus,
  streamSummary,
  summaryPreview,
  MalformedSummaryError,
} from "@/services/ollama-service";
import {
  summaryRequestSchema,
  validateTranscription,
} from "@/helpers/summary-contract";
const request = {
  requestId: crypto.randomUUID(),
  transcript: "Ship Friday",
  model: "fixture",
  language: "ro",
};
const result = {
  summary: "Hotărâre 🚀",
  decisions: ["Ship Friday"],
  actionItems: [{ task: "Ship", owner: null, dueDate: "Friday" }],
};
const wire = (content: string, done = true) =>
  JSON.stringify({ message: { content }, done });
function respond(body: string, split = false) {
  const bytes = new TextEncoder().encode(body);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            if (split)
              for (const byte of bytes)
                controller.enqueue(new Uint8Array([byte]));
            else controller.enqueue(bytes);
            controller.close();
          },
        }),
      ),
    ),
  );
}
afterEach(() => vi.unstubAllGlobals());
it("decodes split UTF8, NDJSON records, trailing record, schema and language request", async () => {
  const content = JSON.stringify(result);
  respond(
    wire(content.slice(0, 20), false) + "\n" + wire(content.slice(20)),
    true,
  );
  const preview = vi.fn();
  await expect(
    streamSummary(request, new AbortController().signal, preview),
  ).resolves.toEqual(result);
  expect(preview).toHaveBeenLastCalledWith(result.summary);
  const options = vi.mocked(fetch).mock.calls[0][1]!;
  const body = JSON.parse(options.body as string);
  expect(body.format.required).toEqual(["summary", "decisions", "actionItems"]);
  expect(body.messages[0].content).toContain("Romanian");
});
it.each([
  "{",
  JSON.stringify({ summary: "Only summary" }),
  JSON.stringify({ ...result, decisions: "wrong" }),
])("rejects malformed completed results %s", async (content) => {
  respond(wire(content));
  await expect(
    streamSummary(request, new AbortController().signal, vi.fn()),
  ).rejects.toBeInstanceOf(MalformedSummaryError);
});
it("rejects valid-looking JSON without an explicit done record", async () => {
  respond(wire(JSON.stringify(result), false));
  await expect(
    streamSummary(request, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("before completion");
});
it("surfaces server error records", async () => {
  respond('{"error":"model unloaded"}\n');
  await expect(
    streamSummary(request, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("model unloaded");
});
it("cancels before headers arrive through the request signal", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, { signal }: RequestInit) =>
        new Promise((_resolve, reject) =>
          signal!.addEventListener("abort", () => reject(signal!.reason)),
        ),
    ),
  );
  const controller = new AbortController();
  const task = streamSummary(request, controller.signal, vi.fn());
  controller.abort();
  await expect(task).rejects.toMatchObject({ name: "AbortError" });
});
it("reads server version and an empty model list independently of GPU", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ version: "0.6.3" }))
      .mockResolvedValueOnce(Response.json({ models: [] })),
  );
  await expect(getOllamaStatus()).resolves.toEqual({
    version: "0.6.3",
    models: [],
  });
});
it("does not expose JSON syntax in partial escaped summaries", () => {
  expect(summaryPreview('{"summary":"A\\nB\\u0103\\')).toBe("A\nBă");
  expect(summaryPreview('{"decisions":[')).toBe("");
});
it("validates renderer requests before starting services", () => {
  expect(
    summaryRequestSchema.safeParse({ ...request, transcript: " " }).success,
  ).toBe(false);
  expect(
    summaryRequestSchema.safeParse({ ...request, language: "bad" }).success,
  ).toBe(false);
  expect(
    summaryRequestSchema.safeParse({ ...request, requestId: "guess" }).success,
  ).toBe(false);
  expect(() => validateTranscription(new ArrayBuffer(3))).toThrow(
    "Invalid audio",
  );
  expect(() => validateTranscription(new Float32Array([NaN]).buffer)).toThrow(
    "Invalid PCM",
  );
  expect(() =>
    validateTranscription(
      new Float32Array([0]).buffer,
      "Xenova/whisper-tiny.en",
      "ro",
    ),
  ).toThrow("Invalid transcription");
  expect(
    validateTranscription(new Float32Array([1.2]).buffer).samples[0],
  ).toBeCloseTo(1.2);
});
