import {
  type SummaryEvent,
  type SummaryRequest,
} from "@/helpers/summary-contract";
import { MalformedSummaryError, streamSummary } from "./ollama-service";

// A separate namespace per renderer prevents cancellation or event leakage
// between windows. Tombstones cover a cancellation arriving before start.
export class SummaryJobs {
  private owners = new Map<number, Map<string, AbortController>>();
  constructor(private generate = streamSummary) {}
  start(
    owner: number,
    request: SummaryRequest,
    send: (event: SummaryEvent) => void,
  ) {
    const jobs = this.owners.get(owner) ?? new Map<string, AbortController>();
    this.owners.set(owner, jobs);
    const existing = jobs.get(request.requestId);
    if (existing) {
      if (existing.signal.aborted)
        send({ requestId: request.requestId, status: "canceled" });
      return;
    }
    // Keep only a bounded number of completed/canceled IDs, retaining active jobs.
    if (jobs.size >= 128)
      for (const [id, job] of jobs) {
        if (job.signal.aborted) jobs.delete(id);
      }
    if (jobs.size >= 128) throw new Error("Too many summary requests");
    for (const [id, previous] of jobs) {
      if (!previous.signal.aborted) {
        previous.abort();
        try {
          send({ requestId: id, status: "canceled" });
        } catch {
          /* The old renderer may already be gone. */
        }
      }
    }
    const controller = new AbortController();
    jobs.set(request.requestId, controller);
    const emit = (event: SummaryEvent) => {
      if (!controller.signal.aborted) {
        try {
          send(event);
        } catch {
          controller.abort();
        }
      }
    };
    emit({ requestId: request.requestId, status: "generating", preview: "" });
    void this.generate(request, controller.signal, (preview) =>
      emit({ requestId: request.requestId, status: "generating", preview }),
    )
      .then(
        (result) =>
          emit({ requestId: request.requestId, status: "completed", result }),
        (error) =>
          emit({
            requestId: request.requestId,
            status: "failed",
            code:
              error instanceof MalformedSummaryError
                ? "malformed"
                : "generation",
            detail: String(error),
          }),
      )
      .finally(() => controller.abort());
  }
  cancel(owner: number, requestId: string) {
    const jobs = this.owners.get(owner) ?? new Map<string, AbortController>();
    this.owners.set(owner, jobs);
    const job = jobs.get(requestId) ?? new AbortController();
    job.abort();
    if (jobs.size >= 128 && !jobs.has(requestId)) {
      const oldest = [...jobs].find(([, entry]) => entry.signal.aborted);
      if (oldest) jobs.delete(oldest[0]);
    }
    jobs.set(requestId, job);
  }
  dispose(owner: number) {
    for (const job of this.owners.get(owner)?.values() ?? []) job.abort();
    this.owners.delete(owner);
  }
}
