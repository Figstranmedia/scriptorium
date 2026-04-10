# Changelog

All notable changes to Scriptorium are documented here.

> © 2026 Rafael E. Figueroa Pastrana, Raffael Figueroa Music LLC  
> Licensed under the MIT License.

---

## [Unreleased] — v1.1 in progress

### Added — BLOQUE 14: Dark / Light Theme
- CSS custom-property theme system (`--app-bg`, `--app-surface`, `--app-border`, `--app-text`, etc.)
- `data-theme="light"` attribute toggles the entire app chrome between dark (default) and light
- ☀ / ◗ toggle button in TitleBar; preference persisted via `getSettings/setSettings`
- TitleBar and DocTabsBar fully use CSS variables — instant theme switch with no flash
- Layout canvas chrome intentionally stays dark (InDesign/Affinity professional aesthetic)

### Added — BLOQUE 12: DOCX Export
- New **📝 DOCX** format in the Export modal (layout mode)
- Exports all text frames to a `.docx` file ordered by page then vertical position
- Per-frame typography preserved: bold, italic, font size, text alignment
- Page breaks inserted between layout pages
- Non-text frames (images, shapes, charts) noted as `[IMAGEN]` / `[FORMA]` / `[GRÁFICO]` placeholders
- Uses `docx` npm package; rendering in Electron main process via `export:docx` IPC handler

### Added — UX: Document Tabs + Tool Sidebar
- Document management moved from left sidebar to **browser-style horizontal tab bar** below TitleBar
- **Affinity-style vertical tool palette** (44 px) on the left of the layout canvas
  - SVG icons: Pointer, Text, Image, Rect, Ellipse, Line, Chart
  - Future tools shown dimmed: Table, Eyedropper, Hand, Zoom
  - Active tool highlighted with accent color; click again to return to pointer
- PageStrip now shows **spread groups** (Página 1 alone, Páginas 2,3 side-by-side, etc.)
- **Resizable sidebars**: drag the 4 px handle between PageStrip ↔ canvas ↔ StudioSidebar
- Capas tab auto-syncs to the page of the selected frame

### Added — BLOQUE 10: Data Charts (ECharts)
- New **LayoutChartFrame** type: embed interactive charts in layout pages
- Chart types: bar, line, area, pie, scatter
- Inline chart editor (double-click): editable data table, multiple series, title, legend, grid, color palettes
- 4 color palettes: Scriptorium, Pastel, Dark, Mono
- Toolbar button 📊 and keyboard shortcut `C` to draw chart frames
- SVG pre-render cache on each update for accurate PDF/PNG export
- Properties panel: chart type selector, position, dimensions, opacity

### Added — BLOQUE 13: SVG / Affinity Designer Export
- New **SVG / Affinity** export format in the Export modal
- Generates one `.svg` per page (`_p01.svg`, `_p02.svg`, …)
- Shapes → native SVG (`<rect>`, `<ellipse>`, `<line>`) with stroke-dasharray
- Images → `<image>` with `<clipPath>` for border-radius
- Text → `<foreignObject>` with styled HTML (editable in Affinity)
- Charts → embedded SVG from ECharts renderer
- Exact mm dimensions — print-ready in Affinity Designer 2 / Affinity Publisher 2

### Added — BLOQUE 9: KaTeX Equations
- Inline (`$...$`) and block (`$$...$$`) math in layout text frames
- Σ and Σ₌ toolbar buttons + insertion modal with live preview and quick-reference
- Double-click to edit any equation node
- Custom TipTap Node extensions: MathInline, MathBlock

---

## [1.0.0] — 2026-04-08

### Initial public release

Scriptorium is an Electron desktop app combining a rich-text academic/literary editor
with an InDesign-style layout engine, powered by Claude AI and local Ollama models.

---

