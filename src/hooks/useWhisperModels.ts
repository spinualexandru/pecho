import { useEffect, useState } from "react";
import type { WhisperModelStatus } from "@/helpers/whisper-helpers";

// A poll owns its timer until cancellation, including rejected IPC requests.
function pollWhisperModels(
  setModels: (models: WhisperModelStatus[]) => void,
  setError: (error: string | null) => void,
) {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const refresh = async () => {
    try {
      const result = await window.recording.getWhisperModels();
      if (!cancelled) {
        setModels(result);
        setError(null);
      }
    } catch (reason) {
      if (!cancelled)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not read model cache",
        );
    } finally {
      if (!cancelled) timer = setTimeout(scheduleRefresh, 500);
    }
  };
  function scheduleRefresh() {
    refresh().catch((reason) => {
      if (!cancelled) setError(String(reason));
    });
  }
  scheduleRefresh();
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

// Polling keeps progress observable after navigation and avoids renderer-owned
// downloads or subscriptions that disappear when the settings page unmounts.
export function useWhisperModels() {
  const [models, setModels] = useState<WhisperModelStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => pollWhisperModels(setModels, setError), []);
  return { models, error };
}
