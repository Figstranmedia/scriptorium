# Scriptorium — Contexto del Proyecto

> App de escritura académica/literaria con motor de maquetación estilo InDesign + IA integrada.
> Stack: Electron 33 · React 18 · TypeScript · TailwindCSS · TipTap · Claude API / Ollama

---

## Estructura del proyecto

```
src/
├── main/index.ts          ← Proceso principal: IPC, IA, archivos, exportación
├── preload/index.ts       ← Puente context bridge → window.api
└── renderer/src/
    ├── App.tsx            ← Raíz: tipos window.api, carga docs, rutas de vista
    ├── store/useStore.ts  ← Estado global (documentos, UI, tema, IA)
    ├── styles/index.css   ← Variables CSS de tema (dark/light)
    ├── components/
    │   ├── TitleBar.tsx          ← Menú Archivo / Edición / Vista
    │   ├── DocTabsBar.tsx        ← Pestañas estilo navegador
    │   ├── Editor/
    │   │   ├── Editor.tsx        ← Selector modo escritura ↔ maquetación
    │   │   ├── Toolbar.tsx       ← Barra formato TipTap
    │   │   └── TextFrame.tsx     ← Cajas de texto flotantes (modo escritura)
    │   ├── Layout/
    │   │   ├── LayoutCanvas.tsx        ← Controlador principal: estado, undo, IPC
    │   │   ├── LayoutPage.tsx          ← Página: marcos, guías, rubber-band
    │   │   ├── LayoutTextFrame.tsx     ← Marco de texto: drag/resize/edición
    │   │   ├── LayoutImageFrame.tsx    ← Marco de imagen: drag/resize/fit
    │   │   ├── LayoutShapeFrame.tsx    ← Formas: rect/ellipse/line
    │   │   ├── LayoutChartFrame.tsx    ← Gráficos ECharts
    │   │   ├── LayoutTableFrame.tsx    ← Tablas con edición inline por celda
    │   │   ├── LayoutPropertiesPanel.tsx ← Panel derecho: propiedades de marco
    │   │   ├── StudioSidebar.tsx       ← Panel derecho completo (pestañas)
    │   │   ├── ToolSidebar.tsx         ← Paleta de herramientas vertical (44px)
    │   │   ├── PageStrip.tsx           ← Tira de páginas / spreads izquierda
    │   │   ├── LayersPanel.tsx         ← Lista de capas por página
    │   │   ├── FontPicker.tsx          ← Selector de fuentes del sistema
    │   │   ├── AIDesignPanel.tsx       ← IA: describe → aplica cambios al marco
    │   │   ├── ContextMenu.tsx         ← Menú clic derecho
    │   │   ├── Rulers.tsx              ← Reglas H/V con guías arrastrables
    │   │   ├── MasterPagePanel.tsx     ← Páginas maestras
    │   │   └── PreflightPanel.tsx      ← Verificación de impresión
    │   └── Sidebar/
    │       ├── AISidebar.tsx           ← Chat IA investigación/sugerencia
    │       └── BibliographyPanel.tsx   ← Gestor de referencias (APA/MLA…)
    └── lib/
        ├── threadEngine.ts   ← Motor de enhebrado de texto + tipos AnyLayoutFrame
        ├── pdfImport.ts      ← PDF → bloques de texto o imágenes por página
        ├── docxImport.ts     ← DOCX HTML → bloques de texto para marcos
        ├── docxExport.ts     ← Marcos → datos para exportar a .docx
        ├── preflight.ts      ← Validación de layout antes de imprimir
        ├── printHTML.ts      ← Generación HTML/SVG para exportación
        ├── citations.ts      ← Formato de citas (APA/MLA/Chicago/IEEE)
        ├── snap.ts           ← Snap magnético a guías y marcos
        └── fontUtils.ts      ← Resolver nombre de familia → CSS font-family
```

---

## Tipos principales (`threadEngine.ts`)

### LayoutFrame (texto)
```typescript
interface LayoutFrame {
  id, x, y, width, height, pageIndex
  threadNextId, threadPrevId       // encadenamiento de texto
  ownContent: string               // HTML editable directo
  fontFamily, fontSize, lineHeight, fontWeight, fontStyle
  textAlign, textColor, letterSpacing
  columns, columnGutter
  paddingTop/Right/Bottom/Left
  backgroundColor, borderColor, borderWidth, borderStyle
  cornerRadius, opacity, zIndex, locked
}
```

