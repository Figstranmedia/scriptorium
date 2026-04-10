# Avances de desarrollo — Scriptorium

> Registro cronológico de cada bloque implementado.
> Actualizar con cada sesión de desarrollo.

---

## 2026-04-10

### BLOQUE TABLE — Tablas en modo maquetación
- Nuevo tipo `LayoutTableFrame` en `threadEngine.ts` (rows, cols, cells[][], headerRow, headerBg, evenRowBg)
- Componente `LayoutTableFrame.tsx`: drag, 8 handles de resize, edición inline por celda con Tab/Enter/Escape
- Herramienta habilitada en `ToolSidebar.tsx` (icono tabla, tecla `B`, color naranja)
- `handleAddTableFrame` en `LayoutCanvas.tsx`
- Shortcut de teclado: `B`
- Renderizado en `LayoutPage.tsx` (primer tipo chequeado antes de chart/shape/image)

### BLOQUE IMPORT-MEJORADA — Importación DOCX y PDF como imágenes
- `docxImport.ts`: `parseDocxHTML()` — mammoth HTML → bloques con fontSize/fontWeight/isHeading
- `handleImportDOCX` en `LayoutCanvas.tsx`: fluye bloques en páginas respetando márgenes
- `renderPDFToImages()` en `pdfImport.ts`: pdfjs-dist canvas → JPEG base64 a 1.5× por página
- `handleImportPDFAsImages` en `LayoutCanvas.tsx`: crea un marco imagen por página PDF
- Toolbar: botones **⬆ PDF**, **⬆ PDF img**, **⬆ DOCX**
- Menú **Archivo → Importar**: PDF (texto), PDF (imágenes), Word/DOCX
- Globals de ventana: `__triggerPDFImport`, `__triggerPDFImportAsImages`, `__triggerDOCXImport`

### Vault Obsidian conectado
- `notes/` como vault de Obsidian dentro del proyecto
- `CONTEXTO.md` — referencia completa de arquitectura, tipos, IPC API, atajos
- `AVANCES.md` — este archivo

---

## 2026-04-09 (sesión anterior)

### UX: Rediseño de interfaz estilo Affinity
- `DocTabsBar.tsx`: pestañas de documentos estilo navegador (reemplaza DocSidebar lateral)
- `ToolSidebar.tsx`: paleta vertical 44px (pointer, text, image, rect, ellipse, line, chart, table)
- `PageStrip.tsx`: vista de spreads — páginas agrupadas en pares `[0], [1,2], [3,4]…`
- Sidebars redimensionables mediante divisores de 4px (orange on hover)
- Auto-sync panel Capas → `setActivePageIndex` al seleccionar marco

### BLOQUE 14 — Tema oscuro/claro
- Variables CSS en `:root` y `[data-theme="light"]` en `styles/index.css`
- `data-theme` en div raíz de App.tsx
- Toggle ☀/◗ en TitleBar
- Persiste en `electron-store` vía `setSettings({ theme })`

### BLOQUE 12 — Exportación DOCX
- `docxExport.ts`: `framesToDocxData()` — marcos → datos para `docx` npm
- IPC `export:docx` en `main/index.ts` con `docx` (Document, Packer, TextRun, PageBreak)
- Opción "DOCX" en ExportModal

### BLOQUE 11 — Generador de imágenes IA (Pollinations.ai)
- IPC `ai:generate-image` en main usando Pollinations.ai (sin API key)
- `aiGenerateImage` expuesto en preload y declarado en `window.api`
- UI pendiente en StudioSidebar → pestaña Imágenes IA

---

## Sesiones anteriores

### BLOQUE 13 — SVG / Affinity Designer 2
- `generateLayoutSVGPages()` en `printHTML.ts`
- SVG nativo por página (mm units), `<foreignObject>` para texto
- IPC `export:layout-svg`, opción en ExportModal

### BLOQUE 10 — Gráficos ECharts
- `LayoutChartFrame` + `LayoutChartFrameComp`
- Tipos: bar, line, area, pie, scatter
- Editor de datos inline, 4 paletas de color
- `svgCache` para exportación SVG
- Tecla `C`

### BLOQUE 9 — Ecuaciones KaTeX
- Extensiones TipTap `MathInline` y `MathBlock`
- Modal con preview en vivo
- Botones Σ/Σ₌ en toolbar

### BLOQUE 8 — Exportación de maquetación
- `exportLayoutPDF`, `exportPNGPages`, crop marks, sangría
- ExportModal con pestaña Maquetación

### BLOQUE 6.1 — Formas vectoriales
- `LayoutShapeFrame` (rect/ellipse/line)
- Fill, stroke, dasharray, cornerRadius
- Teclas: R / E / L

### Funcionalidades base
- Motor TipTap (modo escritura) + Motor de maquetación (modo layout)
- Enhebrado de texto entre marcos
- Undo/Redo (pila de 50 snapshots)
- Snap magnético + guías arrastrables desde reglas
- Páginas maestras, preflight, cuadrícula de línea base
- Chat IA con extended thinking (Claude) + Ollama local
- Sistema de proyecto en carpeta (`~/Documents/Scriptorium/{título}/`)
- Bibliografía (APA/MLA/Chicago/IEEE)

---

*Actualizar al inicio de cada sesión con los BLOQUEs completados.*
