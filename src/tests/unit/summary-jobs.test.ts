// @vitest-environment node
import { expect, it, vi } from "vitest";
import { SummaryJobs } from "@/services/summary-jobs";
const request = {
  requestId: crypto.randomUUID(),
  transcript: "Meeting",
  model: "fixture",
  language: "en",
};
it("isolates renderers, supersedes own jobs, and honors cancel before start", () => {
  const signals: AbortSignal[] = [];
  const generate = vi.fn((_request, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<never>(() => {});
  });
  const jobs = new SummaryJobs(generate);
  jobs.cancel(1, request.requestId);
  const send = vi.fn();
  jobs.start(1, request, send);
  expect(generate).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledWith({
    requestId: request.requestId,
    status: "canceled",
  });
  jobs.start(2, request, send);
  jobs.cancel(1, request.requestId);
  expect(signals[0].aborted).toBe(false);
  jobs.start(2, { ...request, requestId: crypto.randomUUID() }, send);
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  jobs.dispose(2);
  expect(signals[1].aborted).toBe(true);
});
it("suppresses delayed stream events and results after cancellation", async () => {
  let preview!: (value: string) => void;
  let resolve!: (value: {
    summary: string;
    decisions: never[];
    actionItems: never[];
  }) => void;
  const jobs = new SummaryJobs((_request, _signal, callback) => {
    preview = callback;
    return new Promise((r) => {
      resolve = r;
    });
  });
  const send = vi.fn();
  jobs.start(1, request, send);
  jobs.cancel(1, request.requestId);
  preview("stale");
  resolve({ summary: "stale", decisions: [], actionItems: [] });
  await Promise.resolve();
  expect(send).toHaveBeenCalledTimes(1);
});
it("handles delivery failure without unhandled rejection", async () => {
  const jobs = new SummaryJobs(
    vi
      .fn()
      .mockResolvedValue({ summary: "done", decisions: [], actionItems: [] }),
  );
  jobs.start(1, request, () => {
    throw new Error("renderer gone");
  });
  await Promise.resolve();
});
