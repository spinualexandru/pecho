import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAppLanguage,
  setAppLanguage,
  updateAppLanguage,
} from "@/helpers/language_helpers";
import {
  getTranscriberLanguage,
  getSummaryLanguage,
  setTranscriberLanguage,
  setSummaryLanguage,
  getWhisperLanguageCode,
  getLanguageName,
  SUPPORTED_LANGUAGES,
} from "@/helpers/language-helpers";
import {
  getWhisperModel,
  isModelCompatible,
  setWhisperModel,
  WHISPER_MODELS,
} from "@/helpers/whisper-helpers";
import en from "@/localization/en.json";
import ro from "@/localization/ro.json";
import type { i18n } from "i18next";

beforeEach(() => localStorage.clear());
describe("independent language preferences", () => {
  it("resolves Romanian keys containing punctuation and interpolates loading labels", async () => {
    await import("@/localization/i18n");
    const { default: i18n } = await import("i18next");
    await i18n.changeLanguage("ro");
    for (const key of Object.keys(en)) expect(i18n.exists(key)).toBe(true);
    expect(i18n.t("Progress: {{phase}}", { phase: "Se descarcă" })).toBe(
      "Progres: Se descarcă",
    );
    expect(
      i18n.t(
        "Note: Only capturing microphone. System audio capture was declined.",
      ),
    ).toBe(
      ro["Note: Only capturing microphone. System audio capture was declined."],
    );
    await i18n.changeLanguage("en");
  });
  it("falls back on missing/invalid settings and repairs an old English-only model pairing", () => {
    expect(getAppLanguage()).toBe("en");
    expect(getTranscriberLanguage()).toBe("en");
    expect(getSummaryLanguage()).toBe("en");
    for (const key of [
      "lang",
      "transcriber_language",
      "summary_language",
      "whisper_model",
    ])
      localStorage.setItem(key, "invalid");
    expect(getAppLanguage()).toBe("en");
    expect(getTranscriberLanguage()).toBe("en");
    expect(getSummaryLanguage()).toBe("en");
    expect(getWhisperModel()).toBe("Xenova/whisper-tiny.en");
    setTranscriberLanguage("ro");
    localStorage.setItem("whisper_model", "Xenova/whisper-small.en");
    expect(getWhisperModel()).toBe("Xenova/whisper-tiny");
    expect(() => setWhisperModel("Xenova/whisper-small.en")).toThrow(
      "Unsupported",
    );
  });
  it("persists independent preferences and sets document language on restart", () => {
    const instance = {
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    } as unknown as i18n;
    setTranscriberLanguage("fr");
    setSummaryLanguage("ja");
    setAppLanguage("ro", instance);
    expect(getTranscriberLanguage()).toBe("fr");
    expect(getSummaryLanguage()).toBe("ja");
    expect(getAppLanguage()).toBe("ro");
    updateAppLanguage(instance);
    expect(document.documentElement.lang).toBe("ro");
    setAppLanguage("", instance);
    expect(getAppLanguage()).toBe("ro");
    localStorage.setItem("lang", "xx");
    updateAppLanguage(instance);
    expect(document.documentElement.lang).toBe("en");
  });
  it("supports all thirteen speech languages, rejects unknown requests and translates every key", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(13);
    for (const { code } of SUPPORTED_LANGUAGES) {
      expect(getWhisperLanguageCode(code)).toBeTruthy();
      expect(getLanguageName(code)).toBeTruthy();
      for (const { id } of WHISPER_MODELS)
        expect(isModelCompatible(id, code)).toBe(
          code === "en" || !id.endsWith(".en"),
        );
    }
    expect(() => getWhisperLanguageCode("xx")).toThrow();
    expect(() => getLanguageName("xx")).toThrow();
    expect(() => setTranscriberLanguage("xx")).toThrow();
    expect(() => setSummaryLanguage("xx")).toThrow();
    expect(Object.keys(ro).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(ro).every(Boolean)).toBe(true);
  });
});
