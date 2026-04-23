import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { homedir } from 'os'

const store = new Store()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8f7f4',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('web-contents-created', (_, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.scriptorium')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: Settings ───────────────────────────────────────────────────────────
ipcMain.handle('store:get-settings', () => ({
  anthropicApiKey: store.get('anthropicApiKey', '') as string,
  aiProvider: store.get('aiProvider', 'ollama') as string,
  ollamaModel: store.get('ollamaModel', 'llama3') as string,
  ollamaUrl: store.get('ollamaUrl', 'http://localhost:11434') as string,
}))

ipcMain.handle('store:set-settings', (_event, settings: Record<string, string>) => {
  Object.entries(settings).forEach(([k, v]) => store.set(k, v))
  return true
})

// Keep old get-api-key for compatibility
ipcMain.handle('store:get-api-key', () => store.get('anthropicApiKey', '') as string)
ipcMain.handle('store:set-api-key', (_event, key: string) => { store.set('anthropicApiKey', key); return true })

// ─── IPC: Documents ──────────────────────────────────────────────────────────
ipcMain.handle('store:save-document', (_event, id: string, data: object) => {
  const docs = (store.get('documents', {}) as Record<string, object>)
  docs[id] = { ...data, updatedAt: Date.now() }
  store.set('documents', docs)
  return true
})
ipcMain.handle('store:load-documents', () => store.get('documents', {}))
ipcMain.handle('store:delete-document', (_event, id: string) => {
  const docs = (store.get('documents', {}) as Record<string, object>)
  delete docs[id]
  store.set('documents', docs)
  return true
})

