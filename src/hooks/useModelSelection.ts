import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
const MODEL_STORAGE_KEY = "pecho-selected-model";
export function useModelSelection() {
  const [preferred, setPreferred] = useState(() =>
    localStorage.getItem(MODEL_STORAGE_KEY),
  );
  const models = useQuery({
    queryKey: ["ollama-status"],
    queryFn: () => window.recording.getOllamaStatus(),
    staleTime: 30_000,
    retry: 1,
  });
  // A failed refresh invalidates availability even if Query retains stale data.
  const availableModels = models.isError ? [] : (models.data?.models ?? []);
  const selectedModel =
    availableModels.find((model) => model.name === preferred)?.name ??
    availableModels[0]?.name ??
    null;
  const selectModel = (name: string) => {
    setPreferred(name);
    localStorage.setItem(MODEL_STORAGE_KEY, name);
  };
  return {
    selectedModel,
    availableModels,
    version: models.isError ? null : models.data?.version,
    isLoading: models.isFetching,
    error: models.error?.message ?? null,
    selectModel,
    refreshModels: () => models.refetch(),
  };
}
