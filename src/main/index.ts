import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

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
- Eres conciso pero completo; usas listas y encabezados cuando realmente ayudan`

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
