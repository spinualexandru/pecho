// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const { chat, list } = vi.hoisted(() => ({ chat: vi.fn(), list: vi.fn() }));
vi.mock("ollama", () => ({
  Ollama: class {
    chat = chat;
    list = list;
  },
}));

import {
  getAvailableModels,
  summarizeTranscript,
} from "@/services/ollama-service";

beforeEach(() => vi.clearAllMocks());

it("uses the language supplied over IPC without accessing browser storage", async () => {
  chat.mockResolvedValue({ message: { content: "Rezumat" } });
  await expect(summarizeTranscript("Meeting", "llama3.2", "ro")).resolves.toBe(
    "Rezumat",
  );
  expect(chat).toHaveBeenCalledWith({
    model: "llama3.2",
    messages: [
      { role: "system", content: expect.stringContaining("Romanian") },
      { role: "user", content: expect.stringContaining("Meeting") },
    ],
    stream: false,
  });
});

it("normalizes the current Ollama model list for IPC", async () => {
  const modified = new Date("2026-09-20T00:00:00Z");
  list.mockResolvedValue({
    models: [{ name: "llama3.2", modified_at: modified, size: 123 }],
  });
  await expect(getAvailableModels()).resolves.toEqual([
    { name: "llama3.2", modified_at: modified.toString(), size: 123 },
  ]);
});
