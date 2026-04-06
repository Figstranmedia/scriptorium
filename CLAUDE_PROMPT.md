# Scriptorium — Prompt de desarrollo para Claude Code

## Contexto del proyecto

Scriptorium es una aplicación de escritorio construida con **Electron + Vite + React + TypeScript + TailwindCSS**.
Su objetivo es ser una herramienta de escritura académica y diseño editorial con IA integrada (Anthropic Claude).
El objetivo de esta fase es convertir el modo de maquetación en algo comparable a **InDesign / Affinity Publisher**,
con especial foco en el diseño de libros completos (portada, lomo, contraportada, páginas interiores).

### Stack técnico
- Electron 33 + electron-vite
- React 18 + TypeScript
- TailwindCSS (clases utilitarias, sin compilador propio — usar solo clases base de Tailwind)
- TipTap (editor de texto enriquecido en modo escritura)
- electron-store (persistencia local)
- Anthropic SDK (IA)
- pdfjs-dist (importación de PDF)

### Archivos clave del modo layout
```
src/renderer/src/
  components/
    Layout/
      LayoutCanvas.tsx       ← Canvas principal, gestiona estado de frames y páginas
      LayoutPage.tsx         ← Renderiza una página individual con sus frames
      LayoutTextFrame.tsx    ← Componente de marco de texto (drag/resize/edit)
      LayoutImageFrame.tsx   ← Componente de marco de imagen (drag/resize)
      LayoutPropertiesPanel.tsx ← Panel derecho de propiedades del frame seleccionado
      MasterPagePanel.tsx    ← Gestión de páginas maestras
      LayersPanel.tsx        ← Panel de capas
      PreflightPanel.tsx     ← Verificación de problemas de impresión
    Editor/
      Editor.tsx             ← Contenedor del modo escritura + modo layout
      Toolbar.tsx            ← Barra de herramientas principal
      TextFrame.tsx          ← Marcos flotantes en modo escritura
  lib/
    threadEngine.ts          ← Motor de encadenado de texto entre frames
    preflight.ts             ← Lógica de preflight
    pdfImport.ts             ← Importación de PDF
    printHTML.ts             ← Exportación a PDF
    citations.ts             ← Gestión de referencias bibliográficas
  store/
    useStore.ts              ← Estado global (hook React simple)
```

### Lo que YA existe en el modo layout
- Canvas multipágina con scroll vertical
- Marcos de texto: drag, resize, edición doble clic, encadenado (threading) entre frames
- Marcos de imagen: drag, resize, fit/fill/crop
- Herramienta de dibujo: modo pointer / draw-text / draw-image con rubber-band
- Panel de propiedades: posición, tamaño, tipografía, padding, columnas, z-order, lock
- Páginas maestras: encabezado, pie, numeración de páginas
- Panel de capas
- Preflight (desbordamiento de texto, frames vacíos)
- Baseline grid (rejilla de línea base)
- Zoom fijo: 50%, 70%, 100%
- Importación de PDF (detecta bloques de texto)
- Exportación a PDF vía Electron printToPDF
- Tipos de página: A4, Letter, A5, Legal
- Fondo y borde de marcos: NO implementado
- Formas (rectángulo, línea, círculo): NO implementado

---

## Tareas a implementar — por orden de prioridad

Implementa cada bloque de forma incremental. No reescribas el proyecto desde cero;
extiende los archivos existentes. Mantén el código TypeScript estrictamente tipado.

---

### BLOQUE 1 — Reglas, guías y snap (CRÍTICO)

**Objetivo:** Que el usuario pueda colocar objetos con precisión milimétrica, igual que en InDesign.

**1.1 Reglas horizontales y verticales**
- Añadir una regla horizontal (arriba del canvas) y una regla vertical (izquierda del canvas) en `LayoutCanvas.tsx`
- Las reglas deben mostrar la escala en mm, adaptándose al zoom actual (`scale`)
- El cursor debe mostrar una línea de seguimiento cruzada en ambas reglas mientras se mueve sobre el canvas

