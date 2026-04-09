# Scriptorium — Roadmap v1.1 → v2.0

> © 2026 Rafael E. Figueroa Pastrana, Raffael Figueroa Music LLC

Estado actual: **v1.0.0 — MVP completo** (BLOQUEs 1–8 implementados)

---

## v1.1 — Rigor Académico (en progreso)

### ✅ BLOQUE 9 — Sistema de Ecuaciones (KaTeX)
- Ecuaciones inline `$...$` y bloque `$$...$$` en el editor
- Renderizado en tiempo real con KaTeX (más rápido que MathJax)
- Botón en toolbar + shortcut `Alt+E`
- Numeración automática de ecuaciones
- Export correcto a PDF

### ⏳ BLOQUE 10 — Gráficos de Datos
- ECharts / Plotly embebido en el editor
- Interpretar ecuación → trazar gráfica 2D/3D
- Editor de datos (tablas → gráfico automático)
- Exportar como SVG (compatible Affinity Designer)

### ⏳ BLOQUE 11 — Generador de Imágenes AI
- Hugging Face Inference API (gratuita, sin costo de GPU)
- Modelos: FLUX.1-schnell, SDXL-Turbo
- Panel en sidebar: prompt → imagen → insertar en frame
- Caché local en carpeta `imagenes/` del proyecto

---

## v1.2 — Exportación Profesional

### ⏳ BLOQUE 12 — DOCX Export
- mammoth.js / docx npm package
- Estilos de párrafo → Word styles
- Ecuaciones KaTeX → OMML (Office Math)
- Imágenes embebidas
- Compatible Office 365 / LibreOffice

### ⏳ BLOQUE 13 — SVG/Affinity Export
- Export de página de maquetación como SVG
- Capas preservadas
- Compatible Affinity Designer 2

### ⏳ BLOQUE IMPORT-MEJORADA
- Word/DOCX import (mammoth.js)
- Extracción de imágenes del PDF (pdfjs-dist canvas render)
- Preservar tipografía en importación

---

## v1.3 — Mejoras de UX

### ⏳ BLOQUE 14 — Dark/Light theme toggle
- Sistema de temas CSS variables
- Tema claro (actual write mode) + tema oscuro completo

### ⏳ BLOQUE 15 — Corrector ortográfico
- Integración con sistema de diccionarios del OS
- Hunspell para español, inglés, francés

### ⏳ BLOQUE 16 — Shortcuts cheatsheet
- Panel `/` con lista de todos los atajos de teclado
- Buscable

---

## v2.0 — Plataforma

### ⏳ BLOQUE 17 — Colaboración en tiempo real
- CRDTs (Yjs) para edición colaborativa
- Sincronización por WebSocket
- Comentarios y sugerencias

### ⏳ BLOQUE 18 — Sistema de plugins
- API pública para extensiones de terceros
- Registro de plugins en GitHub

### ⏳ BLOQUE 19 — Windows / Linux builds
- electron-builder targets: win, linux AppImage

---

## Completed ✅

- BLOQUE 1 — Snap, guías, reglas
- BLOQUE 2 — Portada de libro (spread tapa+lomo+contraportada)
- BLOQUE 3 — Estilos de párrafo globales
- BLOQUE 4 — Multi-select & alignment
- BLOQUE 5 — Zoom / undo-redo / atajos / contextual menu
- BLOQUE 6.1 — Formas (rect/elipse/línea, SVG)
- BLOQUE 6.2 — Backgrounds & borders en frames
- BLOQUE 7 — Page strip con thumbnails
- BLOQUE 8 — Export PDF/PNG con marcas de corte
- TipTap en layout frames (edición inline rich-text)
- AI chat conversacional + razonamiento extendido
- Ollama auto-detect + instalador de modelos
- Affinity-style toolbar (fuentes, B/I/U, color)
- PDF drag-and-drop
- Save/Save As (⌘S/⌘⇧S)
- Project folder system + auto-compresión de chat
