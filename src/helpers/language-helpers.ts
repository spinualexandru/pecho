export interface Language {
  code: string;
  name: string;
  whisperCode: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", name: "English", whisperCode: "english" },
  { code: "ro", name: "Romanian", whisperCode: "romanian" },
  { code: "es", name: "Spanish", whisperCode: "spanish" },
  { code: "fr", name: "French", whisperCode: "french" },
  { code: "de", name: "German", whisperCode: "german" },
  { code: "it", name: "Italian", whisperCode: "italian" },
  { code: "pt", name: "Portuguese", whisperCode: "portuguese" },
  { code: "ru", name: "Russian", whisperCode: "russian" },
  { code: "ja", name: "Japanese", whisperCode: "japanese" },
  { code: "ko", name: "Korean", whisperCode: "korean" },
  { code: "zh", name: "Chinese", whisperCode: "chinese" },
  { code: "ar", name: "Arabic", whisperCode: "arabic" },
  { code: "hi", name: "Hindi", whisperCode: "hindi" },
];

const TRANSCRIBER_LANGUAGE_KEY = "transcriber_language";
const SUMMARY_LANGUAGE_KEY = "summary_language";

export function getTranscriberLanguage(): string {
  return localStorage.getItem(TRANSCRIBER_LANGUAGE_KEY) || "en";
}

export function setTranscriberLanguage(languageCode: string): void {
  localStorage.setItem(TRANSCRIBER_LANGUAGE_KEY, languageCode);
}

export function getSummaryLanguage(): string {
  return localStorage.getItem(SUMMARY_LANGUAGE_KEY) || "en";
}

export function setSummaryLanguage(languageCode: string): void {
  localStorage.setItem(SUMMARY_LANGUAGE_KEY, languageCode);
}

export function getWhisperLanguageCode(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code === languageCode,
  );
  return language?.whisperCode || "english";
}

export function getLanguageName(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code === languageCode,
  );
  return language?.name || "English";
}