**1.2 Guías arrastrables**
- Al hacer clic y arrastrar desde la regla horizontal → crear guía horizontal (línea azul punteada)
- Al hacer clic y arrastrar desde la regla vertical → crear guía vertical
- Las guías son por documento, se persisten en el store
- Al hacer doble clic en una guía → eliminarla
- Interfaz de tipo `Guide { id, axis: 'h'|'v', position: number }`

**1.3 Snap magnético**
- Al mover o redimensionar un frame, hacer snap a:
  - Guías del usuario (radio: 6px a la escala actual)
  - Bordes de otros frames (snap entre objetos)
  - Márgenes de la página
- Mostrar una línea roja/naranja temporal cuando el snap se activa
- Toggle de snap en la barra del canvas (tecla S o botón)

---

### BLOQUE 2 — Modo Portada de Libro

**Objetivo:** Crear un tipo de documento especial para diseñar la portada completa de un libro
(tapa delantera + lomo + contraportada) como una sola pieza horizontal, igual que en InDesign.

**2.1 Nuevo tipo de documento: `'cover'`**
- Añadir `'cover'` a `DocType` en `useStore.ts`
- En `NewDocModal.tsx`, añadir opción "Portada de libro" con un ícono de libro
- Al crear un documento de tipo `cover`, abrir directamente en modo layout con la configuración de portada

**2.2 CoverSetupPanel — configuración inicial**
- Panel o modal que aparece al crear una portada con los campos:
  - Formato de libro (seleccionable: 14×21 cm, 15×23 cm, 21×29.7 cm, o personalizado)
  - Número de páginas interiores (para calcular el grosor del lomo)
  - Tipo de papel (seleccionable: 80g, 90g, 115g) — cada uno tiene un grosor por página en mm
  - Fórmula del lomo: `grosor_lomo = num_paginas × grosor_por_hoja`
  - Sangrado (bleed) por defecto: 3mm en todos los lados
- Al confirmar, crear automáticamente una sola página horizontal cuya anchura es:
  `ancho_total = bleed_izq + ancho_contraportada + lomo + ancho_portada + bleed_der`
  y cuya altura es: `alto_total = bleed_sup + alto_libro + bleed_inf`

**2.3 Visualización de la portada**
- En la página de portada, dibujar sobre el canvas (no como frames, sino como overlay de guías de color):
  - Zona de sangrado (línea roja punteada, exterior)
  - Zona segura (línea azul punteada, interior)
  - División lomo izquierda y derecha (líneas verticales verdes con etiqueta "LOMO")
  - Centro del lomo marcado con línea punteada
- Añadir un badge en la barra del canvas que muestre: `Lomo: X.X mm`

**2.4 Frames iniciales automáticos**
- Al crear la portada, pre-poblar con frames de ejemplo:
  - Frame de imagen que ocupa toda la portada (fondo)
  - Frame de texto para el título (portada)
  - Frame de texto para el autor (portada)
  - Frame de texto para el título del lomo (rotado 90°)
  - Frame de texto para la contraportada (sinopsis)

---

### BLOQUE 3 — Estilos de párrafo globales

**Objetivo:** Poder definir estilos tipográficos con nombre (Cuerpo, Título de capítulo, Epígrafe, etc.)
y aplicarlos a frames. Al modificar un estilo, todos los frames que lo usen se actualizan.

**3.1 Modelo de datos**
```typescript
interface ParagraphStyle {
  id: string
  name: string
  fontFamily: 'serif' | 'sans' | 'mono'
  fontSize: number
  lineHeight: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right' | 'justify'
  textColor: string
  letterSpacing: number
  spaceAfter: number  // px de espacio después del párrafo
  firstLineIndent: number  // px de sangría primera línea
}
```
- Guardar los estilos en el documento (`Document.paragraphStyles?: ParagraphStyle[]`)
- Estilos por defecto al crear un documento: Cuerpo, Título 1, Título 2, Epígrafe, Pie de foto

