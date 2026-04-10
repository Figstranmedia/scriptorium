import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Settings
  getSettings: () => ipcRenderer.invoke('store:get-settings'),
  setSettings: (s: Record<string, string>) => ipcRenderer.invoke('store:set-settings', s),
  getApiKey: () => ipcRenderer.invoke('store:get-api-key'),
  setApiKey: (key: string) => ipcRenderer.invoke('store:set-api-key', key),

  // Documents
  saveDocument: (id: string, data: object) => ipcRenderer.invoke('store:save-document', id, data),
  loadDocuments: () => ipcRenderer.invoke('store:load-documents'),
  deleteDocument: (id: string) => ipcRenderer.invoke('store:delete-document', id),
  saveDocumentAs: (title: string, data: object) => ipcRenderer.invoke('doc:save-as', title, data),
  saveDocumentToPath: (filePath: string, data: object) => ipcRenderer.invoke('doc:save-to-path', filePath, data),
  openFile: () => ipcRenderer.invoke('doc:open-file'),
  showInFinder: (filePath: string) => ipcRenderer.invoke('doc:show-in-finder', filePath),
  printDoc: () => ipcRenderer.invoke('doc:print'),

  // Export
  exportPDF: (html: string, title: string) => ipcRenderer.invoke('export:pdf', html, title),
  exportLayoutPDF: (html: string, title: string) => ipcRenderer.invoke('export:layout-pdf', html, title),
  exportPNGPages: (pages: Array<{html: string; widthPx: number; heightPx: number}>, title: string) =>
    ipcRenderer.invoke('export:png-pages', pages, title),
  exportLayoutSVG: (svgPages: Array<{svg: string; pageIndex: number}>, title: string) =>
    ipcRenderer.invoke('export:layout-svg', svgPages, title),
  exportDocx: (frames: any[], title: string) =>
    ipcRenderer.invoke('export:docx', frames, title),

  // Import
  importDOCX: () => ipcRenderer.invoke('import:docx'),

  // AI Image
  aiGenerateImage: (prompt: string, width: number, height: number, model: string) =>
    ipcRenderer.invoke('ai:generate-image', prompt, width, height, model),

  // Images
  pickImage: () => ipcRenderer.invoke('image:pick'),

  // PDF Import
  importPDF: () => ipcRenderer.invoke('pdf:read-file'),

  // Ollama
  ollamaListModels: () => ipcRenderer.invoke('ollama:list-models'),
  ollamaAutodetect: () => ipcRenderer.invoke('ollama:autodetect'),
  ollamaPullModel: (modelName: string) => ipcRenderer.invoke('ollama:pull-model', modelName),
  onOllamaPullProgress: (cb: (data: { status: string; percent: number | null; done: boolean }) => void) => {
    ipcRenderer.on('ollama:pull-progress', (_e, data) => cb(data))
  },
  offOllamaPullProgress: () => ipcRenderer.removeAllListeners('ollama:pull-progress'),

  // AI Chat (conversational, with thinking)
  aiChat: (messages: Array<{role: string; content: string}>, docContext: object) =>
    ipcRenderer.invoke('ai:chat', messages, docContext),
  aiSummarizeChat: (messages: Array<{role: string; content: string}>, docTitle: string) =>
    ipcRenderer.invoke('ai:summarize-chat', messages, docTitle),
  projectSaveFolder: (docTitle: string, docData: object, investigacionMd: string, existingPath?: string) =>
    ipcRenderer.invoke('project:save-folder', docTitle, docData, investigacionMd, existingPath),
  projectUpdateMd: (folderPath: string, content: string) =>
    ipcRenderer.invoke('project:update-md', folderPath, content),

  // AI
  aiResearch: (text: string, ctx: string) => ipcRenderer.invoke('ai:research', text, ctx),
  aiSuggest: (text: string, ctx: string) => ipcRenderer.invoke('ai:suggest', text, ctx),
  aiRestructure: (text: string, docType: string) => ipcRenderer.invoke('ai:restructure', text, docType),
  aiReplace: (text: string, instruction: string, ctx: string) => ipcRenderer.invoke('ai:replace', text, instruction, ctx),

  // Fonts
  listFonts: () => ipcRenderer.invoke('fonts:list'),

  // AI Design
  aiDesign: (instruction: string, frameProps: object) => ipcRenderer.invoke('ai:design', instruction, frameProps),
})
