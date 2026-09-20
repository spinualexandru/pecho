import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WhisperModels } from "@/components/WhisperModels";
import type { WhisperModelStatus } from "@/helpers/whisper-helpers";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/useWhisperModels", () => ({
  useWhisperModels: () => ({
    models: [
      {
        id: "Xenova/whisper-tiny.en",
        cached: false,
        hasCache: true,
        cachedBytes: 1,
        totalBytes: 2,
        remainingBytes: 1,
        phase: "idle",
        loadedBytes: 0,
        progressTotalBytes: 0,
        error: null,
        busy: false,
      } satisfies WhisperModelStatus,
    ],
    error: null,
  }),
}));

it.each(["download", "delete"] as const)(
  "unlocks model actions after a rejected %s and allows retry",
  async (action) => {
    let reject!: (error: Error) => void;
    const operation = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    window.recording = {
      downloadWhisperModel: operation,
      deleteWhisperModel: operation,
    } as unknown as RecordingContext;
    render(<WhisperModels selectedModel="Xenova/whisper-tiny.en" />);
    function run() {
      if (action === "delete") {
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete files" }));
      } else fireEvent.click(screen.getByRole("button", { name: "Download" }));
    }
    run();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete files" })).toBeNull();
    await act(async () => reject(new Error("disk unavailable")));
    expect(screen.getByRole("alert")).toHaveTextContent("disk unavailable");
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    run();
    await act(async () => {});
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenLastCalledWith("Xenova/whisper-tiny.en");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
  },
);