**3.2 Panel de estilos**
- Nueva pestaña en el panel derecho del canvas: "Estilos" (icono Aa)
- Lista de estilos con: nombre, preview visual (texto de muestra), botones Editar / Eliminar
- Botón "Nuevo estilo" — abre un mini formulario inline
- Al editar un estilo → actualizar todos los `LayoutFrame` que tengan `paragraphStyleId === style.id`

**3.3 Aplicar estilo a un frame**
- En `LayoutPropertiesPanel.tsx`, añadir un selector dropdown "Estilo de párrafo" arriba de las propiedades tipográficas
- Al seleccionar un estilo, aplicar todos sus valores al frame y guardar `paragraphStyleId`
- Si el usuario modifica manualmente una propiedad tipográfica después de asignar un estilo → marcar el frame como "estilo sobreescrito" (badge naranja "+" junto al nombre del estilo)

---

### BLOQUE 4 — Multi-selección y herramientas de alineación

**Objetivo:** Seleccionar varios frames y alinearlos/distribuirlos, igual que en cualquier DTP.

**4.1 Multi-selección**
- Al hacer clic en el canvas en modo pointer con Shift → añadir/quitar frame de la selección
- Al arrastrar en área vacía del canvas → rubber-band selection (rectángulo de selección)
- Los frames seleccionados muestran handles de selección en azul
- Al mover uno → mover todos los seleccionados manteniendo distancias relativas
- `selectedFrameIds: string[]` (reemplazar o extender `selectedFrameId: string | null`)

**4.2 Barra de alineación**
- Cuando hay 2+ frames seleccionados, mostrar una mini-barra flotante encima del canvas con:
  - Alinear izquierdas, centros horizontales, derechas
  - Alinear arribas, centros verticales, abajos
  - Distribuir horizontalmente con espacio igual
  - Distribuir verticalmente con espacio igual
- La alineación se hace relativa al bounding box de la selección o a la página (toggle)

**4.3 Copiar/Pegar frames**
- Cmd/Ctrl+C → copiar frames seleccionados (guardar en estado local, no clipboard del sistema)
- Cmd/Ctrl+V → pegar con offset de +10px en X e Y
- Cmd/Ctrl+D → duplicar directamente (igual que pegar inmediatamente después de copiar)

---

### BLOQUE 5 — Mejoras de interacción esenciales

**5.1 Mover con teclas de flecha**
- Frame seleccionado: flechas = 1px, Shift+flechas = 10px
- Actualizar en `LayoutCanvas.tsx` el keydown handler existente

**5.2 Undo/Redo en modo layout**
- Implementar una pila de historial de acciones en `LayoutCanvas.tsx`
- Guardar snapshot del array `frames` antes de cada mutación
- Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo
- Límite de 50 estados en la pila

**5.3 Menú contextual (clic derecho)**
- Al hacer clic derecho sobre un frame seleccionado, mostrar un menú con:
  - Cortar / Copiar / Pegar / Duplicar / Eliminar
  - Traer al frente / Enviar al fondo / Subir un nivel / Bajar un nivel
  - Bloquear / Desbloquear
  - Propiedades del marco (hace scroll al panel de propiedades)

**5.4 Zoom fluido**
- Ctrl/Cmd + scroll del ratón = zoom in/out (rango: 25% — 400%)
- Botones de zoom actualizados para mostrar el valor actual en %
- Tecla 0 = zoom al 100%, tecla 1 = zoom a fit-page (ajustar la página al área visible)

---

### BLOQUE 6 — Formas básicas y decoración de frames

**6.1 Herramienta de formas**
- Añadir en la barra del canvas: herramienta Rectángulo (R) y Línea (L)
- Nuevo tipo de frame: `LayoutShapeFrame` con propiedades:
  ```typescript
  interface LayoutShapeFrame {
    id: string; type: 'shape'
    shape: 'rect' | 'line' | 'ellipse'
    x: number; y: number; width: number; height: number
    pageIndex: number; zIndex: number; locked: boolean
    fill: string; stroke: string; strokeWidth: number
    opacity: number; cornerRadius: number
  }
  ```