// ─── IPC: Save to file (Guardar / Guardar como) ──────────────────────────────
ipcMain.handle('doc:save-as', async (_event, title: string, data: object) => {
  const safeName = (title || 'documento').replace(/[/\\:*?"<>|]/g, '').trim() || 'documento'
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar documento como…',
    defaultPath: `${safeName}.scriptorium`,
    filters: [{ name: 'Scriptorium', extensions: ['scriptorium'] }],
  })
  if (canceled || !filePath) return { canceled: true }
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { filePath }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('doc:save-to-path', async (_event, filePath: string, data: object) => {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('doc:open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Abrir documento Scriptorium…',
    filters: [{ name: 'Scriptorium', extensions: ['scriptorium'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { canceled: true }
  const filePath = filePaths[0]
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    return { data, filePath }
  } catch (err: any) {
    return { error: `No se pudo leer el archivo: ${err.message}` }
  }
})

ipcMain.handle('doc:show-in-finder', async (_event, filePath: string) => {
  shell.showItemInFolder(filePath)
  return { success: true }
})

ipcMain.handle('doc:print', async () => {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length === 0) return { error: 'Sin ventana activa' }
  wins[0].webContents.print({ silent: false, printBackground: true })
  return { success: true }
})

// ─── IPC: PDF Export ─────────────────────────────────────────────────────────
ipcMain.handle('export:pdf', async (_event, html: string, title: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Exportar como PDF',
    defaultPath: `${title.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'documento'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { canceled: true }

  // Create hidden window to render and print
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  // Wait for fonts/images to load
  await new Promise(r => setTimeout(r, 800))

  try {
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' },
    })
    writeFileSync(filePath, pdfBuffer)
    printWin.destroy()
    return { success: true, filePath }
  } catch (err: unknown) {
    printWin.destroy()
    return { error: err instanceof Error ? err.message : 'Error al exportar PDF' }
  }
})

// ─── IPC: Layout PDF Export ──────────────────────────────────────────────────
ipcMain.handle('export:layout-pdf', async (_event, html: string, title: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Exportar maquetación como PDF',
    defaultPath: `${title.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'maquetacion'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { canceled: true }

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise(r => setTimeout(r, 1500))
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' },
    })
    writeFileSync(filePath, pdfBuffer)
    printWin.destroy()
    return { success: true, filePath }
  } catch (err: unknown) {
    printWin.destroy()
    return { error: err instanceof Error ? err.message : 'Error al exportar PDF de maquetación' }
  }
})

// ─── IPC: PNG per-page Export ─────────────────────────────────────────────────
ipcMain.handle('export:png-pages', async (
  _event,
  pages: Array<{ html: string; widthPx: number; heightPx: number }>,
  title: string
) => {
  const { canceled, filePath: folderPath } = await dialog.showSaveDialog({
    title: 'Exportar páginas como PNG — elige carpeta y nombre base',
    defaultPath: title.replace(/[^a-zA-Z0-9\s-]/g, '').trim() || 'paginas',
    buttonLabel: 'Exportar aquí',
  })
  if (canceled || !folderPath) return { canceled: true }

  const baseName = folderPath.replace(/\.\w+$/, '')
  const savedPaths: string[] = []

  for (let i = 0; i < pages.length; i++) {
    const { html, widthPx, heightPx } = pages[i]
    const capWin = new BrowserWindow({
      width: Math.round(widthPx),
      height: Math.round(heightPx),
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    try {
      await capWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await new Promise(r => setTimeout(r, 1000))
      const img = await capWin.webContents.capturePage()
      const pngPath = `${baseName}_p${String(i + 1).padStart(2, '0')}.png`
      writeFileSync(pngPath, img.toPNG())
      savedPaths.push(pngPath)
    } finally {
      capWin.destroy()
    }
  }

  return { success: true, paths: savedPaths, count: savedPaths.length }
})

// ─── IPC: Export SVG pages (Affinity Designer) ───────────────────────────────
ipcMain.handle('export:layout-svg', async (_event, svgPages: Array<{ svg: string; pageIndex: number }>, title: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Exportar SVG para Affinity Designer',
    defaultPath: `${title || 'layout'}_p01.svg`,
    filters: [{ name: 'SVG', extensions: ['svg'] }],
  })
  if (canceled || !filePath) return { canceled: true }

  try {
    const baseName = filePath.replace(/_?p\d+\.svg$/i, '').replace(/\.svg$/i, '')
    const savedPaths: string[] = []

    for (const { svg, pageIndex } of svgPages) {
      const svgPath = svgPages.length === 1
        ? (filePath.endsWith('.svg') ? filePath : `${filePath}.svg`)
        : `${baseName}_p${String(pageIndex + 1).padStart(2, '0')}.svg`
      writeFileSync(svgPath, svg, 'utf8')
      savedPaths.push(svgPath)
    }

    return { success: true, paths: savedPaths, count: savedPaths.length, filePath: savedPaths[0] }
  } catch (err: any) {
    return { error: err.message }
  }
})

// ─── IPC: DOCX export ────────────────────────────────────────────────────────
ipcMain.handle('export:docx', async (_event, frames: any[], title: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Exportar como DOCX',
    defaultPath: `${title || 'documento'}.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  })
  if (canceled || !filePath) return { canceled: true }

  try {
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel,
      AlignmentType, PageBreak,
    } = await import('docx')

    const children: any[] = []
    let currentPage = -1

    for (const frame of frames) {
      // Page break between pages
      if (frame.pageIndex !== currentPage && currentPage >= 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
      }
      currentPage = frame.pageIndex

      if (frame.type !== 'text' || !frame.content) continue

      const lines = frame.content.split('\n').filter((l: string) => l.trim())
      for (const line of lines) {
        const isBold   = frame.fontWeight === 'bold'
        const isItalic = frame.fontStyle === 'italic'
        const fontSize = Math.round((frame.fontSize ?? 12) * 2) // half-points

        const alignMap: Record<string, AlignmentType> = {
          left:    AlignmentType.LEFT,
          center:  AlignmentType.CENTER,
          right:   AlignmentType.RIGHT,
          justify: AlignmentType.JUSTIFIED,
        }
        const alignment = alignMap[frame.textAlign ?? 'left'] ?? AlignmentType.LEFT

        children.push(new Paragraph({
          alignment,
          children: [
            new TextRun({
              text: line,
              bold: isBold,
              italics: isItalic,
              size: fontSize,
            }),
          ],
        }))
      }
    }

    if (children.length === 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }))
    }

    const doc = new Document({ sections: [{ children }] })
    const buffer = await Packer.toBuffer(doc)
    writeFileSync(filePath, buffer)
    return { success: true, filePath }
  } catch (err: any) {
    return { error: err.message }
  }
})

// ─── IPC: DOCX Import (mammoth) ──────────────────────────────────────────────
ipcMain.handle('import:docx', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Importar documento Word',
    properties: ['openFile'],
    filters: [{ name: 'Word Document', extensions: ['docx', 'doc'] }],
  })
  if (canceled || !filePaths[0]) return null
  try {
    const mammoth = await import('mammoth')
    const buffer = readFileSync(filePaths[0])
    const result = await mammoth.convertToHtml({ buffer })
    const name = filePaths[0].split('/').pop()?.replace(/\.docx?$/i, '') || 'Documento'
    return { html: result.value, name, warnings: result.messages?.map((m: any) => m.message) || [] }
  } catch (err: any) {
    return { error: err.message }
  }
})

// ─── IPC: AI Image Generator (Pollinations.ai — no API key needed) ────────────
ipcMain.handle('ai:generate-image', async (_event, prompt: string, width: number, height: number, model: string) => {
  try {
    const seed = Math.floor(Math.random() * 999999)
    const encodedPrompt = encodeURIComponent(prompt)
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true&seed=${seed}`
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return { success: true, dataUrl: `data:${contentType};base64,${base64}` }
  } catch (err: any) {
    return { error: err.message }
  }
})

// ─── IPC: Fonts ──────────────────────────────────────────────────────────────
ipcMain.handle('fonts:list', async () => {
  try {
    const fontList = await import('font-list')
    const fonts = await fontList.getFonts({ disableQuoting: true })
    return fonts.sort()
  } catch {
    return []
  }
})

// ─── IPC: PDF Import ─────────────────────────────────────────────────────────
ipcMain.handle('pdf:read-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Importar PDF',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return null
  const buffer = readFileSync(filePaths[0])
  const name = filePaths[0].split('/').pop()?.replace(/\.pdf$/i, '') || 'Importado'
  return { data: buffer.toString('base64'), name }
})

