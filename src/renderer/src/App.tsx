import React, { useEffect, useCallback, useState } from 'react'
import { useStore } from './store/useStore'
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
      ollamaListModels: () => Promise<{ models?: string[]; error?: string }>
      aiResearch: (text: string, ctx: string) => Promise<{ result?: string; error?: string }>
      aiSuggest: (text: string, ctx: string) => Promise<{ result?: string; error?: string }>
      aiRestructure: (text: string, docType: string) => Promise<{ result?: string; error?: string }>
      aiReplace: (text: string, instruction: string, ctx: string) => Promise<{ result?: string; error?: string }>
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

  const handleAIAction = useCallback(async (action: string, text: string) => {
    if (!text.trim()) return
    const docText = store.activeDoc?.content || ''
    const plainContext = docText.replace(/<[^>]+>/g, ' ').slice(0, 600)

    store.setSidebarOpen(true)
    store.setSelectedText(text)
    store.setAIResult({ type: action as any, loading: true, content: '', error: '' })
    store.setSidebarTab(action as any)

    let res: { result?: string; error?: string } = {}
    if (action === 'research')    res = await window.api.aiResearch(text, plainContext)
    else if (action === 'suggest') res = await window.api.aiSuggest(text, plainContext)
    else if (action === 'restructure') res = await window.api.aiRestructure(text, store.activeDoc?.docType || 'book')

    store.setAIResult({
      type: action as any,
      loading: false,
      content: res.result || '',
      error: res.error || '',
    })
  }, [store])

  // Insert text at current editor cursor (for citations)
  const handleInsertCitation = useCallback((text: string) => {
    const insert = (window as any).__editorInsert
    if (insert) insert(text)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-ink-50 overflow-hidden">
      <TitleBar store={store} onNewDoc={() => setShowNewDoc(true)} />

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

        {store.sidebarOpen && (
          <AISidebar store={store} onSave={handleSave} onInsertCitation={handleInsertCitation} />
        )}
      </div>

      {store.showSettings  && <SettingsModal store={store} />}
      {store.showExport && store.activeDoc && (
        <ExportModal document={store.activeDoc} onClose={() => store.setShowExport(false)} />
      )}
      {showNewDoc && (
        <NewDocModal onClose={() => setShowNewDoc(false)} onCreate={(type) => { store.createDocument(type); setShowNewDoc(false) }} />
      )}
    </div>
  )
}
