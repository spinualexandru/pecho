import { z } from "zod";
import { isSpeechLanguage } from "./language-helpers";
import { isWhisperModel, isModelCompatible } from "./whisper-helpers";

export const meetingSummarySchema = z
  .object({
    summary: z.string().trim().min(1).max(100_000),
    decisions: z.array(z.string().trim().min(1).max(10_000)).max(200),
    actionItems: z
      .array(
        z
          .object({
            task: z.string().trim().min(1).max(10_000),
            owner: z.string().max(1000).nullable(),
            dueDate: z.string().max(1000).nullable(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
export type MeetingSummary = z.infer<typeof meetingSummarySchema>;
export const requestIdSchema = z.uuid();
export const summaryRequestSchema = z
  .object({
    requestId: requestIdSchema,
    transcript: z.string().trim().min(1).max(1_000_000),
    model: z.string().trim().min(1).max(256),
    language: z.custom<string>(isSpeechLanguage),
  })
  .strict();
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;
export type SummaryEvent = { requestId: string } & (
  | { status: "generating"; preview: string }
  | { status: "completed"; result: MeetingSummary }
  | { status: "canceled" }
  | { status: "failed"; code: "generation" | "malformed"; detail: string }
);
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}
export interface OllamaStatus {
  version: string;
  models: OllamaModel[];
}

export function validateTranscription(
  audio: unknown,
  model: unknown = "Xenova/whisper-tiny.en",
  language: unknown = "en",
) {
  if (
    !(audio instanceof ArrayBuffer) ||
    audio.byteLength === 0 ||
    audio.byteLength % 4 !== 0
  )
    throw new Error(
      "Invalid audio buffer (expected nonempty 16 kHz Float32 PCM)",
    );
  if (
    !isWhisperModel(model) ||
    !isSpeechLanguage(language) ||
    !isModelCompatible(model, language)
  )
    throw new Error("Invalid transcription model or language");
  const samples = new Float32Array(audio);
  if (samples.some((sample) => !Number.isFinite(sample)))
    throw new Error("Invalid PCM samples");
  return { samples, model, language };
}
