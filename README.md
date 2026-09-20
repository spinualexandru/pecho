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

On the first transcription, the app downloads the selected Whisper model using [Hugging Face Transformers.js](https://github.com/huggingface/transformers.js). Models run on the CPU with 8-bit quantization and are cached in Electron’s user-data directory under `transformers/`, so later transcriptions work offline. The existing `.en` model choices support English transcription; the summary language setting controls Ollama’s output. Models previously cached under `.cache/transformers` will be downloaded once into the new location.

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
