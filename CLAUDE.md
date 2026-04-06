# Scriptorium — AI Writing & Layout Desktop App

## What this is
Electron desktop app (Mac/Windows/Linux) combining a rich-text academic editor with an InDesign-style layout engine. AI-powered via Anthropic Claude API or local Ollama models.

## Quick start
```bash
npm install
npm run dev       # dev mode (hot reload)
npm run build     # production build
npm run dist:mac  # package .app + .dmg for macOS
```

## Stack
- **Electron 33** + **electron-vite** — desktop shell + build
- **React 18** + **TypeScript** — renderer UI
- **TailwindCSS** — utility styles (no extra plugins)
- **TipTap 2** — rich text editor (write mode)
- **electron-store** — persistent local storage (documents, settings)
- **Anthropic SDK** — Claude API (claude-sonnet-4-6)
- **pdfjs-dist 3.x** — PDF import with text extraction
- **font-list** — enumerate system-installed fonts

## Project structure
```
src/
  main/index.ts          ← Electron main process: IPC handlers, AI calls, file I/O
  preload/index.ts       ← Context bridge (window.api)
  renderer/src/
    App.tsx              ← Root: declares window.api types, loads docs, routes view
    store/useStore.ts    ← All global React state (documents, UI flags)
    components/
      Editor/
        Editor.tsx       ← TipTap editor + mode toggle (write ↔ layout)
        Toolbar.tsx      ← Format toolbar
        TextFrame.tsx    ← Floating text boxes in write mode
      Layout/
        LayoutCanvas.tsx ← Main layout controller: state, undo/redo, IPC, keyboard
        LayoutPage.tsx   ← Single page: frames, guides, rubber-band select, draw mode
        LayoutTextFrame.tsx  ← Text frame: drag/resize/edit (double-click to edit)
        LayoutImageFrame.tsx ← Image frame: drag/resize/fit modes
        LayoutPropertiesPanel.tsx ← Right panel: all frame properties
        LayersPanel.tsx      ← Layers list by page
        PageStrip.tsx        ← Left thumbnail strip
        FontPicker.tsx       ← Searchable system font dropdown
        AIDesignPanel.tsx    ← AI design assistant (describe → apply changes)
        ContextMenu.tsx      ← Right-click menu
        Rulers.tsx           ← Horizontal/vertical rulers (drag to create guides)
        MasterPagePanel.tsx  ← Master page CRUD
        PreflightPanel.tsx   ← Print/layout error checking
      Sidebar/
        AISidebar.tsx        ← AI research/suggest/restructure/replace panel
        BibliographyPanel.tsx ← Reference manager (APA/MLA/Chicago/IEEE)
      SettingsModal.tsx      ← API key + Ollama config
      ExportModal.tsx        ← PDF export options
    lib/
      threadEngine.ts    ← Text threading engine (distributes HTML across frame chains)
      pdfImport.ts       ← PDF parsing → LayoutFrames
      preflight.ts       ← Layout validation checks
      printHTML.ts       ← HTML generation for PDF export
      citations.ts       ← Citation formatting (APA/MLA/Chicago/IEEE)
      snap.ts            ← Magnetic snap to guides/frames
      fontUtils.ts       ← Font family name → CSS font-family resolver
```

## Key types (src/renderer/src/lib/threadEngine.ts)
```typescript
interface LayoutFrame {
  id, x, y, width, height, pageIndex
  threadNextId, threadPrevId       // text threading chain
  ownContent: string               // direct editable content (plain text)
  fontFamily: string               // 'serif'|'sans'|'mono' or any installed font name
  fontSize, lineHeight, fontWeight, fontStyle, textAlign, textColor, letterSpacing
  columns, columnGutter
  paddingTop/Right/Bottom/Left
  backgroundColor, borderColor, borderWidth, borderStyle, cornerRadius, opacity
  zIndex, locked
}

interface LayoutImageFrame {
  id, x, y, width, height, pageIndex
  src: string   // base64 data URL
  fit: 'fill'|'fit'|'crop'
  caption, zIndex, locked, opacity, cornerRadius, borderColor, borderWidth
}

interface Guide { id, axis: 'h'|'v', position: number }  // in page pixels
```

