export interface Language {
  code: string;
  name: string;
  whisperCode: string;
}

export const SUPPORTED_LANGUAGES = [
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
] as const satisfies readonly Language[];

export type SpeechLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export function isSpeechLanguage(code: unknown): code is SpeechLanguage {
  return SUPPORTED_LANGUAGES.some((language) => language.code === code);
}

function readLanguage(key: string): SpeechLanguage {
  const saved = localStorage.getItem(key);
  return isSpeechLanguage(saved) ? saved : "en";
}

const TRANSCRIBER_LANGUAGE_KEY = "transcriber_language";
const SUMMARY_LANGUAGE_KEY = "summary_language";

export function getTranscriberLanguage(): SpeechLanguage {
  return readLanguage(TRANSCRIBER_LANGUAGE_KEY);
}

export function setTranscriberLanguage(languageCode: string): void {
  if (!isSpeechLanguage(languageCode))
    throw new Error("Unsupported transcription language");
  localStorage.setItem(TRANSCRIBER_LANGUAGE_KEY, languageCode);
}

export function getSummaryLanguage(): SpeechLanguage {
  return readLanguage(SUMMARY_LANGUAGE_KEY);
}

export function setSummaryLanguage(languageCode: string): void {
  if (!isSpeechLanguage(languageCode))
    throw new Error("Unsupported summary language");
  localStorage.setItem(SUMMARY_LANGUAGE_KEY, languageCode);
}

export function getWhisperLanguageCode(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code === languageCode,
  );
  if (!language) throw new Error("Unsupported transcription language");
  return language.whisperCode;
}

export function getLanguageName(languageCode: string): string {
  const language = SUPPORTED_LANGUAGES.find(
    (lang) => lang.code === languageCode,
  );
  if (!language) throw new Error("Unsupported summary language");
  return language.name;
}
