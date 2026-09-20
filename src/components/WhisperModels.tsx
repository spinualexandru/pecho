import { LocalizedError } from "./LocalizedError";
import type { TranslationKey } from "@/localization/i18n";
import { useTranslation } from "react-i18next";
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

const phases: Record<WhisperModelStatus["phase"], TranslationKey | ""> = {
  idle: "",
  checking: "Checking files",
  downloading: "Downloading",
  loading: "Loading model",
  transcribing: "Transcribing",
  deleting: "Deleting cache",
  error: "Action failed",
};

export function WhisperProgress({ model }: { model: WhisperModelStatus }) {
  const { t } = useTranslation();
  const phase = phases[model.phase];
  const phaseLabel = phase ? t(phase) : "";
  const percent = model.progressTotalBytes
    ? Math.min(
        100,
        Math.round((model.loadedBytes / model.progressTotalBytes) * 100),
      )
    : 0;
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm">
        {phaseLabel}
        {model.progressTotalBytes > 0 &&
          ` · ${percent}% · ${formatModelBytes(model.loadedBytes)} / ${formatModelBytes(model.progressTotalBytes)}`}
      </p>
      {(model.phase === "downloading" || model.phase === "loading") && (
        <Progress
          aria-label={t("Progress: {{phase}}", { phase: phaseLabel })}
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

async function runModelAction(
  model: WhisperModel,
  action: "download" | "delete",
  setPending: (model: WhisperModel | null) => void,
  setActionError: (error: string | null) => void,
  setConfirmDelete: (model: WhisperModel | null) => void,
) {
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

export function WhisperModels({
  selectedModel,
}: {
  selectedModel: WhisperModel;
}) {
  const { t } = useTranslation();
  const modelName = (id: WhisperModel) =>
    id === "Xenova/whisper-tiny"
      ? t("Tiny multilingual")
      : WHISPER_MODELS.find((item) => item.id === id)?.name;
  const { models, error } = useWhisperModels();
  const [pending, setPending] = useState<WhisperModel | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WhisperModel | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  function run(model: WhisperModel, action: "download" | "delete") {
    return runModelAction(
      model,
      action,
      setPending,
      setActionError,
      setConfirmDelete,
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t(
          "Download a model before a meeting to transcribe offline. Download sizes include every required file.",
        )}
      </p>
      {(error || actionError) && (
        <LocalizedError
          message={
            actionError
              ? "Model operation failed. Check your connection and available disk space, then retry."
              : "Could not read model cache."
          }
          detail={error || actionError}
        />
      )}
      {!models.length && !error && (
        <p role="status">{t("Checking model cache…")}</p>
      )}
      {models.map((model) => (
        <section
          key={model.id}
          aria-label={t("{{name}} model cache", { name: modelName(model.id) })}
          className="space-y-3 rounded-md border p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {modelName(model.id)}
                {selectedModel === model.id && ` · ${t("Selected")}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("{{size}} total", {
                  size: formatModelBytes(model.totalBytes),
                })}{" "}
                ·{" "}
                {model.cached
                  ? model.phase === "error"
                    ? t("Cached files · See error below")
                    : t("Cached · Offline ready")
                  : model.cachedBytes
                    ? t("Partially downloaded")
                    : t("Not downloaded")}
              </p>
              {!model.cached && (
                <p className="text-sm text-muted-foreground">
                  {t("{{size}} to download", {
                    size: formatModelBytes(model.remainingBytes),
                  })}
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
                  {model.phase === "error" ? t("Retry") : t("Download")}
                </Button>
              )}
              {(model.hasCache || model.phase === "error") && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={model.busy || pending !== null}
                  onClick={() => setConfirmDelete(model.id)}
                >
                  {t("Delete")}
                </Button>
              )}
            </div>
          </div>
          {model.phase !== "idle" && model.phase !== "error" && (
            <WhisperProgress model={model} />
          )}
          {model.error && (
            <LocalizedError
              message="Model operation failed. Check your connection and available disk space, then retry."
              detail={model.error}
            />
          )}
          {confirmDelete === model.id && (
            <div className="space-y-2 text-sm">
              <p>
                {t("Delete this model’s downloaded files?")}{" "}
                {selectedModel === model.id
                  ? t(
                      "It stays selected and will need to be downloaded again before transcription.",
                    )
                  : t("You can download it again later.")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={model.busy || pending !== null}
                  onClick={() => void run(model.id, "delete")}
                >
                  {t("Delete files")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(null)}
                >
                  {t("Cancel")}
                </Button>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