### Writing Mode
- TipTap 2 rich-text editor with BubbleMenu formatting toolbar
- Paragraph styles: Body, Heading 1–4, Epigraph, Caption
- Bibliography manager — APA 7, MLA 9, Chicago 17, IEEE citation styles
- In-text citation insertion from the reference panel
- Table of contents generation
- Floating text boxes within write mode
- AI actions on selected text: Research, Suggest alternatives, Restructure, Replace

### Layout Mode (InDesign-style)
- Multi-page canvas with configurable page size (A4, Letter, A5, Legal)
- Draw text frames (`T`), image frames (`I`), shapes (`R`/`E`/`L`)
- Drag, resize, multi-select (Shift/⌘+click, rubber-band)
- Alignment toolbar: left/center/right/top/middle/bottom, distribute
- Text threading — chain frames to flow content across pages
- Per-frame typography: font family (all system fonts), size, weight, style, align, color, tracking
- TipTap rich-text editing inside layout frames
- Snap to guides and frames with visual orange snap lines
- Draggable guides from rulers (horizontal + vertical)
- Named paragraph styles applied to frames
- Layers panel, Z-index control, lock/unlock frames
- Master pages (create, apply, edit)
- Baseline grid overlay
- Preflight panel — detects overset text, empty frames, missing images
- Page strip with thumbnails and context menu
- Double-page spread management (right-click page strip)
- Undo / Redo (⌘Z / ⌘⇧Z, 50-step history)
- Context menu: duplicate, delete, lock, bring to front/back

### Shape Tool (BLOQUE 6.1)
- Rectangle (`R`), Ellipse (`E`), Line (`L`)
- Fill color, stroke color, stroke width, stroke style (solid/dashed/dotted)
- Corner radius for rectangles
- Opacity and Z-index control
- Shapes export as inline SVG in PDF/PNG

### Book Cover Mode (BLOQUE 2)
- Spread canvas: back cover + spine + front cover as one composition
- Automatic spine width calculation from page count and paper weight (80/90/115 g/m²)
- Format presets: 14×21, 15×23, 21×29.7 cm, or custom
- Zone overlays: bleed (red), spine (purple), safe-area guides (dashed)
- Full frame editing within the cover spread

### Import
- PDF import via dialog or drag-and-drop onto the document sidebar
- Text blocks extracted with position, font size, bold detection (pdfjs-dist)
- Automatic frame placement from PDF layout

### Export (BLOQUE 8)
- Write mode → PDF via Electron `printToPDF`
- Layout mode → PDF: frames converted to mm-accurate positioned HTML
- PNG per page: each page captured via `capturePage()` as a high-res PNG
- Crop marks / bleed control (0–10 mm) for print-ready PDFs
- Bibliography included in write-mode PDF export
- ExportModal: auto-detects write vs layout mode, format selector (PDF / PNG)

### AI Integration
- Conversational AI sidebar (Claude claude-sonnet-4-6 + local Ollama)
- Claude extended thinking — collapsible reasoning blocks visible to the user
- Auto-compression of long conversations → `investigacion.md` summary file
- Project folder system: `~/Documents/Scriptorium/{title}/` with `.scpt` + `.md` + `imagenes/`
- Research, writing suggestions, restructuring, text replacement — all in one chat
- AI Design panel: describe a frame change in natural language → AI applies it
- Ollama auto-detection on startup

### File Management
- Guardar (`⌘S`) / Guardar como (`⌘⇧S`) — saves `.scriptorium` JSON files
- Auto-save on every mutation via `electron-store`
- Document sidebar: list all open docs, rename, delete, PDF drag-and-drop
- Collapsible sidebars (document list + AI sidebar)

### Settings
- API key management for Anthropic Claude
- Ollama URL and model selector
- AI provider toggle: Claude ↔ Ollama

---

## Roadmap

- [ ] BLOQUE IMPORT-MEJORADA — Word/DOCX import (mammoth.js), PDF image extraction
- [ ] Shape connectors and arrows
- [ ] AI image/SVG generation in `imagenes/` project folder
- [ ] Table frames in layout mode
- [ ] Spell check integration
- [ ] Windows build and distribution
