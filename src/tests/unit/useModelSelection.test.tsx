import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { useModelSelection } from "@/hooks/useModelSelection";
import type { ReactNode } from "react";
const getOllamaStatus = vi.fn();
const models = [
  { name: "first", modified_at: "2026-09-20", size: 1024 },
  { name: "saved", modified_at: "2026-09-20", size: 2048 },
];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useModelSelection(), { wrapper });
}
beforeEach(() => {
  localStorage.clear();
  getOllamaStatus.mockReset().mockResolvedValue({ version: "fixture", models });
  Object.defineProperty(window, "recording", {
    configurable: true,
    value: { getOllamaStatus },
  });
  Object.defineProperty(window, "systemInfo", {
    configurable: true,
    value: {
      getGPUVRAM: vi.fn().mockRejectedValue(new Error("GPU unavailable")),
    },
  });
});
it("restores a saved model without relying on GPU inventory", async () => {
  localStorage.setItem("pecho-selected-model", "saved");
  const { result } = setup();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.selectedModel).toBe("saved");
  expect(result.current.availableModels).toEqual(models);
  expect(window.systemInfo.getGPUVRAM).not.toHaveBeenCalled();
});
it("refreshes stale models and clears removed selections for empty and unreachable states", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.selectedModel).toBe("first");
  act(() => result.current.selectModel("saved"));
  getOllamaStatus.mockResolvedValue({ version: "fixture", models: [] });
  await act(() => result.current.refreshModels());
  await waitFor(() => expect(result.current.selectedModel).toBeNull());
  expect(result.current.error).toBeNull();
  getOllamaStatus.mockRejectedValue(new Error("server unavailable"));
  await act(() => result.current.refreshModels());
  await waitFor(() => expect(result.current.error).toBe("server unavailable"));
  expect(result.current.availableModels).toEqual([]);
  getOllamaStatus.mockResolvedValue({ version: "fixture", models });
  await act(() => result.current.refreshModels());
  await waitFor(() => expect(result.current.selectedModel).toBe("saved"));
});
