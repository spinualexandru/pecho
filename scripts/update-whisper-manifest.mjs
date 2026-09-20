// Run deliberately when changing the supported checkpoints or Transformers.js.
// ModelRegistry 4.3 discovery ignores revision/cache_dir in several nested calls;
// discover the layout with it, then verify every file at an immutable revision.
import { ModelRegistry } from "@huggingface/transformers";
import { writeFile } from "node:fs/promises";

const models = {};
for (const id of [
  "Xenova/whisper-tiny.en",
  "Xenova/whisper-base.en",
  "Xenova/whisper-small.en",
]) {
  const response = await fetch(`https://huggingface.co/api/models/${id}`);
  if (!response.ok) throw new Error(`Cannot inspect ${id}: ${response.status}`);
  const { sha: revision } = await response.json();
  const files = await ModelRegistry.get_pipeline_files(
    "automatic-speech-recognition",
    id,
    { device: "cpu", dtype: "q8" },
  );
  models[id] = { revision, files: {} };
  for (const file of files) {
    const metadata = await ModelRegistry.get_file_metadata(id, file, {
      revision,
    });
    if (!metadata.exists || !metadata.size)
      throw new Error(`Missing size for ${id}/${file}`);
    models[id].files[file] = metadata.size;
  }
}
await writeFile(
  new URL("../src/helpers/whisper-manifest.json", import.meta.url),
  JSON.stringify(models, null, 2) + "\n",
);
console.log(models);
