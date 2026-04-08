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
saveDocumentAs(title, data)     → { filePath?, canceled?, error? }
saveDocumentToPath(path, data)  → { success?, error? }
// Files
pickImage()        → base64 data URL
importPDF()        → { data: base64, name: string }
// Fonts
listFonts()        → string[]   (all system-installed font names)
// Export — Write mode
exportPDF(html, title)          → { success?, canceled?, error?, filePath? }
// Export — Layout mode (BLOQUE 8)
exportLayoutPDF(html, title)    → { success?, canceled?, error?, filePath? }
exportPNGPages(pages, title)    → { success?, canceled?, error?, paths?, count? }
  pages: Array<{ html: string; widthPx: number; heightPx: number }>
// AI — Conversational chat
aiChat(messages, docContext)    → { result?, thinking?, error? }  // Claude extended thinking
aiSummarizeChat(messages, title) → { result?, error? }
// AI — One-shot actions
aiResearch(text, ctx)
aiSuggest(text, ctx)
aiRestructure(text, docType)
aiReplace(text, instruction, ctx)
aiDesign(instruction, frameProps) → { changes: Partial<LayoutFrame> }
// Ollama
ollamaListModels() / ollamaAutodetect()
// Project folder
projectSaveFolder(title, data, investigacionMd, existingPath?) → { folderPath?, scptPath?, mdPath?, ... }
projectUpdateMd(folderPath, content) → { success?, error? }
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
- ✅ PDF drag-and-drop onto DocSidebar (via global `window.__triggerPDFImportWithData`)
- ✅ PDF export (Electron printToPDF), bibliography (APA/MLA/Chicago/IEEE)
- ✅ Book cover mode (CoverCanvas: tapa + lomo + contraportada, bleed/spine/safe-area overlays)
- ✅ AI conversational sidebar: chat, extended thinking display, auto-compression → investigacion.md
- ✅ Project folder system: ~/Documents/Scriptorium/{title}/ with .scpt + .md + imagenes/
- ✅ Guardar / Guardar como (⌘S / ⌘⇧S) — saves to user-chosen .scriptorium file path
- ✅ Collapsible sidebars (DocSidebar + AISidebar)
- ✅ Per-character typography in text frames (TipTap FontSize/FontFamily/Color extensions)
- ✅ Affinity-style floating toolbar when editing text frames
- ✅ BLOQUE 8: Layout → PDF export, PNG per-page export, crop marks / bleed control

## Export architecture (BLOQUE 8 — added 2026-04-08)
Two export paths live in `src/renderer/src/lib/printHTML.ts`:

1. **Write mode** (`generatePrintHTML`): HTML → hidden window → `printToPDF`. Classic flow.
2. **Layout mode** (`generateLayoutPrintHTML`): converts `doc.layoutFrames` to absolutely-positioned
   divs in mm units (px→mm via `pxToMm = px*25.4/96`), optional bleed box + crop marks.
   Rendered via `export:layout-pdf` IPC handler.
3. **PNG per page** (`export:png-pages`): one `BrowserWindow` per page (sized to page pixels),
   `capturePage()` → `toPNG()` → saved as `{base}_p01.png`, `{base}_p02.png`, etc.

`ExportModal` auto-selects "Maquetación" tab when `doc.layoutFrames.length > 0`.

## Known limitations / future work
- Layout PNG export: 1 window per page, ~1s delay each → slow for many pages.
  Future: use pdfjs-dist to render PDF pages to canvas instead.
- Threaded text frames: export uses `frame.ownContent` only — distributed/threaded content
  from `threadEngine.distributeContent()` is not captured at export time. Fix: snapshot
  `contentMap` into each frame at save time, or run distributeContent at export time.
- BLOQUE 6.1 (shape frames: rect/line/ellipse) — NOT yet implemented
- Release & documentation — NOT yet done

## Pending
1. **BLOQUE 6.1** — Shape tool (rectangle, line, ellipse as decorative frames)
2. **Release v1.0** — README update, CHANGELOG, version bump, GitHub release
3. **BLOQUE IMPORT-MEJORADA** — Word/DOCX import (mammoth.js), PDF image extraction