// ─── IPC: Images ─────────────────────────────────────────────────────────────
ipcMain.handle('image:pick', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar imagen',
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    properties: ['openFile']
  })
  if (canceled || filePaths.length === 0) return null
  const buffer = readFileSync(filePaths[0])
  const ext = filePaths[0].split('.').pop()?.toLowerCase() || 'png'
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
  return `data:${mime};base64,${buffer.toString('base64')}`
})

// ─── AI: Unified caller ──────────────────────────────────────────────────────
async function callAI(prompt: string, maxTokens = 1024): Promise<string> {
  const provider = store.get('aiProvider', 'claude') as string

  if (provider === 'ollama') {
    const ollamaUrl = store.get('ollamaUrl', 'http://localhost:11434') as string
    const model = store.get('ollamaModel', 'llama3') as string
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, options: { num_predict: maxTokens } })
    })
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`)
    const json = await res.json() as { response: string }
    return json.response
  }

  // Claude
  const apiKey = store.get('anthropicApiKey', '') as string
  if (!apiKey) throw new Error('No API key configured. Ve a ⚙ Ajustes.')
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  })
  const content = message.content[0]
  return content.type === 'text' ? content.text : ''
}

// Multi-turn conversation for chat interface
async function callAIChat(
  system: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 2048
): Promise<string> {
  const provider = store.get('aiProvider', 'claude') as string

  if (provider === 'ollama') {
    const ollamaUrl = store.get('ollamaUrl', 'http://localhost:11434') as string
    const model = store.get('ollamaModel', 'llama3') as string
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        stream: false,
      })
    })
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
    const json = await res.json() as { message?: { content: string }; response?: string }
    return json.message?.content || json.response || ''
  }

  // Claude
  const apiKey = store.get('anthropicApiKey', '') as string
  if (!apiKey) throw new Error('No hay API key configurada. Ve a ⚙ Ajustes.')
  const client = new Anthropic({ apiKey })
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system,
    messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  })
  const c = msg.content[0]
  return c.type === 'text' ? c.text : ''
}

// ─── IPC: Conversational AI chat (with optional thinking) ────────────────────
ipcMain.handle('ai:chat', async (
  _event,
  messages: Array<{ role: string; content: string }>,
  docContext: { title: string; content: string; docType: string; conversationSummary?: string }
) => {
  try {
    const docSummary = docContext.content
      ? `\n\nContenido actual del documento:\n${docContext.content.slice(0, 10000)}`
      : '\n\n(Sin contenido de texto aún.)'

    const memorySection = docContext.conversationSummary
      ? `\n\nResumen de conversación previa (memoria comprimida):\n${docContext.conversationSummary}`
      : ''

    const system = `Eres un asistente editorial integrado en Scriptorium, software profesional de escritura y diseño de libros.

Documento activo: "${docContext.title}" — tipo: ${docContext.docType}${memorySection}${docSummary}

Tu rol:
- Conversas fluidamente en español sobre el proyecto del usuario
- Investigas, analizas el texto, sugieres estructuras, reescribes fragmentos, opinas editorialmente
- Lees el contenido completo cuando el análisis lo requiere
- Propones acciones proactivamente: "¿Profundizo en X?" o "Podría restructurar esto si quieres"
- Das opiniones directas y con criterio — no eres neutral cuando hay algo que mejorar
- Si el usuario pega texto para editar, lo editas y devuelves versión mejorada
- Para investigación, citas datos concretos con fuentes cuando puedes
- Eres conciso pero completo; usas listas y encabezados cuando realmente ayudan