### LayoutImageFrame
```typescript
interface LayoutImageFrame {
  id, x, y, width, height, pageIndex
  src: string   // base64 data URL
  fit: 'fill' | 'fit' | 'crop'
  caption, zIndex, locked, opacity, cornerRadius, borderColor, borderWidth
}
```

### LayoutShapeFrame
```typescript
interface LayoutShapeFrame {
  id, x, y, width, height, pageIndex
  shapeType: 'rect' | 'ellipse' | 'line'
  fillColor, strokeColor, strokeWidth, strokeDash
  cornerRadius, opacity, zIndex, locked
}
```

### LayoutChartFrame
```typescript
interface LayoutChartFrame {
  id, x, y, width, height, pageIndex
  chartType: 'bar' | 'line' | 'area' | 'pie' | 'scatter'
  chartData: { labels: string[]; datasets: ChartDataset[] }
  palette: string, title: string
  zIndex, locked, opacity
}
```

### LayoutTableFrame
```typescript
interface LayoutTableFrame {
  id, x, y, width, height, pageIndex
  rows, cols
  cells: LayoutTableCell[][]      // { text, bold, italic, bg, align, textColor }
  headerRow: boolean
  borderColor, borderWidth, cellPadding
  fontSize, fontFamily, textColor
  headerBg, evenRowBg
  zIndex, locked, opacity
}
```

### AnyLayoutFrame
```typescript
type AnyLayoutFrame = LayoutFrame | LayoutImageFrame | LayoutShapeFrame
                    | LayoutChartFrame | LayoutTableFrame
```

---

## IPC API (`window.api`)

| Método | Descripción |
|--------|-------------|
| `getSettings()` / `setSettings(s)` | Config general |
| `saveDocument(id, data)` | Guarda en electron-store |
| `loadDocuments()` | Carga todos |
| `saveDocumentAs(title, data)` | Diálogo "Guardar como" |
| `saveDocumentToPath(path, data)` | Guardar en ruta conocida |
| `pickImage()` | Seleccionar imagen → base64 |
| `importPDF()` | Seleccionar PDF → base64 |
| `importDOCX()` | Seleccionar .docx → HTML |
| `exportLayoutPDF(html, title)` | Exportar PDF maquetación |
| `exportPNGPages(pages, title)` | Exportar PNG por página |
| `exportLayoutSVG(svgPages, title)` | Exportar SVG / Affinity |
| `exportDocx(frames, title)` | Exportar .docx |
| `listFonts()` | Fuentes instaladas |
| `aiChat(messages, ctx)` | Claude extended thinking |
| `aiDesign(instruction, frameProps)` | IA → cambios al marco |
| `aiResearch / aiSuggest / aiRestructure / aiReplace` | Acciones IA |
| `ollamaAutodetect()` | Detectar Ollama local |
| `projectSaveFolder(...)` | Guardar proyecto como carpeta |

---

## Teclas de acceso directo (modo maquetación)

| Tecla | Acción |
|-------|--------|
| `T` | Marco de texto |
| `I` | Marco de imagen |
| `R` | Rectángulo |
| `E` | Elipse |
| `L` | Línea |
| `C` | Gráfico |
| `B` | Tabla |
| `S` | Toggle snap |
| `Esc` | Modo puntero / deseleccionar |
| `⌘Z` / `⌘⇧Z` | Deshacer / Rehacer |
| `⌘D` | Duplicar |
| `⌘A` | Seleccionar todo |
| `⌘E` | Exportar |
| `⌘S` / `⌘⇧S` | Guardar / Guardar como |
| `Delete` | Eliminar marcos seleccionados |
| `↑↓←→` | Mover 1px (+ Shift = 10px) |

---

## Importación

| Método | Acceso | Qué hace |
|--------|--------|----------|
| PDF (texto) | Toolbar o Archivo → Importar | pdfjs-dist extrae bloques de texto con posición |
| PDF (imágenes) | Toolbar o Archivo → Importar | Renderiza cada página a JPEG como marco imagen |
| Word / DOCX | Toolbar o Archivo → Importar | mammoth.js → HTML → marcos de texto por bloque |

---

## Exportación

| Formato | Acceso | Cómo funciona |
|---------|--------|---------------|
| PDF | `⌘E` → Maquetación | `printHTML.ts` genera HTML en mm → `printToPDF` |
| PNG por página | `⌘E` → Maquetación | Un `BrowserWindow` por página → `capturePage()` |
| SVG / Affinity | `⌘E` → Maquetación | `generateLayoutSVGPages()` → SVG nativo por página |
| DOCX | `⌘E` → Maquetación | `docx` npm → párrafos y saltos de página |

