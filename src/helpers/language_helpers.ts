import type { i18n } from "i18next";

export type InterfaceLanguage = "en" | "ro";
const languageLocalStorageKey = "lang";

export function getAppLanguage(): InterfaceLanguage {
  const saved = localStorage.getItem(languageLocalStorageKey);
  return saved === "ro" ? "ro" : "en";
}

export function setAppLanguage(lang: string, i18n: i18n) {
  if (lang !== "en" && lang !== "ro") return;
  localStorage.setItem(languageLocalStorageKey, lang);
  i18n
    .changeLanguage(lang)
    .catch((error) =>
      console.error("Could not change interface language", error),
    );
  document.documentElement.lang = lang;
}

export function updateAppLanguage(i18n: i18n) {
  setAppLanguage(getAppLanguage(), i18n);
}
