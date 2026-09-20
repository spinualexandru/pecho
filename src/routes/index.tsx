import { LocalizedError } from "@/components/LocalizedError";
import { ActiveWhisperProgress } from "@/components/WhisperModels";
import React from "react";
import { useTranslation } from "react-i18next";
import Footer from "@/components/template/Footer";
import InitialIcons from "@/components/template/InitialIcons";
import { createFileRoute } from "@tanstack/react-router";
import {
  Mic,
  Square,
  Pause,
  Play,
  Sparkles,
  AlertCircle,
  FileText,
  Download,
} from "lucide-react";
import { useMeeting } from "@/providers/MeetingProvider";
import { useModelSelection } from "@/hooks/useModelSelection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MeetingSummary } from "@/components/MeetingSummary";
import { getSummaryLanguage } from "@/helpers/language-helpers";

function HomePage() {
  const { t } = useTranslation();
  const {
    recording,
    summary: summaryJob,
    manualInput,
    setManualInput,
    useManualMode,
    setUseManualMode,
  } = useMeeting();
  const {
    isStarting,
    hasSystemAudio,
    isRecording,
    isPaused,
    transcript,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    setTranscript,
    error,
    isTranscribing,
  } = recording;

  const {
    selectedModel,
    availableModels,
    gpuVRAM,
    isLoading: isLoadingModels,
    selectModel,
    error: modelError,
    version,
    refreshModels,
  } = useModelSelection();

  const {
    state: summaryState,
    start: startSummary,
    cancel: cancelSummary,
    reset: resetSummary,
  } = summaryJob;
  const isProcessing = summaryState.status === "generating";
  const summary =
    summaryState.status === "completed" ? summaryState.result : null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = () => {
    if (isStarting || isTranscribing || isRecording) return;
    resetSummary();
    setUseManualMode(false);
    startRecording().catch((error) =>
      console.error("Unexpected recording failure", error),
    );
  };

  const handleStopRecording = () => {
    stopRecording();
    // Transcription happens automatically in useRecording.
  };

  const handleManualInput = () => {
    if (isStarting || isTranscribing || isRecording) return;
    resetSummary();
    setTranscript("");
    setManualInput("");
    setUseManualMode(true);
  };

  const handleProcessManualInput = () => {
    if (!manualInput.trim() || !selectedModel) return;
    setTranscript(manualInput);
    setUseManualMode(false);
    startSummary({
      transcript: manualInput,
      model: selectedModel,
      language: getSummaryLanguage(),
    });
  };
  const handleGenerateSummary = () => {
    if (transcript.trim() && selectedModel)
      startSummary({
        transcript,
        model: selectedModel,
        language: getSummaryLanguage(),
      });
  };

  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `meeting-summary-${timestamp}.md`;

    let content = `# ${t("Meeting Summary")}\n\n`;
    content += `**${t("Date")}:** ${new Date().toLocaleString()}\n`;
    content += `**${t("Duration")}:** ${formatDuration(duration)}\n\n`;

    content += `## ${t("Transcript")}\n\n`;
    content += transcript + "\n\n";

    if (summary) {
      content += `## ${t("AI Summary")}\n\n`;
      content += summary.summary + "\n\n";
      content += `### ${t("Decisions")}\n\n${summary.decisions.map((text) => `- ${text}`).join("\n")}\n\n`;
      content += `### ${t("Action items")}\n\n${summary.actionItems.map((item) => `- ${item.task} (${t("Owner")}: ${item.owner || t("Not specified")}; ${t("Due date")}: ${item.dueDate || t("Not specified")})`).join("\n")}\n\n`;
    }

    content += "---\n";
    content += `*${t("Generated with Personal Echo")}*\n`;

    // Create blob and download
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Check if model size is close to GPU VRAM (80-100% of VRAM)
  const isModelCloseToVRAM = (modelSize: number): boolean => {
    if (!gpuVRAM) return false;
    const vramUsagePercent = (modelSize / gpuVRAM) * 100;
    return vramUsagePercent >= 80 && vramUsagePercent <= 100;
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center gap-6 p-6">
        <div className="flex w-full max-w-4xl flex-col items-center gap-2">
          <div className="flex flex-col items-center gap-2">
            <label className="text-sm text-muted-foreground">
              {t("Ollama Model")}
            </label>
            <Select
              value={selectedModel || ""}
              onValueChange={selectModel}
              disabled={
                isProcessing || isLoadingModels || availableModels.length === 0
              }
              dir="ltr"
            >
              <SelectTrigger className="w-64">
                <SelectValue
                  placeholder={
                    isLoadingModels
                      ? t("Loading models...")
                      : availableModels.length === 0
                        ? t("No models available")
                        : t("Select a model")
                  }
                />
              </SelectTrigger>
              <SelectContent position="item-aligned">
                {availableModels.map((model) => {
                  const isCloseToVRAM = isModelCloseToVRAM(model.size);
                  return (
                    <SelectItem
                      key={model.name}
                      value={model.name}
                      className={isCloseToVRAM ? "bg-yellow-500/20" : undefined}
                    >
                      {isCloseToVRAM && "⚠ "}
                      {model.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshModels()}
            disabled={isLoadingModels}
          >
            {t("Refresh models")}
          </Button>
          {version && (
            <p className="text-xs text-muted-foreground">
              {t("Ollama connected", { version })}
            </p>
          )}
          {modelError && (
            <LocalizedError
              message="Could not load Ollama models. Check that Ollama is running."
              detail={modelError}
            />
          )}
          {!isLoadingModels && !modelError && availableModels.length === 0 && (
            <p role="status">
              {t(
                "Ollama has no models. Install a model in Ollama, then refresh.",
              )}
            </p>
          )}
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <LocalizedError message={error.message} detail={error.detail} />
          </div>
        )}
        {!isRecording && !isTranscribing && !transcript && !useManualMode && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <InitialIcons />
            <span>
              <h1 className="font-mono text-4xl font-bold">{t("appName")}</h1>
              <p
                className="text-end text-sm text-muted-foreground uppercase"
                data-testid="pageTitle"
              >
                {t("titleSlogan")}
              </p>
            </span>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex gap-4">
                <Button
                  size="lg"
                  onClick={handleStartRecording}
                  disabled={isProcessing || isStarting || isTranscribing}
                >
                  <Mic className="mr-2 h-5 w-5" />
                  {t(isStarting ? "Starting recording..." : "Voice Recording")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleManualInput}
                  disabled={isProcessing || isStarting || isTranscribing}
                >
                  <FileText className="mr-2 h-5 w-5" />
                  {t("Manual Input")}
                </Button>
              </div>
              {!modelError && (
                <p className="max-w-md text-center text-xs text-muted-foreground">
                  {t(
                    "Voice recording captures both your microphone and system audio (meeting participants)",
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {useManualMode && !transcript && (
          <div className="meeting-phase w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("Manual Transcript Input")}
                </CardTitle>
                <CardDescription>
                  {t("Type or paste your meeting transcript below")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  autoFocus
                  aria-label={t("Manual Transcript Input")}
                  placeholder={t("Enter your meeting transcript here...")}
                  className="min-h-[300px] resize-y"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setUseManualMode(false)}
                  >
                    {t("Cancel")}
                  </Button>
                  <Button
                    onClick={handleProcessManualInput}
                    disabled={
                      !manualInput.trim() || isProcessing || !selectedModel
                    }
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("Generate Summary")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isRecording && (
          <div className="meeting-phase w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
                      {t("Recording in Progress")}
                    </CardTitle>
                    <CardDescription>
                      {formatDuration(duration)} •{" "}
                      {t(
                        hasSystemAudio
                          ? "Capturing microphone + system audio"
                          : "Capturing microphone only",
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!isPaused ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={pauseRecording}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        {t("Pause")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resumeRecording}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {t("Resume")}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleStopRecording}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      {t("Stop")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full rounded-md border p-4">
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {t("Recording audio... Stop to transcribe.")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isTranscribing && (
          <div className="meeting-phase w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  {t("Transcribing Audio...")}
                </CardTitle>
                <CardDescription>
                  {t("Preparing the model and transcribing locally")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActiveWhisperProgress />
              </CardContent>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!isRecording && !isTranscribing && transcript && (
          <div className="meeting-phase w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t("Transcript")}</CardTitle>
                    <CardDescription>
                      {t("Recorded {{duration}}", {
                        duration: formatDuration(duration),
                      })}
                    </CardDescription>
                  </div>
                  {!summary && !isProcessing && (
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={!selectedModel}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t("Generate Summary")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full rounded-md border p-4">
                  <p className="text-sm whitespace-pre-wrap">{transcript}</p>
                </div>
              </CardContent>
            </Card>

            {isProcessing && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    {t("Generating Summary...")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t("Draft summary. Waiting for a validated result.")}
                  </p>
                  <p
                    data-testid="summary-preview"
                    className="mb-4 whitespace-pre-wrap"
                  >
                    {summaryState.status === "generating"
                      ? summaryState.preview
                      : ""}
                  </p>
                  <Button variant="outline" onClick={cancelSummary}>
                    {t("Cancel generation")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {summary && !isProcessing && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      {t("AI Summary")} · {t("Completed")}
                    </CardTitle>
                    <Badge variant="secondary">{t("Powered by Ollama")}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="w-full rounded-md border p-4">
                    <MeetingSummary result={summary} />
                  </div>
                </CardContent>
              </Card>
            )}

            {summaryState.status === "failed" && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    {t("Error")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LocalizedError
                    message={
                      summaryState.code === "malformed"
                        ? "The model returned an invalid summary. Please retry."
                        : "Could not generate the summary. Please retry."
                    }
                    detail={summaryState.detail}
                  />
                </CardContent>
              </Card>
            )}

            {summaryState.status === "canceled" && (
              <p role="status">{t("Summary canceled")}</p>
            )}

            <div className="flex justify-center gap-4">
              <Button
                onClick={handleStartRecording}
                disabled={isStarting || isTranscribing}
                size="lg"
              >
                <Mic className="mr-2 h-5 w-5" />
                {t("New Recording")}
              </Button>
              <Button
                onClick={handleManualInput}
                disabled={isStarting || isTranscribing}
                size="lg"
                variant="outline"
              >
                <FileText className="mr-2 h-5 w-5" />
                {t("Manual Input")}
              </Button>
              {transcript && (
                <Button onClick={handleExport} size="lg" variant="outline">
                  <Download className="mr-2 h-5 w-5" />
                  {t("Export")}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
