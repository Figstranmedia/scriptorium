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

  // Export
  exportPDF: (html: string, title: string) => ipcRenderer.invoke('export:pdf', html, title),

  // Images
  pickImage: () => ipcRenderer.invoke('image:pick'),

  // Ollama
  ollamaListModels: () => ipcRenderer.invoke('ollama:list-models'),

  // AI
  aiResearch: (text: string, ctx: string) => ipcRenderer.invoke('ai:research', text, ctx),
  aiSuggest: (text: string, ctx: string) => ipcRenderer.invoke('ai:suggest', text, ctx),
  aiRestructure: (text: string, docType: string) => ipcRenderer.invoke('ai:restructure', text, docType),
  aiReplace: (text: string, instruction: string, ctx: string) => ipcRenderer.invoke('ai:replace', text, instruction, ctx),
})
