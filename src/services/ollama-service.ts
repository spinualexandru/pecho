import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://localhost:11434" });

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export async function getAvailableModels(): Promise<OllamaModel[]> {
  try {
    const response = await ollama.list();
    return response.models.map((model) => ({
      name: model.name,
      modified_at: model.modified_at,
      size: model.size,
    }));
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
    throw new Error(
      `Failed to fetch Ollama models: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function summarizeTranscript(
  transcript: string,
  model: string = "llama3.2",
): Promise<string> {
  try {
    const response = await ollama.chat({
      model: model,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise, structured summaries of meeting transcripts. Focus on key points, action items, and decisions made.",
        },
        {
          role: "user",
          content: `Please summarize this meeting transcript:\n\n${transcript}`,
        },
      ],
      stream: false,
    });

    return response.message.content;
  } catch (error) {
    console.error("Error summarizing transcript:", error);
    throw new Error(
      `Failed to summarize transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function checkOllamaConnection(): Promise<boolean> {
  try {
    await ollama.list();
    return true;
  } catch (error) {
    console.error("Ollama connection error:", error);
    return false;
  }
}