ACCIONES DIRECTAS EN EL DOCUMENTO:
Cuando el usuario pida explícitamente crear o modificar algo en el documento, incluye bloques de acción al FINAL de tu respuesta usando este formato exacto (uno por línea, sin texto adicional entre ellos):

<action>{"type":"set_title","title":"Nuevo título del documento"}</action>
<action>{"type":"create_frame","content":"Contenido del nuevo marco de texto","page":0}</action>
<action>{"type":"replace_text","find":"texto a buscar","replace":"texto de reemplazo"}</action>

Reglas de uso:
- Solo incluye acciones cuando el usuario pida explícitamente modificar el documento ("crea", "añade", "cambia", "pon", "escribe en el documento", etc.)
- El usuario verá cada acción como un botón "Aplicar" — son propuestas, no cambios automáticos
- Para replace_text: "find" debe ser texto que existe en el documento
- Para create_frame: "content" puede incluir HTML básico (<b>, <i>, <p>, <br>)
- No incluyas acciones para análisis, sugerencias o respuestas informativas`

    const provider = store.get('aiProvider', 'claude') as string

    // Try Claude with extended thinking
    if (provider === 'claude') {
      const apiKey = store.get('anthropicApiKey', '') as string
      if (!apiKey) throw new Error('No hay API key configurada. Ve a ⚙ Ajustes.')
      const client = new Anthropic({ apiKey })

      try {
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 16000,
          thinking: { type: 'enabled', budget_tokens: 8000 },
          system,
          messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        } as Parameters<typeof client.messages.create>[0])

        let thinking = ''
        let result = ''
        for (const block of msg.content) {
          if (block.type === 'thinking') thinking = (block as any).thinking || ''
          if (block.type === 'text') result = block.text
        }
        return { result, thinking }
      } catch {
        // Fallback without thinking (older API version or unsupported)
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system,
          messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        })
        const c = msg.content[0]
        return { result: c.type === 'text' ? c.text : '' }
      }
    }

    // Ollama — no thinking, but simulate with chain-of-thought prefix
    const result = await callAIChat(system, messages)
    return { result }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC: Summarize conversation ─────────────────────────────────────────────
ipcMain.handle('ai:summarize-chat', async (
  _event,
  messages: Array<{ role: string; content: string }>,
  docTitle: string
) => {
  try {
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n\n')

    const summaryPrompt = `Eres un asistente de investigación. Tienes esta conversación entre un escritor y su asistente editorial sobre el documento "${docTitle}":

---
${transcript.slice(0, 12000)}
---

Genera un resumen en Markdown con:
1. **Temas discutidos** — lista de los principales temas abordados
2. **Hallazgos e insights clave** — conclusiones, datos, ideas importantes que emergieron
3. **Decisiones y cambios acordados** — qué decidió el escritor cambiar o hacer
4. **Preguntas abiertas** — temas que quedaron pendientes o sin resolver
5. **Próximos pasos** — acciones concretas sugeridas

