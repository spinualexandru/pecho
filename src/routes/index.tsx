import React, { useState } from "react";
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
import { useRecording } from "@/hooks/useRecording";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function HomePage() {
  const { t } = useTranslation();
  const {
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
  } = useRecording();

  const {
    selectedModel,
    availableModels,
    isLoading: isLoadingModels,
    selectModel,
  } = useModelSelection();

  const [summary, setSummary] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");
  const [useManualMode, setUseManualMode] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    setSummary("");
    setProcessingError(null);
    setUseManualMode(false);
    await startRecording();
  };

  const handleStopRecording = async () => {
    await stopRecording();
    // Transcription happens automatically in useRecording hook
    // After transcription completes, we'll generate summary
  };

  const handleManualInput = () => {
    setSummary("");
    setProcessingError(null);
    setManualInput("");
    setUseManualMode(true);
  };

  const handleProcessManualInput = async () => {
    if (manualInput.trim() && selectedModel) {
      setIsProcessing(true);
      setProcessingError(null);
      try {
        setTranscript(manualInput);
        const result = await window.recording.summarizeTranscript(
          manualInput,
          selectedModel,
        );
        setSummary(result);
        setUseManualMode(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to process transcript";
        setProcessingError(errorMessage);
        console.error("Processing error:", err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleGenerateSummary = async () => {
    if (transcript.trim() && selectedModel) {
      setIsProcessing(true);
      setProcessingError(null);
      try {
        const result = await window.recording.summarizeTranscript(
          transcript,
          selectedModel,
        );
        setSummary(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate summary";
        setProcessingError(errorMessage);
        console.error("Processing error:", err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `meeting-summary-${timestamp}.md`;

    let content = "# Meeting Summary\n\n";
    content += `**Date:** ${new Date().toLocaleString()}\n`;
    content += `**Duration:** ${formatDuration(duration)}\n\n`;

    content += "## Transcript\n\n";
    content += transcript + "\n\n";

    if (summary) {
      content += "## AI Summary\n\n";
      content += summary + "\n\n";
    }

    content += "---\n";
    content += "*Generated with Personal Echo*\n";

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center gap-6 overflow-auto p-6">
        {!isRecording && !transcript && !useManualMode && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <InitialIcons />
            <span>
              <h1 className="font-mono text-4xl font-bold">{t("appName")}</h1>
              <p
                className="text-muted-foreground text-end text-sm uppercase"
                data-testid="pageTitle"
              >
                {t("titleSlogan")}
              </p>
            </span>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <label className="text-muted-foreground text-sm">
                  Ollama Model
                </label>
                <Select
                  value={selectedModel || ""}
                  onValueChange={selectModel}
                  disabled={isLoadingModels || availableModels.length === 0}
                  dir="ltr"

                >
                  <SelectTrigger className="w-64">
                    <SelectValue
                      placeholder={
                        isLoadingModels
                          ? "Loading models..."
                          : availableModels.length === 0
                            ? "No models available"
                            : "Select a model"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    {availableModels.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4">
                <Button
                  size="lg"
                  onClick={handleStartRecording}
                  disabled={isProcessing || !selectedModel}
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Voice Recording
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleManualInput}
                  disabled={isProcessing || !selectedModel}
                >
                  <FileText className="mr-2 h-5 w-5" />
                  Manual Input
                </Button>
              </div>
              <p className="text-muted-foreground max-w-md text-center text-xs">
                Voice recording captures both your microphone and system audio
                (meeting participants)
              </p>
            </div>
            {error && (
              <div className="text-destructive mt-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
        )}

        {useManualMode && !transcript && (
          <div className="w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Manual Transcript Input
                </CardTitle>
                <CardDescription>
                  Type or paste your meeting transcript below
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter your meeting transcript here..."
                  className="min-h-[300px] resize-y"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setUseManualMode(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleProcessManualInput}
                    disabled={!manualInput.trim() || isProcessing}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Summary
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isRecording && (
          <div className="w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-destructive h-3 w-3 animate-pulse rounded-full" />
                      Recording in Progress
                    </CardTitle>
                    <CardDescription>
                      {formatDuration(duration)} • Capturing microphone + system
                      audio
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
                        Pause
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resumeRecording}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleStopRecording}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 w-full rounded-md border p-4">
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                    Recording audio... Stop to transcribe.
                  </p>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        {isTranscribing && (
          <div className="w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  Transcribing Audio...
                </CardTitle>
                <CardDescription>
                  Processing with Whisper AI (offline)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!isRecording && !isTranscribing && transcript && (
          <div className="w-full max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transcript</CardTitle>
                    <CardDescription>
                      Recorded {formatDuration(duration)}
                    </CardDescription>
                  </div>
                  {!summary && !isProcessing && (
                    <Button onClick={handleGenerateSummary}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Summary
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                  <p className="text-sm whitespace-pre-wrap">{transcript}</p>
                </ScrollArea>
              </CardContent>
            </Card>

            {isProcessing && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    Generating Summary...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
                  </div>
                </CardContent>
              </Card>
            )}

            {summary && !isProcessing && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      AI Summary
                    </CardTitle>
                    <Badge variant="secondary">Powered by Ollama</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64 w-full rounded-md border p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {summary}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {processingError && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Error
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-destructive text-sm">{processingError}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-center gap-4">
              <Button onClick={handleStartRecording} size="lg">
                <Mic className="mr-2 h-5 w-5" />
                New Recording
              </Button>
              <Button onClick={handleManualInput} size="lg" variant="outline">
                <FileText className="mr-2 h-5 w-5" />
                Manual Input
              </Button>
              {transcript && (
                <Button onClick={handleExport} size="lg" variant="outline">
                  <Download className="mr-2 h-5 w-5" />
                  Export
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
