# Scriptorium — AI-Powered Editorial Design & Academic Writing

An Electron desktop app combining a TipTap-based rich-text editor with an InDesign-style layout engine, powered by Claude AI or local Ollama models.

**Perfect for:** Academic papers, theses, books, magazines, and professional documents with integrated research assistance.

---

## ✨ Features

- ✅ **Rich-text editor** — TipTap with formatting, styles, tables, images
- ✅ **InDesign-style layout mode** — Drag/resize frames, text threading, multi-page
- ✅ **AI-powered writing** — Claude Sonnet 4.6 or local Ollama models for research, suggestions, restructuring
- ✅ **Integrated research browser** — Verify facts and sources without leaving the app
- ✅ **PDF import/export** — Bring in existing PDFs, export to print-ready PDF
- ✅ **Master pages & styles** — Professional document templates
- ✅ **Bibliography management** — APA, MLA, Chicago, IEEE citation formats
- ✅ **System fonts** — Access all installed fonts on your system

---

## 🚀 Quick Start

### Requirements
- Node.js 16+
- npm or yarn
- (Optional) Ollama for local AI models

### Installation

```bash
# Clone the repo
git clone https://github.com/Figstranmedia/scriptorium.git
cd scriptorium

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building

```bash
# Build for your platform
npm run dist        # All platforms
npm run dist:mac    # macOS only

# Production build
npm run build
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop** | Electron 33 + electron-vite |
| **UI** | React 18 + TypeScript |
| **Styling** | TailwindCSS |
| **Editor** | TipTap 2 |
| **AI** | Anthropic SDK + Ollama |
| **Storage** | electron-store |
| **PDF** | pdfjs-dist |

---

## ⚙️ Configuration

### Claude AI Setup

1. Get your API key from [Anthropic Console](https://console.anthropic.com)
2. Open Scriptorium → Settings (⚙️)
3. Select **Claude** as AI Provider
4. Paste your API key
5. Save

### Ollama Setup (Local AI)

1. Install [Ollama](https://ollama.ai)
2. Run: `ollama serve`
3. In Scriptorium → Settings, select **Ollama**
4. Choose your model (llama3, gemma, etc.)
5. Verify connection

---

## 📖 Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Architecture overview, project structure, IPC API reference
- **[CLAUDE_PROMPT.md](./CLAUDE_PROMPT.md)** — Development roadmap (10 feature blocks)

---

## 🛣️ Development Roadmap

### Implemented ✅
- Write mode (TipTap editor, AI actions, bibliography)
- Layout mode (frames, threading, undo/redo)
- PDF import/export
- AI integration (Claude + Ollama)

### Next (Priority Order)
1. **Rulers, Guides & Snap** — Precise object placement
2. **Backgrounds & Borders** — Frame appearance
3. **Multi-select & Alignment** — Layout tools
4. **Global Paragraph Styles** — Named styles (Body, Title, etc.)
5. **Integrated Research Browser** — Search & verify sources
6. **Book Cover Mode** — Front + spine + back cover
7. **Shape Tools** — Rectangles, ellipses, lines
8. **Enhanced Export** — Bleed marks, PNG per page

See [CLAUDE_PROMPT.md](./CLAUDE_PROMPT.md) for detailed feature specs and implementation order.

---

## 🎯 Usage

### Write Mode
1. Create a new document
2. Start typing with full rich-text formatting
3. Use **AI Sidebar** (left) for research, suggestions, restructuring
4. Add references with bibliography manager

### Layout Mode
1. Click the **Layout** button to switch modes
2. Draw text frames (T) and image frames (I)
3. Drag/resize to arrange your design
4. Double-click text frames to edit inline
5. Use **Properties panel** (right) to fine-tune styling
6. Export to PDF when ready

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the conventions in [CLAUDE.md](./CLAUDE.md)
4. Keep TypeScript types strict
5. Test locally before opening a PR

---

## 📄 License

MIT — See [LICENSE](./LICENSE) for details

---

## 🙋 Support

- **Bug reports:** [Issues](https://github.com/Figstranmedia/scriptorium/issues)
- **Feature requests:** [Discussions](https://github.com/Figstranmedia/scriptorium/discussions)
- **Questions:** Open an issue with label `question`

---

## 🎬 Built with love by [Figstranmedia](https://github.com/Figstranmedia)

*Editorial design meets AI. Your research, your design, your voice.*