Sé específico y útil. Este resumen se usará como memoria para continuar la conversación en sesiones futuras.`

    const result = await callAI(summaryPrompt, 2048)
    return { result }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC: Create/update project folder ───────────────────────────────────────
ipcMain.handle('project:save-folder', async (
  _event,
  docTitle: string,
  docData: object,
  investigacionMd: string,
  existingFolderPath?: string
) => {
  try {
    let folderPath = existingFolderPath

    if (!folderPath) {
      const safeTitle = docTitle.replace(/[/\\:*?"<>|]/g, '').trim() || 'sin-titulo'
      const defaultBase = join(app.getPath('documents'), 'Scriptorium')
      const defaultFolder = join(defaultBase, safeTitle)

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar carpeta del proyecto',
        defaultPath: defaultFolder,
        buttonLabel: 'Crear proyecto',
        properties: ['createDirectory'],
        nameFieldLabel: 'Nombre del proyecto:',
      })
      if (canceled || !filePath) return { canceled: true }
      folderPath = filePath
    }

    // Create directories
    mkdirSync(folderPath, { recursive: true })
    mkdirSync(join(folderPath, 'imagenes'), { recursive: true })

    // Save .scpt document
    const safeTitle = docTitle.replace(/[/\\:*?"<>|]/g, '').trim() || 'documento'
    const scptPath = join(folderPath, `${safeTitle}.scpt`)
    writeFileSync(scptPath, JSON.stringify(docData, null, 2), 'utf-8')

    // Save investigacion.md
    const mdPath = join(folderPath, 'investigacion.md')
    writeFileSync(mdPath, investigacionMd, 'utf-8')

    return { folderPath, scptPath, mdPath }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC: Update investigacion.md in existing project folder ─────────────────
ipcMain.handle('project:update-md', async (
  _event,
  folderPath: string,
  content: string
) => {
  try {
    if (!existsSync(folderPath)) return { error: 'Carpeta no encontrada' }
    const mdPath = join(folderPath, 'investigacion.md')
    writeFileSync(mdPath, content, 'utf-8')
    return { success: true }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ─── IPC: Ollama model list ───────────────────────────────────────────────────
ipcMain.handle('ollama:list-models', async () => {
  const ollamaUrl = store.get('ollamaUrl', 'http://localhost:11434') as string
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`)
    if (!res.ok) return { error: 'Ollama no disponible' }
    const json = await res.json() as { models: { name: string }[] }
    return { models: json.models.map((m) => m.name) }
  } catch {
    return { error: 'Ollama no disponible en ' + ollamaUrl }
  }
})

// ─── IPC: Ollama autodetect ───────────────────────────────────────────────────
// Called on startup — silently detects Ollama and picks the first available model
ipcMain.handle('ollama:autodetect', async () => {
  const ollamaUrl = store.get('ollamaUrl', 'http://localhost:11434') as string
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return { available: false }
    const json = await res.json() as { models: { name: string }[] }
    const models = json.models.map((m) => m.name)
    if (models.length === 0) return { available: true, models: [] }
    // Auto-select first model if none saved yet
    const currentModel = store.get('ollamaModel', '') as string
    if (!currentModel || !models.includes(currentModel)) {
      store.set('ollamaModel', models[0])
    }
    store.set('aiProvider', 'ollama')
    return { available: true, models, activeModel: store.get('ollamaModel') as string }
  } catch {
    return { available: false }
  }
})

