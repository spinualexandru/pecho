# Personal Echo (pecho)

> 100% offline meeting transcriber and summarization powered by OpenAI's Whisper and Ollama

Personal Echo is an Electron desktop app that records meetings, transcribes them offline using OpenAI's Whisper, and generates intelligent summaries with your local Ollama instance.

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

- [Node.js](https://nodejs.org) (v18 or later)
- [Ollama](https://ollama.ai) with a model installed

### Installation

```bash
# Install dependencies
npm install

# Start the app
npm run start
```

### First Run

On first launch, the app will download a ~40MB Whisper model. This happens once, then everything works offline. ( Thanks to [Xenova Transformers](https://github.com/xenova/transformers) )

## 📖 Usage

### Voice Recording

1. Click **Voice Recording**
2. Grant microphone permission (if required)
4. Record your meeting
5. Click **Stop** to transcribe with Whisper
6. Click **Generate Summary** for AI-powered insights
7. Click **Export** to save as markdown

### Manual Input

1. Click **Manual Input**
2. Type or paste your transcript
3. Click **Generate Summary**

## Development

```bash
npm run start        # Development mode
npm run package      # Package app
npm run make         # Generate distributables
npm run lint         # Lint code
npm run format:write # Format code
npm test             # Run tests
```

## Built With

- **Electron 38** - Cross-platform desktop framework
- **React 19** - UI library with React Compiler
- **Whisper AI** - Offline speech-to-text via Transformers.js
- **Ollama** - Local LLM for summarization
- **Tailwind 4** - Styling
- **shadcn/ui** - UI components

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.


## Special Thanks
LuanRoger for the ElectronForge + Vite + TypeScript boilerplate https://github.com/LuanRoger/electron-shadcn