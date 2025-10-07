import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrentTheme, setTheme } from "@/helpers/theme_helpers";
import {
  getWhisperModel,
  setWhisperModel,
  WHISPER_MODELS,
  type WhisperModel,
} from "@/helpers/whisper-helpers";
import {
  getTranscriberLanguage,
  setTranscriberLanguage,
  getSummaryLanguage,
  setSummaryLanguage,
  SUPPORTED_LANGUAGES,
} from "@/helpers/language-helpers";
import { ThemeMode } from "@/types/theme-mode";
import { createFileRoute } from "@tanstack/react-router";
import { ScrollArea } from "@/components/ui/scroll-area";

function Settings() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [whisperModel, setWhisperModelState] = useState<WhisperModel>(
    "Xenova/whisper-tiny.en",
  );
  const [transcriberLanguage, setTranscriberLanguageState] = useState("en");
  const [summaryLanguage, setSummaryLanguageState] = useState("en");

  useEffect(() => {
    const loadTheme = async () => {
      const { local } = await getCurrentTheme();
      if (local) {
        setIsDarkMode(local === "dark");
      }
    };
    loadTheme();

    // Load preferences
    setWhisperModelState(getWhisperModel());
    setTranscriberLanguageState(getTranscriberLanguage());
    setSummaryLanguageState(getSummaryLanguage());
  }, []);

  const handleThemeToggle = async (checked: boolean) => {
    const newTheme: ThemeMode = checked ? "dark" : "light";
    setIsDarkMode(checked);
    await setTheme(newTheme);
  };

  const handleWhisperModelChange = (model: WhisperModel) => {
    setWhisperModelState(model);
    setWhisperModel(model);
  };

  const handleTranscriberLanguageChange = (languageCode: string) => {
    setTranscriberLanguageState(languageCode);
    setTranscriberLanguage(languageCode);
  };

  const handleSummaryLanguageChange = (languageCode: string) => {
    setSummaryLanguageState(languageCode);
    setSummaryLanguage(languageCode);
  };

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>
      <ScrollArea className="h-[480px] max-h-screen w-full rounded-md border p-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the appearance of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme-toggle">Dark Mode</Label>
                <p className="text-muted-foreground text-sm">
                  Toggle between light and dark theme
                </p>
              </div>
              <Switch
                id="theme-toggle"
                checked={isDarkMode}
                onCheckedChange={handleThemeToggle}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transcription</CardTitle>
            <CardDescription>
              Configure the speech recognition model
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whisper-model">Whisper Model</Label>
              <Select
                value={whisperModel}
                onValueChange={handleWhisperModelChange}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder="Select a model"
                    className="!text-left"
                  />
                </SelectTrigger>
                <SelectContent>
                  {WHISPER_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-muted-foreground text-sm">
                          {model.description} • {model.size}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-sm">
                Choose the Whisper model for audio transcription. Larger models
                provide better accuracy but require more memory and processing
                time.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Languages</CardTitle>
            <CardDescription>
              Configure language settings for transcription and summaries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="transcriber-language">
                Transcription Language
              </Label>
              <Select
                value={transcriberLanguage}
                onValueChange={handleTranscriberLanguageChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select transcription language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-sm">
                Language that Whisper will transcribe audio from. Default:
                English
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary-language">Summary Output Language</Label>
              <Select
                value={summaryLanguage}
                onValueChange={handleSummaryLanguageChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select summary language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {language.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-sm">
                Language that the AI model will use to generate summaries.
                Default: English
              </p>
            </div>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: Settings,
});
