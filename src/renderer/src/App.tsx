import React, { useEffect, useCallback, useState } from 'react'
import { useStore } from './store/useStore'
import type { CoverConfig } from './store/useStore'
import { TitleBar } from './components/TitleBar'
import { DocSidebar } from './components/DocSidebar'
import { Editor } from './components/Editor/Editor'
import { AISidebar } from './components/Sidebar/AISidebar'
import { SettingsModal } from './components/SettingsModal'
import { NewDocModal } from './components/NewDocModal'
import { ExportModal } from './components/ExportModal'

declare global {
  interface Window {
    api: {
      getApiKey: () => Promise<string>
      setApiKey: (key: string) => Promise<boolean>
      getSettings: () => Promise<Record<string, string>>
      setSettings: (s: Record<string, string>) => Promise<boolean>
      saveDocument: (id: string, data: object) => Promise<boolean>
      loadDocuments: () => Promise<Record<string, object>>
      deleteDocument: (id: string) => Promise<boolean>
      pickImage: () => Promise<string | null>
      exportPDF: (html: string, title: string) => Promise<{ success?: boolean; canceled?: boolean; error?: string; filePath?: string }>
      exportLayoutPDF: (html: string, title: string) => Promise<{ success?: boolean; canceled?: boolean; error?: string; filePath?: string }>
      exportPNGPages: (pages: Array<{html: string; widthPx: number; heightPx: number}>, title: string) => Promise<{ success?: boolean; canceled?: boolean; error?: string; paths?: string[]; count?: number }>
      saveDocumentAs: (title: string, data: object) => Promise<{ filePath?: string; canceled?: boolean; error?: string }>
      saveDocumentToPath: (filePath: string, data: object) => Promise<{ success?: boolean; error?: string }>
      aiChat: (messages: Array<{role: string; content: string}>, docContext: object) => Promise<{ result?: string; thinking?: string; error?: string }>
      aiSummarizeChat: (messages: Array<{role: string; content: string}>, docTitle: string) => Promise<{ result?: string; error?: string }>
      projectSaveFolder: (docTitle: string, docData: object, investigacionMd: string, existingPath?: string) => Promise<{ folderPath?: string; scptPath?: string; mdPath?: string; canceled?: boolean; error?: string }>
      projectUpdateMd: (folderPath: string, content: string) => Promise<{ success?: boolean; error?: string }>
      ollamaListModels: () => Promise<{ models?: string[]; error?: string }>
      ollamaAutodetect: () => Promise<{ available: boolean; models?: string[]; activeModel?: string }>
      aiResearch: (text: string, ctx: string) => Promise<{ result?: string; error?: string }>
      aiSuggest: (text: string, ctx: string) => Promise<{ result?: string; error?: string }>
      aiRestructure: (text: string, docType: string) => Promise<{ result?: string; error?: string }>
      aiReplace: (text: string, instruction: string, ctx: string) => Promise<{ result?: string; error?: string }>
      importPDF: () => Promise<{ data: string; name: string } | null>
      listFonts: () => Promise<string[]>
      aiDesign: (instruction: string, frameProps: object) => Promise<{ changes?: Record<string, unknown>; error?: string }>
    }
  }
}

