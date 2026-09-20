import { setAppLanguage } from "@/helpers/language_helpers";
import langs from "@/localization/langs";
import { useTranslation } from "react-i18next";
import { WhisperModels } from "@/components/WhisperModels";
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
  isModelCompatible,
  setWhisperModel,
  WHISPER_MODELS,
  type WhisperModel,
} from "@/helpers/whisper-helpers";
import {
  getTranscriberLanguage,
  isSpeechLanguage,
  setTranscriberLanguage,
  getSummaryLanguage,
  setSummaryLanguage,
  SUPPORTED_LANGUAGES,
} from "@/helpers/language-helpers";
import { ThemeMode } from "@/types/theme-mode";
import { createFileRoute } from "@tanstack/react-router";

function Settings() {
  const { t, i18n } = useTranslation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [whisperModel, setWhisperModelState] =
    useState<WhisperModel>(getWhisperModel);
  const [transcriberLanguage, setTranscriberLanguageState] = useState(
    getTranscriberLanguage,
  );
  const [summaryLanguage, setSummaryLanguageState] =
    useState(getSummaryLanguage);

  useEffect(() => {
    const loadTheme = async () => {
      const { local } = await getCurrentTheme();
      if (local) {
        setIsDarkMode(local === "dark");
      }
    };
    loadTheme();
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
    if (!isSpeechLanguage(languageCode)) return;
    setTranscriberLanguageState(languageCode);
    setTranscriberLanguage(languageCode);
    const compatible = getWhisperModel();
    setWhisperModel(compatible);
    setWhisperModelState(compatible);
  };

  const handleSummaryLanguageChange = (languageCode: string) => {
    if (!isSpeechLanguage(languageCode)) return;
    setSummaryLanguageState(languageCode);
    setSummaryLanguage(languageCode);
  };

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold">{t("Settings")}</h1>
      <div className="flex w-full flex-col rounded-md border p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("Appearance")}</CardTitle>
            <CardDescription>
              {t("Customize the appearance of the application")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme-toggle">{t("Dark Mode")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("Toggle between light and dark theme")}
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

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("Transcription")}</CardTitle>
            <CardDescription>
              {t("Configure the speech recognition model")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whisper-model">{t("Whisper Model")}</Label>
              <Select
                value={whisperModel}
                onValueChange={handleWhisperModelChange}
              >
                <SelectTrigger id="whisper-model">
                  <SelectValue
                    placeholder={t("Select a model")}
                    className="!text-left"
                  />
                </SelectTrigger>
                <SelectContent>
                  {WHISPER_MODELS.map((model) => (
                    <SelectItem
                      key={model.id}
                      value={model.id}
                      disabled={
                        !isModelCompatible(model.id, transcriberLanguage)
                      }
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          {model.id.endsWith(".en")
                            ? `${model.name} · ${t("English only")}`
                            : t("Tiny multilingual")}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t(model.description)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Choose the Whisper model for audio transcription. Larger models provide better accuracy but require more memory and processing time.",
                )}
              </p>
            </div>
            {transcriberLanguage !== "en" && (
              <p role="status" className="text-sm text-muted-foreground">
                {t(
                  "A multilingual model is required for this language. Tiny multilingual is selected automatically.",
                )}
              </p>
            )}
            <WhisperModels selectedModel={whisperModel} />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("Languages")}</CardTitle>
            <CardDescription>
              {t("Configure language settings for transcription and summaries")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="interface-language">
                {t("Interface Language")}
              </Label>
              <Select
                value={i18n.resolvedLanguage}
                onValueChange={(value) => setAppLanguage(value, i18n)}
              >
                <SelectTrigger id="interface-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {langs.map((language) => (
                    <SelectItem key={language.key} value={language.key}>
                      {language.nativeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Interface language does not change transcription or summaries.",
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transcriber-language">
                {t("Transcription Language")}
              </Label>
              <Select
                value={transcriberLanguage}
                onValueChange={handleTranscriberLanguageChange}
              >
                <SelectTrigger id="transcriber-language">
                  <SelectValue
                    placeholder={t("Select transcription language")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {t(language.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Language that Whisper will transcribe audio from. Default: English",
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary-language">
                {t("Summary Output Language")}
              </Label>
              <Select
                value={summaryLanguage}
                onValueChange={handleSummaryLanguageChange}
              >
                <SelectTrigger id="summary-language">
                  <SelectValue placeholder={t("Select summary language")} />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code}>
                      {t(language.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Language that the AI model will use to generate summaries. Default: English",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: Settings,
});
