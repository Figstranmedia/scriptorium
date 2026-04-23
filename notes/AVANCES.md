# Avances de desarrollo — Scriptorium

> Registro cronológico de cada bloque implementado.
> Actualizar con cada sesión de desarrollo.

---

## 2026-04-10 (sesión 3)

### BLOQUE AI LAYOUT — IA con acceso total al canvas de maquetación
- `AILayoutBar.tsx`: barra de comandos flotante en la parte inferior del canvas
  - Se activa con ⌘K o botón "✨ Layout" en la toolbar
  - Input de texto libre + sugerencias rápidas (chips)
  - Muestra resumen de operaciones aplicadas y se cierra automáticamente
- `ai:design-layout` IPC en `main/index.ts`:
  - Recibe TODOS los marcos con coordenadas en mm, tipo, contenido y propiedades
  - Prompt estructurado con operaciones: update, move, delete, create
  - Retorna `{ops: [...], summary: "..."}` — array de operaciones a aplicar
- `handleAILayout` en `LayoutCanvas.tsx`:
  - Convierte marcos px→mm, llama a la IA, convierte respuesta mm→px
  - Aplica en lote: update props, move/resize, delete, create (text/rect/ellipse/image)
  - Cada ejecución guarda un snapshot en el historial de undo/redo
  - Shortcut ⌘K para abrir/cerrar
- Botón "✨ Marco" (un marco) y "✨ Layout" (canvas completo) diferenciados en toolbar
- La IA puede: cambiar tipografía global, paletas de color, posiciones, crear fondos, alinear marcos, etc.

## 2026-04-10 (sesión 2)

### BLOQUE DEBATE — Motor de debate multi-agente
- `DebatePanel.tsx`: panel de debate integrado en el sidebar IA (pestaña ⚡)
  - Configuración de agentes: nombre, emoji, color, prompt de sistema (editable)
  - 3 agentes por defecto: Crítico / Sintetizador / Empírico (customizables)
  - Añadir/eliminar agentes, configurar tema, rondas (2-12), modelo Ollama
  - Debate en streaming: word-by-word desde la respuesta completa de Ollama
  - Detección de consenso vía mediador (call JSON a Ollama)
  - Exportar como `.txt` (descarga directa) o `.pdf` (usa IPC exportPDF)
  - Guardar en proyecto como `.md` en carpeta `referencias/`
- `main/index.ts`: handler `debate:run` (ipcMain.handle) con streaming via `event.sender.send('debate:event', ...)`
  - `debate:stop` cancela el debate via AbortController
  - Motor puro Node.js/fetch → Ollama `/api/chat`, sin dependencia Python

### BLOQUE RESEARCH FILES — Referencias PDF como Markdown
- `ResearchFilesPanel.tsx`: pestaña 📄 en el sidebar IA
  - Botón "⬆ PDF → MD": abre picker, extrae texto con pdfjs-dist, guarda como `.md`
  - Lista de archivos `.md`/`.txt` en `referencias/` del proyecto (o `~/Documents/Scriptorium/Referencias/`)
  - Toggle de contexto (+ / ✓): activa hasta N archivos como contexto adicional para el chat IA
  - Vista previa inline del contenido del archivo
  - Descarga y eliminación de archivos
  - Indicador "Referencias PDF activas" en el chat cuando hay contexto activo
- `main/index.ts`: handlers `research:save-file`, `research:list-files`, `research:read-file`, `research:delete-file`
- `AISidebar.tsx`: 2 nuevas pestañas (⚡ Debate, 📄 Referencias)
  - `researchContext` se inyecta en `getDocContext` y va al chat IA

## 2026-04-10 (sesión continuada)

### BLOQUE DOCUMENT SETUP — Modal de configuración del documento
- `DocumentSetupModal.tsx`: modal estilo Affinity Publisher con preview de página en vivo
  - Secciones: Dimensiones (preset A4/Carta/A5/Legal/Custom, anchura, altura, orientación)
  - Modelo (número de páginas, páginas enfrentadas)
  - Márgenes (interior/exterior/superior/inferior) con etiquetas dinámicas según facing pages
  - Sangrado uniforme
  - Preview miniatura con líneas de margen visualizadas
  - `buildSetupFromDocument(doc)` helper para precarga desde documento activo
- `useStore.ts`: añadidos campos `facingPages`, `marginTopMM`, `marginBottomMM`, `marginInnerMM`, `marginOuterMM`, `bleedMM` al tipo `Document`
- `App.tsx`: importa `DocumentSetupModal`, estado `showDocSetup`, callback `handleApplyDocSetup`
  - `handleApplyDocSetup` guarda todos los campos de setup en el documento activo vía `store.updateDocument`
  - Modal accesible desde `Archivo → Preferencias del documento`
- `TitleBar.tsx`: nueva prop `onDocSetup`, acción "Preferencias del documento" la invoca

### Fix: TDZ crash en App.tsx
- `handleOpenFile`, `handleShowInFinder`, `handlePrint` declarados ANTES del `useEffect` de atajos de teclado
- Comentario defensivo "MUST be after all handlers declared" en el useEffect

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

### Menú Archivo completo (estilo Affinity)
- **Abrir… (⌘O)**: diálogo nativo `.scriptorium` → carga y activa el documento
- **Abrir reciente**: submenu con los 5 docs más recientes (ya existía, reordenado)
- **Mostrar en Finder**: `shell.showItemInFolder` — activo solo cuando el doc tiene filePath
- **Imprimir… (⌘P)**: `BrowserWindow.print` nativo
- **Cerrar documento**: shortcut ⌘W agregado
- **Exportar**: submenu expandido con PDF, PNG, SVG/Affinity, Word/DOCX
- `store.upsertDocument()`: inserta o actualiza un doc por id
- IPC: `doc:open-file`, `doc:show-in-finder`, `doc:print`

### Fix: pantalla en blanco (TDZ crash)
- `useEffect` referenciaban `handleImportPDFAsImages` y `handleImportDOCX` antes de su declaración `const`
- Movidos los 3 `useEffect` de globals al final de la sección de importación

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
