import { useCallback, useEffect, useRef, useState } from "react";
import type { SummaryEvent, SummaryRequest } from "@/helpers/summary-contract";
export type SummaryState = { status: "idle" } | SummaryEvent;

export function useSummary() {
  const [state, setState] = useState<SummaryState>({ status: "idle" });
  const active = useRef<string | null>(null);
  useEffect(() => {
    const unsubscribe = window.recording.onSummaryEvent((event) => {
      if (event.requestId !== active.current) return;
      setState(event);
      if (event.status !== "generating") active.current = null;
    });
    return () => {
      unsubscribe();
      const id = active.current;
      active.current = null;
      if (id) void window.recording.cancelSummary(id).catch(() => {});
    };
  }, []);
  const cancel = useCallback(() => {
    const id = active.current;
    active.current = null;
    if (id) {
      setState({ requestId: id, status: "canceled" });
      void window.recording.cancelSummary(id).catch(() => {});
    }
  }, []);
  const reset = useCallback(() => {
    cancel();
    setState({ status: "idle" });
  }, [cancel]);
  const start = useCallback(
    (input: Omit<SummaryRequest, "requestId">) => {
      cancel();
      const requestId = crypto.randomUUID();
      active.current = requestId;
      setState({ requestId, status: "generating", preview: "" });
      void window.recording
        .startSummary({ ...input, requestId })
        .catch((error) => {
          if (active.current !== requestId) return;
          active.current = null;
          setState({
            requestId,
            status: "failed",
            code: "generation",
            detail: String(error),
          });
        });
    },
    [cancel],
  );
  return { state, start, cancel, reset };
}