---

## Flujo de datos (maquetación)

```
LayoutCanvas (estado maestro)
  ├── frames: AnyLayoutFrame[]          ← todos los marcos de todas las páginas
  ├── guides: Guide[]                   ← guías H/V por posición en px
  ├── contentMap: Map<id, string>       ← contenido distribuido (enhebrado)
  ├── history: AnyLayoutFrame[][]       ← pila undo/redo (máx 50)
  └── saveLayout() → window.api.saveDocument()
        ↓
  LayoutPage (por cada página)
        ↓
  LayoutXxxFrame (por cada marco en esa página)
```

---

## Convenciones de código

- **Sin localStorage** — siempre usar `window.api` (IPC) para persistencia
- **Solo Tailwind** — sin CSS modules ni styled-components
- Todos los IPC handlers nuevos van en `src/main/index.ts` + `src/preload/index.ts`
- TypeScript estricto — mantener `threadEngine.ts` y `useStore.ts` actualizados
- `saveLayout()` debe llamarse tras toda mutación de marcos
- Marcos se renderizan como divs DOM (no canvas)

---

## Estado de implementación

### Completado ✅
- Modo escritura: TipTap, BubbleMenu, acciones IA, bibliografía, TOC
- Modo maquetación: draw mode, drag/resize, enhebrado, edición directa
- Multi-selección, rubber-band, alineación, copiar/pegar/duplicar
- Undo/Redo, atajos de teclado, zoom
- Selector de fuentes del sistema
- Panel IA Diseño (describe → IA aplica cambios)
- Snap magnético a guías/marcos, guías arrastrables desde reglas
- Tira de páginas (thumbnails), menú contextual, panel de capas
- Páginas maestras, preflight, cuadrícula de línea base
- Importación PDF (texto y como imágenes)
- Importación DOCX (mammoth.js)
- Exportación PDF, PNG, SVG/Affinity, DOCX
- Portada (CoverCanvas: tapa + lomo + contraportada)
- Chat IA conversacional con extended thinking
- Sistema de carpeta de proyecto (~/Documents/Scriptorium/{titulo}/)
- Guardar / Guardar como (⌘S / ⌘⇧S)
- Tema oscuro/claro (CSS variables, toggle en TitleBar)
- Pestañas estilo navegador (DocTabsBar)
- Paleta herramientas vertical estilo Affinity (ToolSidebar)
- Vista de spreads en PageStrip
- Sidebars redimensionables
- BLOQUE 6.1: Formas (rect/ellipse/line) con fill, stroke, cornerRadius
- BLOQUE 9: Ecuaciones KaTeX en marcos de texto
- BLOQUE 10: Gráficos ECharts (bar/line/area/pie/scatter)
- BLOQUE 13: Exportación SVG / Affinity Designer 2
- BLOQUE TABLE: Tablas con edición inline, Tab navigation, estilos

### Pendiente 🔲
- Release v1.1 — bump de versión, GitHub release
- BLOQUE 11 — Generador de imágenes IA (Pollinations.ai, UI en StudioSidebar)
- Panel propiedades tabla en LayoutPropertiesPanel
- Soporte tabla en printHTML.ts (exportación)

---

## Proveedores de IA

Configurables en Ajustes (`⌘,`):

| Proveedor | Modelo | Requisito |
|-----------|--------|-----------|
| Claude | `claude-sonnet-4-6` | API Key Anthropic |
| Ollama | cualquiera (Gemma, Llama…) | Servidor local en `localhost:11434` |

---

## Notas de arquitectura

- **Enhebrado de texto**: `distributeContent()` en `threadEngine.ts` divide HTML entre marcos encadenados. La exportación usa `frame.ownContent` directamente (limitación conocida).
- **Historial**: pila de snapshots JSON, máx 50 estados, con etiquetas por acción.
- **Snap**: `snapPosition()` en `snap.ts` se llama en cada actualización de posición. Líneas naranja visibles durante 600ms.
- **Exportación SVG**: `<foreignObject>` para texto, SVG nativo para formas, `<image>` para imágenes, `svgCache` para gráficos.
- **Tema**: `data-theme` attribute en el div raíz → CSS variables en `:root` y `[data-theme="light"]`.

---

*Última actualización: 2026-04-10*
