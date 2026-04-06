import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'

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
  aiProvider: store.get('aiProvider', 'claude') as string,
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
