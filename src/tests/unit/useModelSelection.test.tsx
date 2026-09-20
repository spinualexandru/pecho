import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useModelSelection } from "@/hooks/useModelSelection";

const getOllamaModels = vi.fn();
const models = [
  { name: "first", modified_at: "2026-09-20", size: 1024 },
  { name: "saved", modified_at: "2026-09-20", size: 2048 },
];

beforeEach(() => {
  localStorage.clear();
  getOllamaModels.mockReset().mockResolvedValue(models);
  Object.defineProperty(window, "recording", {
    configurable: true,
    value: { getOllamaModels },
  });
  Object.defineProperty(window, "systemInfo", {
    configurable: true,
    value: { getGPUVRAM: vi.fn().mockResolvedValue(null) },
  });
});

it("restores a saved model after fetching available models over IPC", async () => {
  localStorage.setItem("pecho-selected-model", "saved");
  const { result } = renderHook(() => useModelSelection());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.selectedModel).toBe("saved");
  expect(result.current.availableModels).toEqual(models);
});

it("selects a fallback and refreshes models without resetting a valid selection", async () => {
  localStorage.setItem("pecho-selected-model", "removed");
  const { result } = renderHook(() => useModelSelection());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.selectedModel).toBe("first");
  act(() => result.current.selectModel("saved"));
  act(() => result.current.refreshModels());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.selectedModel).toBe("saved");
  expect(localStorage.getItem("pecho-selected-model")).toBe("saved");
  expect(getOllamaModels).toHaveBeenCalledTimes(2);
});