- Las formas se dibujan igual que los frames (rubber-band)
- Se incluyen en `AnyLayoutFrame`

**6.2 Fondo y borde de frames de texto**
- Añadir a `LayoutFrame`:
  ```typescript
  backgroundColor: string   // default: 'transparent'
  borderColor: string       // default: 'transparent'
  borderWidth: number       // default: 0
  borderStyle: 'solid' | 'dashed' | 'dotted'
  cornerRadius: number      // default: 0
  opacity: number           // default: 1
  ```
- Añadir estos controles en `LayoutPropertiesPanel.tsx` bajo una sección "Apariencia"
- Renderizar en `LayoutTextFrame.tsx` y `LayoutImageFrame.tsx`

---

### BLOQUE 7 — Panel de páginas (thumbnail strip)

**Objetivo:** Panel lateral izquierdo con miniaturas de todas las páginas, como en InDesign.

**7.1 Componente PageStrip**
- Nuevo componente `PageStrip.tsx` que va a la izquierda del canvas (ancho: ~96px)
- Renderiza cada página como un thumbnail SVG/canvas miniaturizado
- La página activa tiene borde azul
- Al hacer clic en una miniatura → scroll del canvas a esa página
- Número de página debajo de cada miniatura
- Botón "+" al final para añadir página

**7.2 Reordenar páginas**
- Drag-and-drop de miniaturas para cambiar el orden de las páginas
- Al reordenar → actualizar todos los `frame.pageIndex` de los frames afectados

**7.3 Insertar página en posición**
- Clic derecho sobre una miniatura → menú: "Insertar página antes", "Insertar página después", "Eliminar página"

---

### BLOQUE 8 — Exportación mejorada

**8.1 Exportar con sangrado**
- En `ExportModal.tsx`, añadir opciones:
  - Incluir sangrado (bleed): sí/no + valor en mm
  - Marcas de corte: sí/no
  - Exportar como: páginas individuales / spreads dobles / documento completo
- Usar Electron printToPDF con ajuste de márgenes negativos para incluir el bleed

**8.2 Exportar página como imagen**
- Añadir opción "Exportar como PNG" en el modal de exportación
- Usar `webContents.capturePage()` de Electron para capturar el canvas de cada página

---

## Notas de implementación

- **No usar localStorage** en ningún componente renderer — usar `window.api` (IPC) para persistencia
- **Tailwind:** Solo clases utilitarias base. No añadir plugins ni configuración nueva de Tailwind
- **TypeScript:** Mantener todos los tipos actualizados en `threadEngine.ts` y `useStore.ts`
- **Performance:** Los frames se renderizan con `position: absolute` dentro de cada `LayoutPage`. No usar canvas HTML5 para los frames en sí — mantener el enfoque actual basado en DOM
- **Persistencia:** Todo cambio de layout debe llamar a `saveLayout()` para persistir en `electron-store` vía IPC
- **IPC:** Los nuevos handlers de Electron van en `src/main/index.ts`. Los nuevos métodos de la API van en `src/preload/index.ts` bajo el objeto `api`

## Orden de implementación recomendado

1. Bloque 5.1 (flechas) + 5.4 (zoom scroll) — cambios pequeños, impacto inmediato
2. Bloque 1 (reglas + guías + snap) — base para todo lo demás
3. Bloque 6.2 (fondo/borde de frames) — muy demandado, fácil de implementar
4. Bloque 4 (multi-selección + alineación)
5. Bloque 5.2 + 5.3 (undo/redo + menú contextual)
6. Bloque 3 (estilos de párrafo)
7. Bloque 7 (panel de páginas)
8. Bloque 6.1 (formas)
9. Bloque 2 (modo portada de libro) — el más complejo, hacerlo último
10. Bloque 8 (exportación mejorada)