## IPC API (window.api in renderer)
```typescript
// Settings
getSettings() / setSettings(s)
// Documents
saveDocument(id, data) / loadDocuments() / deleteDocument(id)
// Files
pickImage()        → base64 data URL
importPDF()        → { data: base64, name: string }
// Fonts
listFonts()        → string[]   (all system-installed font names)
// Export
exportPDF(html, title)
// AI
aiResearch(text, ctx)
aiSuggest(text, ctx)
aiRestructure(text, docType)
aiReplace(text, instruction, ctx)
aiDesign(instruction, frameProps)  → { changes: Partial<LayoutFrame> }
// Ollama
ollamaListModels()
```

## AI provider config
Settings modal (`⚙` button) switches between:
- **Claude** — requires Anthropic API key (model: `claude-sonnet-4-6`)
- **Ollama** — local models via REST at `http://localhost:11434` (any model including Gemma)

Store keys: `aiProvider` ('claude'|'ollama'), `anthropicApiKey`, `ollamaModel`, `ollamaUrl`

## Layout mode — how it works
1. `LayoutCanvas` holds all `frames: AnyLayoutFrame[]` and `guides: Guide[]`
2. Each page rendered by `LayoutPage` (one per pageCount)
3. Frames render inside each page as absolutely-positioned divs
4. Text threading: `distributeContent()` in threadEngine splits HTML across chained frames
5. Direct editing: double-click a text frame → textarea overlay → saves to `frame.ownContent`
6. Snap: `snapPosition()` in snap.ts called on every frame position update
7. Undo/Redo: ref-based history stack of `frames[]` snapshots (limit 50)
8. Persistence: every mutation calls `saveLayout()` → `window.api.saveDocument()` → electron-store

## Coding conventions
- **No localStorage** — always use `window.api` (IPC) for persistence
- Tailwind only — no CSS modules, no styled-components
- All new IPC handlers go in `src/main/index.ts` + exposed in `src/preload/index.ts`
- TypeScript strict — keep `threadEngine.ts` and `useStore.ts` types updated
- Frames render as DOM divs (not canvas) — maintain this pattern
- `saveLayout()` must be called after every frame mutation

## Implemented features (do not re-implement)
- ✅ Write mode: TipTap editor, BubbleMenu, AI actions, bibliography, TOC, text frames
- ✅ Layout mode: draw mode (T/I keys), drag/resize, threading, direct editing
- ✅ Multi-selection, rubber-band, alignment toolbar, copy/paste/duplicate
- ✅ Undo/Redo (⌘Z/⌘⇧Z), keyboard shortcuts (arrows, zoom)
- ✅ System font picker (all installed fonts)
- ✅ AI Design panel (describe → AI applies changes to selected frame)
- ✅ Frame appearance: background, border, corner radius, opacity
- ✅ Snap to guides/frames, draggable guides from rulers
- ✅ Page strip (thumbnails), context menu, layers panel
- ✅ Master pages, preflight, baseline grid
- ✅ PDF import (pdfjs-dist, detects text blocks + font sizes)
- ✅ PDF export (Electron printToPDF), bibliography (APA/MLA/Chicago/IEEE)

## Pending (from CLAUDE_PROMPT.md — implement in order)
1. **Block 3** — Global paragraph styles (named styles like "Body", "Chapter Title")
2. **Block 2** — Book cover mode (tapa + lomo + contraportada as single spread)
3. **Block 6.1** — Shape tool (rectangle, line, ellipse frames)
4. **Block 8** — Enhanced export (bleed marks, PNG export per page)