// ─── IPC: Ollama pull model (streaming progress) ─────────────────────────────
ipcMain.handle('ollama:pull-model', async (event, modelName: string) => {
  const ollamaUrl = store.get('ollamaUrl', 'http://localhost:11434') as string
  try {
    const res = await fetch(`${ollamaUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    })
    if (!res.ok || !res.body) return { error: `Ollama respondió ${res.status}` }

    const reader = (res.body as any).getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line) as { status?: string; completed?: number; total?: number }
          const percent = (json.total ?? 0) > 0 ? Math.round(((json.completed ?? 0) / json.total!) * 100) : null
          const isDone = json.status === 'success'
          if (!event.sender.isDestroyed()) {
            event.sender.send('ollama:pull-progress', { status: json.status ?? '', percent, done: isDone })
          }
          if (isDone) {
            store.set('ollamaModel', modelName)
            store.set('aiProvider', 'ollama')
          }
        } catch { /* non-JSON line, ignore */ }
      }
    }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al descargar modelo' }
  }
})

// ─── IPC: AI actions ─────────────────────────────────────────────────────────
ipcMain.handle('ai:research', async (_event, selectedText: string, context: string) => {
  try {
    const result = await callAI(`You are a research assistant helping a writer verify and enrich their work.

Analyze this text and provide:
1. **Factual verification**: Are the claims accurate? Note any inaccuracies.
2. **Key concepts**: What are the main ideas and their academic/scientific context?
3. **Related research**: Suggest 3–5 real, reliable sources (books, journals, institutions) where the author can verify or deepen this topic.
4. **Contrasting perspectives**: Are there notable opposing views in the literature?

Keep your response concise and structured. Focus on what's most useful to a writer.

Document context:
"""${context.slice(0, 500)}"""

Selected text to analyze:
"""${selectedText}"""`)
    return { result }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
})

ipcMain.handle('ai:suggest', async (_event, selectedText: string, context: string) => {
  try {
    const result = await callAI(`You are a writing coach helping improve clarity and style.

Provide 3 alternative rewrites of the selected text. For each:
- Keep the original meaning
- Improve clarity, flow, or academic tone as appropriate
- Label as: Option A, Option B, Option C

Document context (for tone reference):
"""${context.slice(0, 400)}"""

Selected text to rewrite:
"""${selectedText}"""`)
    return { result }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
})

ipcMain.handle('ai:restructure', async (_event, selectedText: string, docType: string) => {
  try {
    const result = await callAI(`You are a document editor specializing in academic and literary structure.

The user is writing a ${docType}. Restructure the selected text to follow proper ${docType} conventions:
- Use appropriate headings and hierarchy
- Apply standard ${docType} structure (introduction, body, conclusion if applicable)
- Improve paragraph organization and transitions
- Return the restructured text as clean Markdown

Selected text to restructure:
"""${selectedText}"""`, 2048)
    return { result }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
})

ipcMain.handle('ai:design', async (_event, instruction: string, frameProps: object) => {
  try {
    const result = await callAI(`You are a graphic design assistant for a desktop publishing app (like InDesign).
The user has selected a design frame with these current properties:
${JSON.stringify(frameProps, null, 2)}

The user wants: "${instruction}"

Respond with ONLY a valid JSON object containing the properties to change.
Use these exact field names: fontSize, fontFamily, fontWeight (normal/bold), fontStyle (normal/italic),
textAlign (left/center/right/justify), textColor (hex), backgroundColor (hex or "transparent"),
borderColor (hex or "transparent"), borderWidth (number), borderStyle (solid/dashed/dotted),
cornerRadius (number), opacity (0-1), lineHeight (number), letterSpacing (number),
columns (1-4), paddingTop, paddingRight, paddingBottom, paddingLeft.

Only include fields that should actually change. No explanation, no markdown, ONLY the JSON object.

Examples:
User: "fondo azul marino, texto blanco, 18pt"
Response: {"backgroundColor":"#1a365d","textColor":"#ffffff","fontSize":18}

User: "centrar texto, fuente grande para título"
Response: {"textAlign":"center","fontSize":36,"fontWeight":"bold"}`, 512)
    // Extract JSON from response
    const match = result.match(/\{[\s\S]*\}/)
    if (!match) return { error: 'No se pudo interpretar la respuesta' }
    const changes = JSON.parse(match[0])
    return { changes }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error' }
  }
})

ipcMain.handle('ai:replace', async (_event, selectedText: string, instruction: string, context: string) => {
  try {
    const result = await callAI(`You are an editor. Apply this instruction to the selected text and return ONLY the modified text — no explanations, no quotes, just the result.

Instruction: ${instruction}

Document context:
"""${context.slice(0, 400)}"""

Selected text:
"""${selectedText}"""`)
    return { result }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
})

// ─── AI Layout (multi-frame, full-canvas) ────────────────────────────────────

ipcMain.handle('ai:design-layout', async (_event, data: {
  instruction: string
  frames: Array<{
    id: string; type: string; page: number
    xMM: number; yMM: number; wMM: number; hMM: number
    contentSnippet?: string; props: Record<string, any>
  }>
  pageWidthMM: number; pageHeightMM: number; pageCount: number
  selectedFrameId?: string
}) => {
  const frameList = data.frames.slice(0, 40).map((f, i) => {
    const pStr = Object.entries(f.props)
      .filter(([, v]) => v !== undefined && v !== '' && v !== 0)
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join(', ')
    return `  [${i + 1}] id="${f.id}" tipo=${f.type} pág=${f.page + 1} pos=(${Math.round(f.xMM)},${Math.round(f.yMM)})mm tam=${Math.round(f.wMM)}×${Math.round(f.hMM)}mm${f.contentSnippet ? ` contenido="${f.contentSnippet}"` : ''}${pStr ? ` | ${pStr}` : ''}`
  }).join('\n')

  const systemPrompt = `Eres el motor de diseño de una aplicación de maquetación editorial (como InDesign).
Tienes acceso TOTAL al layout: puedes editar propiedades de marcos, moverlos, redimensionarlos, crear nuevos o eliminar.

DOCUMENTO: ${data.pageCount} página(s) · ${data.pageWidthMM}×${data.pageHeightMM}mm
MARCOS (${data.frames.length} total${data.selectedFrameId ? `, seleccionado: "${data.selectedFrameId}"` : ''}):
${frameList || '  (sin marcos)'}

INSTRUCCIÓN: "${data.instruction}"

Responde SOLO con un objeto JSON válido, sin texto adicional, sin bloques de código markdown:
{
  "ops": [
    { "op": "update", "frameId": "ID", "props": { "fontSize": 14, "textColor": "#1a365d" } },
    { "op": "move",   "frameId": "ID", "xMM": 20, "yMM": 30, "wMM": 170, "hMM": 50 },
    { "op": "delete", "frameId": "ID" },
    { "op": "create", "type": "text", "page": 0, "xMM": 20, "yMM": 20, "wMM": 170, "hMM": 30,
      "props": { "ownContent": "Título", "fontSize": 18, "fontWeight": "bold", "textColor": "#fff", "backgroundColor": "#1a365d" } }
  ],
  "summary": "Descripción concisa de los cambios en español"
}

Propiedades editables (update/create): fontSize(pt), fontFamily(serif|sans|mono|nombre), fontWeight(normal|bold),
fontStyle(normal|italic), textAlign(left|center|right|justify), textColor(#hex), backgroundColor(#hex|transparent),
borderColor(#hex|transparent), borderWidth(px), borderStyle(solid|dashed|dotted), cornerRadius(px),
opacity(0–1), lineHeight, letterSpacing, columns(1–4), paddingTop/Right/Bottom/Left(px), ownContent(texto plano).

Reglas:
- Aplica cambios a TODOS los marcos afectados por la instrucción, no solo al primero.
- Para instrucciones globales ("todos los títulos", "cuerpo de texto", "fondo de página") busca patrones: fontSize grande = título, fontSize pequeño = cuerpo.
- Para crear un fondo de página usa: type="rect", xMM=0, yMM=0, wMM=pageWidthMM, hMM=pageHeightMM.
- Si el usuario pide "mover a la derecha/izquierda/arriba/abajo", desplaza xMM o yMM en ~10mm.
- No elimines marcos a menos que el usuario lo pida explícitamente.
- Si no hay nada que cambiar, devuelve ops:[].`

  try {
    const result = await callAI(systemPrompt, 1500)
    const match = result.match(/\{[\s\S]*\}/)
    if (!match) return { error: 'No se pudo interpretar la respuesta de diseño', ops: [] }
    const parsed = JSON.parse(match[0])
    return { ops: Array.isArray(parsed.ops) ? parsed.ops : [], summary: parsed.summary || '' }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error', ops: [] }
  }
})

// ─── Debate Multi-Agente ───────────────────────────────────────────────────────

let _debateController: AbortController | null = null

ipcMain.handle('debate:run', async (event, config: {
  topic: string
  agents: Array<{ id: string; name: string; emoji: string; color: string; systemPrompt: string }>
  maxRounds: number
  model: string
  docContent?: string       // document text (write mode + layout frames)
  researchContext?: string  // active reference .md files
}) => {
  if (_debateController) _debateController.abort()
  _debateController = new AbortController()
  const { signal } = _debateController

  const ollamaUrl = store.get('ollamaUrl', 'http://localhost:11434') as string
  const model = config.model || (store.get('ollamaModel', 'llama3') as string)

  const send = (data: object) => {
    if (!event.sender.isDestroyed()) event.sender.send('debate:event', data)
  }

  const callAgent = async (messages: Array<{role: string; content: string}>): Promise<string> => {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(120000),
    })
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
    const data = await res.json() as any
    return (data.message?.content || '').trim()
  }

  send({ type: 'start', topic: config.topic, model })

  // Build shared context block injected into every agent's system prompt
  const contextParts: string[] = []
  if (config.docContent?.trim()) {
    contextParts.push(`## Documento en edición\n${config.docContent.slice(0, 6000)}`)
  }
  if (config.researchContext?.trim()) {
    contextParts.push(`## Referencias de investigación activas\n${config.researchContext.slice(0, 6000)}`)
  }
  const sharedContext = contextParts.length
    ? `\n\n---\nCONTEXTO DEL PROYECTO (úsalo como base para tu razonamiento):\n\n${contextParts.join('\n\n')}\n---`
    : ''

  const histories: Record<string, Array<{role: string; content: string}>> = {}
  const roundTexts: Record<string, Record<number, string>> = {}
  for (const a of config.agents) { histories[a.id] = []; roundTexts[a.id] = {} }

  for (let round = 1; round <= config.maxRounds; round++) {
    if (signal.aborted) break
    send({ type: 'round_start', round, max: config.maxRounds })
    const roundResponses: Record<string, string> = {}

    for (const agent of config.agents) {
      if (signal.aborted) break
      send({ type: 'agent_start', agentId: agent.id, agentName: agent.name, agentEmoji: agent.emoji, agentColor: agent.color })

      const userMsg = round === 1
        ? `Debate iniciado. Tema central:\n${config.topic}\n\nPresenta tu perspectiva inicial con rigor. Señala lo que ves sólido y lo que ves problemático.`
        : `Ronda ${round}. Posiciones de los otros agentes en la ronda anterior:\n\n${
            config.agents
              .filter(a => a.id !== agent.id)
              .map(a => `**${a.name}**: ${roundTexts[a.id][round - 1]?.slice(0, 400) || '(sin respuesta)'}`)
              .join('\n\n')
          }\n\nResponde, refina o desafía. Avanza hacia una posición más precisa.`

      histories[agent.id].push({ role: 'user', content: userMsg })
      try {
        const text = await callAgent([
          { role: 'system', content: agent.systemPrompt + sharedContext },
          ...histories[agent.id],
        ])
        histories[agent.id].push({ role: 'assistant', content: text })
        roundResponses[agent.id] = text
        roundTexts[agent.id][round] = text

        // Emit word-by-word (simulated streaming from full response)
        const words = text.split(' ')
        for (let i = 0; i < words.length; i++) {
          if (signal.aborted) break
          send({ type: 'chunk', agentId: agent.id, text: words[i] + (i < words.length - 1 ? ' ' : '') })
        }
        send({ type: 'agent_done', agentId: agent.id, fullText: text })
      } catch (err: any) {
        if (signal.aborted) break
        send({ type: 'error', message: `Error en ${agent.name}: ${err.message}` })
      }
    }

    if (signal.aborted) break

    // Mediator: detect consensus
    if (round >= 2 && !signal.aborted) {
      send({ type: 'mediator_thinking' })
      try {
        const summary = config.agents
          .map(a => `${a.name}:\n${roundResponses[a.id]?.slice(0, 400) || ''}`)
          .join('\n\n')
        const mediatorText = await callAgent([
          { role: 'system', content: 'Eres un mediador científico. Analiza si los 3 agentes han alcanzado un acuerdo sustancial (no superficial) sobre el tema. Responde SOLO con JSON válido, sin texto extra: {"reached": false, "conclusion": "", "confidence": 0.0}' },
          { role: 'user', content: `Ronda ${round} de debate.\n\n${summary}\n\n¿Existe consenso real entre los 3 agentes?` },
        ])
        const jsonMatch = mediatorText.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0])
          send({ type: 'mediator_result', reached: analysis.reached || false, conclusion: analysis.conclusion || '', confidence: Number(analysis.confidence) || 0 })
          if (analysis.reached && Number(analysis.confidence) >= 0.65) {
            send({ type: 'consensus', conclusion: analysis.conclusion, confidence: Number(analysis.confidence), round })
            return { ok: true, consensus: true }
          }
        }
      } catch { /* ignore mediator errors */ }
    }
  }

  if (!signal.aborted) send({ type: 'end', rounds: config.maxRounds })
  return { ok: true, consensus: false }
})

