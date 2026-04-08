# Contributing to Scriptorium

Thank you for your interest in contributing to Scriptorium.

> © 2026 Rafael E. Figueroa Pastrana, Raffael Figueroa Music LLC  
> This project is licensed under the MIT License.

---

## Getting Started

```bash
git clone https://github.com/Figstranmedia/scriptorium.git
cd scriptorium
npm install
npm run dev       # development with hot reload
npm run build     # production build
npm run dist:mac  # package macOS .app + .dmg
```

### Prerequisites
- Node.js 20+
- macOS (primary target; Windows/Linux builds are possible but untested)
- Optional: [Ollama](https://ollama.com) for local AI models
- Optional: Anthropic API key for Claude integration

---

## Project Structure

```
src/
  main/index.ts          — Electron main: IPC handlers, AI calls, file I/O
  preload/index.ts       — Context bridge (window.api)
  renderer/src/
    App.tsx              — Root component, window.api type declarations
    store/useStore.ts    — Global React state (documents, UI flags)
    components/
      Editor/            — TipTap write mode
      Layout/            — InDesign-style layout engine
      Sidebar/           — AI chat sidebar, bibliography panel
    lib/
      threadEngine.ts    — Text threading, frame types, factory functions
      pdfImport.ts       — PDF text extraction (pdfjs-dist)
      printHTML.ts       — HTML generation for PDF/PNG export
      citations.ts       — APA/MLA/Chicago/IEEE formatting
      snap.ts            — Magnetic snap logic
      preflight.ts       — Layout validation
```

Full architecture is documented in [CLAUDE.md](CLAUDE.md).

---

## Coding Conventions

- **No localStorage** — always use `window.api` (IPC) for persistence
- **Tailwind CSS only** — no CSS modules, no styled-components
- **All IPC handlers** go in `src/main/index.ts` + exposed in `src/preload/index.ts`
- **TypeScript strict** — keep `threadEngine.ts` and `useStore.ts` types updated
- **Frames render as DOM divs** (not canvas) — maintain this pattern
- **`saveLayout()`** must be called after every frame mutation
- Do not add error handling for impossible states; trust internal invariants
- Do not add features beyond what was asked; no speculative abstractions

---

## Adding a New IPC Handler

1. Add the handler in `src/main/index.ts`:
   ```typescript
   ipcMain.handle('my:handler', async (_event, arg: string) => {
     // ...
     return { result }
   })
   ```

2. Expose it in `src/preload/index.ts`:
   ```typescript
   myHandler: (arg: string) => ipcRenderer.invoke('my:handler', arg),
   ```

3. Declare the type in `src/renderer/src/App.tsx` (inside `Window.api`):
   ```typescript
   myHandler: (arg: string) => Promise<{ result?: string; error?: string }>
   ```

---

## Adding a New Frame Type

Frame types live in `src/renderer/src/lib/threadEngine.ts`.

1. Define the interface (see `LayoutShapeFrame` as a reference)
2. Add a type guard `isXxxFrame(f: AnyLayoutFrame): f is LayoutXxxFrame`
3. Add `createDefaultXxxFrame()` factory
4. Update `AnyLayoutFrame` union type
5. Create `LayoutXxxFrame.tsx` component (drag/resize pattern from `LayoutImageFrame.tsx`)
6. Import and render in `LayoutPage.tsx`
7. Add `onAddXxxFrame` prop and handler in `LayoutCanvas.tsx`
8. Add properties in `LayoutPropertiesPanel.tsx`
9. Add export rendering in `src/renderer/src/lib/printHTML.ts` (`frameToHTML`)

---

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Run `npm run build` before submitting; zero TypeScript errors required
- Update `CHANGELOG.md` under an `[Unreleased]` section
- Update `CLAUDE.md` if you add new IPC handlers or frame types

---

## Reporting Issues

Open an issue at [github.com/Figstranmedia/scriptorium/issues](https://github.com/Figstranmedia/scriptorium/issues).

Please include:
- macOS version and chip (Apple Silicon / Intel)
- Steps to reproduce
- Expected vs actual behavior
- Console output if available (View → Toggle Developer Tools)