export default function App() {
  const store = useStore()
  const [showNewDoc, setShowNewDoc] = useState(false)

  useEffect(() => {
    const load = async () => {
      const key = await window.api.getApiKey()
      store.setApiKeyState(key)
      // Auto-detect Ollama on startup
      store.setOllamaStatus('checking')
      window.api.ollamaAutodetect().then((res) => {
        if (res.available) {
          store.setOllamaStatus('online')
          if (res.activeModel) store.setOllamaActiveModel(res.activeModel)
        } else {
          store.setOllamaStatus('offline')
        }
      }).catch(() => store.setOllamaStatus('offline'))
      const docs = await window.api.loadDocuments()
      const loaded = Object.values(docs) as any[]
      if (loaded.length > 0) {
        loaded.sort((a, b) => b.updatedAt - a.updatedAt)
        store.setDocuments(loaded)
        store.setActiveDocId(loaded[0].id)
      } else {
        store.createDocument('book')
      }
    }
    load()
  }, [])

  const handleSave = useCallback(async (id: string, data: object) => {
    await window.api.saveDocument(id, data)
  }, [])

  // Save current doc to its known file path; if none, open save-as dialog
  const handleSaveFile = useCallback(async () => {
    const doc = store.activeDoc
    if (!doc) return
    if (doc.filePath) {
      await window.api.saveDocumentToPath(doc.filePath, doc)
    } else {
      const res = await window.api.saveDocumentAs(doc.title, doc)
      if (res.filePath) {
        store.updateDocument(doc.id, { filePath: res.filePath })
        await window.api.saveDocument(doc.id, { ...doc, filePath: res.filePath })
      }
    }
  }, [store])

  const handleSaveAs = useCallback(async () => {
    const doc = store.activeDoc
    if (!doc) return
    const res = await window.api.saveDocumentAs(doc.title, doc)
    if (res.filePath) {
      store.updateDocument(doc.id, { filePath: res.filePath })
      await window.api.saveDocument(doc.id, { ...doc, filePath: res.filePath })
    }
  }, [store])

  // ⌘S / ⌘⇧S global shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (e.shiftKey) handleSaveAs()
        else handleSaveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSaveFile, handleSaveAs])

  const handleAIAction = useCallback((action: string, text: string) => {
    if (!text.trim()) return
    store.setSidebarOpen(true)
    store.setSelectedText(text)
    // Inject into chat as a pending message
    const actionLabels: Record<string, string> = {
      research: 'Investiga este fragmento',
      suggest: 'Sugiere alternativas para',
      restructure: 'Ayúdame a restructurar',
    }
    const label = actionLabels[action] || 'Analiza'
    store.setPendingChatMessage({ text: `${label}: "${text.slice(0, 400)}"`, action })
  }, [store])

  // Insert text at current editor cursor (for citations)
  const handleInsertCitation = useCallback((text: string) => {
    const insert = (window as any).__editorInsert
    if (insert) insert(text)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-ink-50 overflow-hidden">
      <TitleBar
        store={store}
        onNewDoc={() => setShowNewDoc(true)}
        onSave={handleSaveFile}
        onSaveAs={handleSaveAs}
        onCloseDoc={() => { if (store.activeDoc) store.deleteDocument(store.activeDoc.id) }}
      />

      <div className="flex flex-1 overflow-hidden">
        <DocSidebar store={store} onNewDoc={() => setShowNewDoc(true)} onSave={handleSave} />

        <main className="flex-1 overflow-hidden flex flex-col">
          {store.activeDoc ? (
            <Editor
              key={store.activeDoc.id}
              document={store.activeDoc}
              store={store}
              onAIAction={handleAIAction}
              onSave={handleSave}
              onInsertText={handleInsertCitation}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-400">
              <div className="text-center">
                <p className="text-4xl mb-4">✍️</p>
                <p className="font-serif text-xl text-ink-500">Ningún documento abierto</p>
                <button onClick={() => setShowNewDoc(true)} className="mt-4 px-5 py-2 bg-accent-500 text-white rounded-lg font-sans text-sm hover:bg-accent-600 transition">
                  Crear documento
                </button>
              </div>
            </div>
          )}
        </main>

        <AISidebar store={store} onSave={handleSave} onInsertCitation={handleInsertCitation} />
      </div>

      {store.showSettings  && <SettingsModal store={store} />}
      {store.showExport && store.activeDoc && (
        <ExportModal document={store.activeDoc} onClose={() => store.setShowExport(false)} />
      )}
      {showNewDoc && (
        <NewDocModal
          onClose={() => setShowNewDoc(false)}
          onCreate={(type, coverConfig?: CoverConfig) => {
            const doc = store.createDocument(type)
            if (coverConfig) {
              store.updateDocument(doc.id, { coverConfig, title: 'Portada sin título' })
            }
            setShowNewDoc(false)
          }}
        />
      )}
    </div>
  )
}
