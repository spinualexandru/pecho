# Personal Echo (pecho)

> 100% offline meeting transcriber and summarization powered by OpenAI's Whisper and Ollama

Personal Echo is an Electron desktop app that records meetings, transcribes them offline using OpenAI's Whisper, and generates intelligent summaries with your local Ollama instance.

[demo.webm](https://github.com/user-attachments/assets/d7e70697-a66e-4f7d-be8e-8b475dea7329)

## Features

- **Dual Audio Capture** - Records both your microphone and system audio (perfect for video calls)
- **Offline Transcription** - Whisper runs locally (no internet after initial model download)
- **AI Summarization** - Uses local Ollama for intelligent meeting summaries
- **Manual Input** - Type or paste transcripts directly
- **Beautiful Markdown** - Summaries rendered with proper formatting
- **Export** - Download transcript + summary as `.md` file
- **Privacy First** - Everything runs on your machine

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) (24.15+ on the Node 24 LTS line, or Node 26+)
- [Ollama](https://ollama.ai) with a model installed

### Installation

```bash
# Install dependencies
npm ci

# Start the app
npm run start
```

### First Run

On the first transcription, the app downloads the selected Whisper model using [Hugging Face Transformers.js](https://github.com/huggingface/transformers.js). Models run on the CPU with 8-bit quantization and are cached in Electron’s user-data directory under `transformers/`, so later transcriptions work offline. Tiny, Base, and Small `.en` choices support English transcription. Tiny multilingual supports all thirteen transcription languages offered in Settings; choosing a non-English language selects it automatically. The summary language setting independently controls Ollama’s output. Models previously cached under `.cache/transformers` will be downloaded once into the new location.

## 📖 Usage

### Voice Recording

1. Click **Voice Recording**
2. Grant microphone permission (if required)
3. Record your meeting
4. Click **Stop** to transcribe with Whisper
5. Click **Generate Summary** for AI-powered insights
6. Click **Export** to save as markdown

### Manual Input

1. Click **Manual Input**
2. Type or paste your transcript
3. Click **Generate Summary**

## Development

```bash
npm run start        # Development mode
npm run package      # Package app
npm run make         # Generate distributables
npm run typecheck    # Generate routes, build renderer, and check with TypeScript 7
npm run lint         # Oxlint, including React Compiler and hooks rules
npm run format       # Check formatting with Oxfmt
npm run format:write # Format code and sort Tailwind classes
npm test             # Service and React hook tests
npm run test:e2e     # Package, then test the Electron UI (requires a display)
npm run test:all     # Unit and Electron UI tests
```

### Whisper downloads and offline cache

In **Settings → Transcription**, each model shows its complete CPU/q8 download size, remaining download, and cache status. Download before a meeting to prepare it for offline use. Progress also appears during the first transcription. Deleting a selected model keeps the selection; the next transcription downloads it again. Download, loading, transcription, and deletion share one lifecycle lock, so another model operation cannot dispose a model during inference.

Files live in Electron's writable `userData/transformers/<model ID>` directory. Downloads use immutable Hugging Face revisions, stream into temporary files, check their exact byte length, and rename them only after completion. Completed files survive a failed download; Retry downloads the missing files. Deletion also removes interrupted temporary files. Existing caches from earlier versions are reused when all required file sizes match. These size checks detect missing/truncated files; they are not cryptographic integrity checks.

`src/helpers/whisper-manifest.json` records the actual required model, tokenizer, and processor file sizes. Regenerate deliberately with `node scripts/update-whisper-manifest.mjs` when updating checkpoints or Transformers.js. The generator uses Transformers.js 4.3 `ModelRegistry` discovery and metadata at pinned revisions. Its nested discovery calls, including those inside `pipeline()`, do not consistently forward revision or offline options. Runtime therefore downloads the manifest files first and passes the absolute cache directory to the pipeline with `local_files_only: true`. Cache inspection and deletion use only the local filesystem, including at startup without a connection.

For an opt-in real-model integration check on Linux with a display, `ip`, and unprivileged network namespaces:

```bash
npm run package
node scripts/check-whisper-packaged.cjs
```

This launches the hardened packaged binary with an isolated profile. It verifies a genuine offline download failure and Retry control, then retries after restarting online and downloads Tiny (42,985,755 bytes). A final restart inside a network namespace with no external network verifies cached discovery, actual CPU Whisper inference, and deletion of the loaded model through the UI. The check removes its temporary profile and saves `.cache/whisper-models.png`. Same-process failure/retry, partial cleanup, concurrent deletion/inference protection, and disposal failure recovery are covered by unit tests. The real-model check currently covers Tiny on Linux; Base, Small, and packaged macOS/Windows inference are not exercised by it.

### Language settings and verification

**Settings → Languages** separates the interface (English or Romanian), spoken transcription language, and summary output language. Each preference persists independently. Missing or invalid language preferences fall back to English; invalid model IDs fall back to Tiny English, or Tiny multilingual when the transcription language requires it. Existing non-English preferences paired with an English-only model migrate to Tiny multilingual. English-only options stay disabled for non-English transcription, and the main-process API rejects unsupported language/model combinations before downloading or inference. Recording captures its model and language when it starts, so changing Settings while recording cannot reinterpret that recording.

Tiny multilingual adds a pinned 43,622,127-byte CPU/q8 checkpoint. It explicitly uses Whisper's `transcribe` task and selected language, preserving the source language instead of translating to English. All thirteen language choices are retained for summaries; actual summary quality depends on the selected Ollama model. Tiny prioritizes speed and size; support for a language does not guarantee accurate recognition for every speaker or recording.

Interface strings, loading states, model cache actions, errors, window controls, and exported Markdown headings have typed English/Romanian translations. Technical errors from Electron, the OS, or remote services remain available under a translated **Technical details** disclosure. Transcription and generated summary content retain their independently selected languages.

Run the opt-in packaged language check on Linux with a display and `ffmpeg`:

```bash
npm run package
node scripts/check-languages-packaged.cjs
# Keep the isolated profile, fixtures and downloaded checkpoints for subsequent checks:
PECHO_LANGUAGE_PROFILE=.cache/language-profile node scripts/check-languages-packaged.cjs
```

The check downloads public `jfk.wav` and `french-audio.wav` fixtures from [Xenova/transformers.js-docs at revision fbe92bd](https://huggingface.co/datasets/Xenova/transformers.js-docs/tree/fbe92bd97d48f3ec17779d8d8f2964e1c6bc7634), converts them to mono 16 kHz float audio with ffmpeg, and uses the real packaged IPC and native inference with the models/languages selected in Settings. Audio is not bundled or redistributed in this repository; the source dataset does not declare a dataset-wide license. The French reference is the "Transcribe French" example in Transformers.js's automatic speech recognition documentation/source. On the validated Linux run, Tiny English returned "And so my fellow Americans ask not what your country can do for you, ask what you can do for your country." Tiny multilingual returned "J'adore, j'aime, je n'aime pas, je déteste." Assertions check recognizable phrases, not just nonempty output. These two short fixtures verify language routing, not meeting-quality accuracy or all thirteen languages.

The same check verifies English-only rejection over IPC, automatic multilingual selection, disabled incompatible choices, Romanian navigation, and independent preferences across a full restart. It saves `.cache/languages-romanian-home.png` and `.cache/languages-romanian-settings.png`. Unit tests cover all language/model compatibility pairs, invalid settings, translation key parity, and explicit Whisper generation options. Packaged macOS/Windows language behavior and real non-English Ollama output are not covered by this check.

### Dependency maintenance

Direct dependencies target the latest stable releases available on September 20, 2026. `@electron/fuses` remains on 1.8.0 because the latest stable Forge fuses plugin (7.11.2) requires its v1 API. No peer-dependency checks are bypassed.

For npm 12, `allowScripts` permits the Windows installer setup and protobuf version check, and skips ONNX Runtime’s optional GPU downloads. CPU inference uses the binaries already included in the package.

Three temporary npm overrides keep Forge 7’s transitive tooling current: `@electron/rebuild` 4.2, Electron’s maintained `@electron-internal/extract-zip` replacement, and `tmp` 0.2.7. The ZIP replacement also fixes packaging exiting before writing an artifact on Node 26. Revisit these overrides when Forge updates its dependencies.

TypeScript checks application and configuration code with `skipLibCheck` because several dependencies ship conflicting declaration files. The old handwritten Web Speech declarations are removed now that TypeScript supplies them. Forge loads its TypeScript config through its bundled Jiti loader; `ts-node` is no longer needed.

The Electron UI test uses an isolated user-data directory and stubbed Ollama IPC responses; it does not need a local LLM, microphone access, or model downloads. Real recording and Ollama inference still require the local services and device permissions described above.

## Built With

- **Electron 44** - Cross-platform desktop framework
- **React 19** - UI library with React Compiler
- **Whisper AI** - Offline speech-to-text via Transformers.js
- **Ollama** - Local LLM for summarization
- **Tailwind 4** - Styling
- **shadcn/ui** - UI components

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## Special Thanks

LuanRoger for the ElectronForge + Vite + TypeScript boilerplate https://github.com/LuanRoger/electron-shadcn