ipcMain.handle('debate:stop', () => {
  if (_debateController) { _debateController.abort(); _debateController = null }
  return { ok: true }
})

// ─── Research Files ────────────────────────────────────────────────────────────

function getReferencesDir(folderPath?: string): string {
  if (folderPath) return join(folderPath, 'referencias')
  return join(homedir(), 'Documents', 'Scriptorium', 'Referencias')
}

ipcMain.handle('research:save-file', async (_event, folderPath: string | null, filename: string, content: string) => {
  try {
    const dir = getReferencesDir(folderPath || undefined)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const safeName = filename.replace(/[^\w\-. áéíóúñÁÉÍÓÚÑüÜ]/g, '_')
    const finalName = safeName.endsWith('.md') || safeName.endsWith('.txt') ? safeName : safeName + '.md'
    const filePath = join(dir, finalName)
    writeFileSync(filePath, content, 'utf-8')
    return { success: true, filePath, dir }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('research:list-files', async (_event, folderPath: string | null) => {
  try {
    const dir = getReferencesDir(folderPath || undefined)
    if (!existsSync(dir)) return { files: [], dir }
    const files = readdirSync(dir)
      .filter(f => f.endsWith('.md') || f.endsWith('.txt'))
      .map(f => {
        const fp = join(dir, f)
        const st = statSync(fp)
        return { name: f, path: fp, size: st.size, modified: st.mtimeMs }
      })
      .sort((a, b) => b.modified - a.modified)
    return { files, dir }
  } catch (err: any) {
    return { error: err.message, files: [], dir: '' }
  }
})

ipcMain.handle('research:read-file', async (_event, filePath: string) => {
  try {
    return { content: readFileSync(filePath, 'utf-8') }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('research:delete-file', async (_event, filePath: string) => {
  try {
    unlinkSync(filePath)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
})
