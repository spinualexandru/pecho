import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWhisperModels } from "@/hooks/useWhisperModels";
import {
  WHISPER_MODELS,
  formatModelBytes,
  type WhisperModel,
  type WhisperModelStatus,
} from "@/helpers/whisper-helpers";

const phases: Record<WhisperModelStatus["phase"], string> = {
  idle: "",
  checking: "Checking files",
  downloading: "Downloading",
  loading: "Loading model",
  transcribing: "Transcribing",
  deleting: "Deleting cache",
  error: "Action failed",
};

export function WhisperProgress({ model }: { model: WhisperModelStatus }) {
  const percent = model.progressTotalBytes
    ? Math.min(
        100,
        Math.round((model.loadedBytes / model.progressTotalBytes) * 100),
      )
    : 0;
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm">
        {phases[model.phase]}
        {model.progressTotalBytes > 0 &&
          ` · ${percent}% · ${formatModelBytes(model.loadedBytes)} / ${formatModelBytes(model.progressTotalBytes)}`}
      </p>
      {(model.phase === "downloading" || model.phase === "loading") && (
        <Progress
          aria-label={`${phases[model.phase]} progress`}
          value={percent}
        />
      )}
    </div>
  );
}

export function ActiveWhisperProgress() {
  const { models } = useWhisperModels();
  const active = models.find(
    (model) => model.phase !== "idle" && model.phase !== "error",
  );
  return active ? <WhisperProgress model={active} /> : null;
}

export function WhisperModels({
  selectedModel,
}: {
  selectedModel: WhisperModel;
}) {
  const { models, error } = useWhisperModels();
  const [pending, setPending] = useState<WhisperModel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WhisperModel | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  async function run(model: WhisperModel, action: "download" | "delete") {
    setPending(model);
    setActionError(null);
    setConfirmDelete(null);
    try {
      if (action === "download")
        await window.recording.downloadWhisperModel(model);
      else await window.recording.deleteWhisperModel(model);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Model operation failed",
      );
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Download a model before a meeting to transcribe offline. Download sizes
        include every required file.
      </p>
      {(error || actionError) && (
        <p role="alert" className="text-sm text-destructive">
          {error || actionError}
        </p>
      )}
      {!models.length && !error && <p role="status">Checking model cache…</p>}
      {models.map((model) => (
        <section
          key={model.id}
          aria-label={`${WHISPER_MODELS.find((item) => item.id === model.id)?.name} model cache`}
          className="space-y-3 rounded-md border p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {WHISPER_MODELS.find((item) => item.id === model.id)?.name}
                {selectedModel === model.id && " · Selected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatModelBytes(model.totalBytes)} total ·{" "}
                {model.cached
                  ? model.phase === "error"
                    ? "Cached files · See error below"
                    : "Cached · Offline ready"
                  : model.cachedBytes
                    ? "Partially downloaded"
                    : "Not downloaded"}
              </p>
              {!model.cached && (
                <p className="text-sm text-muted-foreground">
                  {formatModelBytes(model.remainingBytes)} to download
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {(!model.cached || model.phase === "error") && (
                <Button
                  size="sm"
                  disabled={model.busy || pending !== null}
                  onClick={() => void run(model.id, "download")}
                >
                  {model.phase === "error" ? "Retry" : "Download"}
                </Button>
              )}
              {(model.hasCache || model.phase === "error") && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={model.busy || pending !== null}
                  onClick={() => setConfirmDelete(model.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
          {model.phase !== "idle" && model.phase !== "error" && (
            <WhisperProgress model={model} />
          )}
          {model.error && (
            <p className="text-sm text-destructive">{model.error}</p>
          )}
          {confirmDelete === model.id && (
            <div className="space-y-2 text-sm">
              <p>
                Delete this model’s downloaded files?{" "}
                {selectedModel === model.id
                  ? "It stays selected and will need to be downloaded again before transcription."
                  : "You can download it again later."}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={model.busy || pending !== null}
                  onClick={() => void run(model.id, "delete")}
                >
                  Delete files
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
