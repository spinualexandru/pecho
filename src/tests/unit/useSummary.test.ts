import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useSummary } from "@/hooks/useSummary";
import type { SummaryEvent, SummaryRequest } from "@/helpers/summary-contract";
let emit: (event: SummaryEvent) => void;
const startSummary = vi.fn();
const cancelSummary = vi.fn().mockResolvedValue(undefined);
const unsubscribe = vi.fn();
const input = { transcript: "Meeting", model: "fixture", language: "en" };
beforeEach(() => {
  vi.clearAllMocks();
  startSummary.mockResolvedValue(undefined);
  Object.defineProperty(window, "recording", {
    configurable: true,
    value: {
      startSummary,
      cancelSummary,
      onSummaryEvent: (callback: typeof emit) => {
        emit = callback;
        return unsubscribe;
      },
    },
  });
});
it("rejects stale events and late invocation failures after replacing a request", async () => {
  let reject!: (error: Error) => void;
  startSummary.mockReturnValueOnce(
    new Promise((_resolve, r) => {
      reject = r;
    }),
  );
  const { result } = renderHook(() => useSummary());
  act(() => result.current.start(input));
  const old: SummaryRequest = startSummary.mock.calls[0][0];
  act(() => result.current.start(input));
  const current: SummaryRequest = startSummary.mock.calls[1][0];
  await act(async () => {
    reject(new Error("old failed"));
    emit({
      requestId: old.requestId,
      status: "completed",
      result: { summary: "old", decisions: [], actionItems: [] },
    });
    emit({
      requestId: current.requestId,
      status: "generating",
      preview: "new",
    });
  });
  expect(result.current.state).toMatchObject({
    status: "generating",
    preview: "new",
  });
  act(() => result.current.cancel());
  act(() =>
    emit({
      requestId: current.requestId,
      status: "generating",
      preview: "late",
    }),
  );
  expect(result.current.state.status).toBe("canceled");
});
it("cancels pending work and removes its listener on navigation/unmount", () => {
  const { result, unmount } = renderHook(() => useSummary());
  act(() => result.current.start(input));
  const request: SummaryRequest = startSummary.mock.calls[0][0];
  unmount();
  expect(cancelSummary).toHaveBeenCalledWith(request.requestId);
  expect(unsubscribe).toHaveBeenCalledOnce();
});
