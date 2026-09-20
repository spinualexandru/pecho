import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ro from "./ro.json";
import { getAppLanguage } from "@/helpers/language_helpers";

export type TranslationKey = keyof typeof en;
// Adding a UI message requires a translation in both interface languages.
const romanian: Record<TranslationKey, string> = ro;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    keySeparator: false;
    nsSeparator: false;
    resources: { translation: typeof en };
  }
}

i18n
  .use(initReactI18next)
  .init({
    lng: getAppLanguage(),
    fallbackLng: "en",
    supportedLngs: ["en", "ro"],
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    resources: { en: { translation: en }, ro: { translation: romanian } },
  })
  .catch((error) => console.error("Could not initialize translations", error));
