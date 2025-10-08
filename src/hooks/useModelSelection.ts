import { useState, useEffect } from "react";

const MODEL_STORAGE_KEY = "pecho-selected-model";

export function useModelSelection() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [gpuVRAM, setGpuVRAM] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch available models from Ollama and GPU VRAM in parallel
      const [models, gpuInfo] = await Promise.all([
        window.recording.getOllamaModels(),
        window.systemInfo.getGPUVRAM(),
      ]);

      console.log(gpuInfo);

      setAvailableModels(models);
      setGpuVRAM(gpuInfo?.vram ?? null);

      // Check localStorage for cached selection
      const cachedModel = localStorage.getItem(MODEL_STORAGE_KEY);

      if (cachedModel && models.some((m) => m.name === cachedModel)) {
        // Use cached model if it exists in available models
        setSelectedModel(cachedModel);
      } else if (models.length > 0) {
        // Use first available model as default
        const defaultModel = models[0].name;
        setSelectedModel(defaultModel);
        localStorage.setItem(MODEL_STORAGE_KEY, defaultModel);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load models";
      setError(errorMessage);
      console.error("Error loading Ollama models:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectModel = (modelName: string) => {
    setSelectedModel(modelName);
    localStorage.setItem(MODEL_STORAGE_KEY, modelName);
  };

  const refreshModels = () => {
    loadModels();
  };

  return {
    selectedModel,
    availableModels,
    gpuVRAM,
    isLoading,
    error,
    selectModel,
    refreshModels,
  };
}
