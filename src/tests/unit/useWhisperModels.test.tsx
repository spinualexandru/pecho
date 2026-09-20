import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWhisperModels } from "@/hooks/useWhisperModels";
import type { WhisperModelStatus } from "@/helpers/whisper-helpers";

afterEach(() => vi.useRealTimers());
it("recovers from a rejected cache poll and stops polling after unmount", async () => {
  vi.useFakeTimers();
  const getWhisperModels = vi
    .fn<() => Promise<WhisperModelStatus[]>>()
    .mockRejectedValueOnce(new Error("cache unavailable"))
    .mockResolvedValue([]);
  window.recording = { getWhisperModels } as unknown as RecordingContext;
  const { result, unmount } = renderHook(useWhisperModels);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(result.current.error).toBe("cache unavailable");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(result.current.error).toBeNull();
  expect(getWhisperModels).toHaveBeenCalledTimes(2);
  unmount();
  await vi.advanceTimersByTimeAsync(1000);
  expect(getWhisperModels).toHaveBeenCalledTimes(2);
});
it("does not reschedule an in-flight rejected poll after unmount", async () => {
  vi.useFakeTimers();
  let reject!: (reason: Error) => void;
  const getWhisperModels = vi.fn(
    () =>
      new Promise<WhisperModelStatus[]>((_, fail) => {
        reject = fail;
      }),
  );
  window.recording = { getWhisperModels } as unknown as RecordingContext;
  const { unmount } = renderHook(useWhisperModels);
  unmount();
  await act(async () => {
    reject(new Error("late IPC rejection"));
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(getWhisperModels).toHaveBeenCalledOnce();
});
