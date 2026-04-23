import React, { useEffect, useCallback, useState } from 'react'
import { useStore } from './store/useStore'
import type { CoverConfig } from './store/useStore'
import { TitleBar } from './components/TitleBar'
import { DocTabsBar } from './components/DocTabsBar'
import { Editor } from './components/Editor/Editor'
import { AISidebar } from './components/Sidebar/AISidebar'
import type { DocAction } from './components/Sidebar/AISidebar'
import { SettingsModal } from './components/SettingsModal'
import { NewDocModal } from './components/NewDocModal'
import { ExportModal } from './components/ExportModal'
import { DocumentSetupModal, buildSetupFromDocument } from './components/DocumentSetupModal'
import type { DocumentSetup } from './components/DocumentSetupModal'
import { OllamaSetupBanner } from './components/OllamaSetupBanner'
import { ModelSetupModal } from './components/ModelSetupModal'

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
      exportLayoutSVG: (svgPages: Array<{svg: string; pageIndex: number}>, title: string) => Promise<{ success?: boolean; canceled?: boolean; error?: string; paths?: string[]; count?: number; filePath?: string }>
      exportDocx: (frames: any[], title: string) => Promise<{ success?: boolean; canceled?: boolean; error?: string; filePath?: string }>
      importDOCX: () => Promise<{ html: string; name: string; warnings?: string[]; error?: string } | null>
      aiGenerateImage: (prompt: string, width: number, height: number, model: string) => Promise<{ success?: boolean; dataUrl?: string; error?: string }>
      ollamaPullModel: (modelName: string) => Promise<{ success?: boolean; error?: string }>
      onOllamaPullProgress: (cb: (data: { status: string; percent: number | null; done: boolean }) => void) => void
      offOllamaPullProgress: () => void
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
      aiDesignLayout: (data: object) => Promise<{ ops?: any[]; summary?: string; error?: string }>
      openFile: () => Promise<{ data?: any; filePath?: string; canceled?: boolean; error?: string }>
      showInFinder: (filePath: string) => Promise<{ success?: boolean }>
      printDoc: () => Promise<{ success?: boolean; error?: string }>
      debateRun: (config: object) => Promise<{ ok?: boolean; consensus?: boolean; error?: string }>
      debateStop: () => Promise<{ ok?: boolean }>
      onDebateEvent: (cb: (data: any) => void) => void
      offDebateEvent: () => void
      researchSaveFile: (folderPath: string | null, filename: string, content: string) => Promise<{ success?: boolean; filePath?: string; dir?: string; error?: string }>
      researchListFiles: (folderPath: string | null) => Promise<{ files: Array<{name: string; path: string; size: number; modified: number}>; dir?: string; error?: string }>
      researchReadFile: (filePath: string) => Promise<{ content?: string; error?: string }>
      researchDeleteFile: (filePath: string) => Promise<{ success?: boolean; error?: string }>
    }
  }
}

export default function App() {
  const store = useStore()
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [showDocSetup, setShowDocSetup] = useState(false)
  const [ollamaBanner, setOllamaBanner] = useState<'not-running' | 'no-models' | null>(null)
  const [showModelSetup, setShowModelSetup] = useState(false)
  const [installedModels, setInstalledModels] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const key = await window.api.getApiKey()
      store.setApiKeyState(key)
      // Auto-detect Ollama on startup
      store.setOllamaStatus('checking')
      window.api.ollamaAutodetect().then((res) => {
        if (res.available) {
          store.setOllamaStatus('online')
          const models = res.models ?? []
          setInstalledModels(models)
          if (res.activeModel) {
            store.setOllamaActiveModel(res.activeModel)
            // All good — no banner needed
          } else if (models.length === 0) {
            // Ollama running but no models → show blue banner
            setOllamaBanner('no-models')
          }
        } else {
          store.setOllamaStatus('offline')
          // Only show banner if Claude key is also empty (otherwise Claude is the active provider)
          const savedKey = store.apiKey
          if (!savedKey) setOllamaBanner('not-running')
        }
      }).catch(() => {
        store.setOllamaStatus('offline')
        if (!store.apiKey) setOllamaBanner('not-running')
      })
      const docs = await window.api.loadDocuments()
      const loaded = Object.values(docs) as any[]
      if (loaded.length > 0) {
        loaded.sort((a, b) => b.updatedAt - a.updatedAt)
        store.setDocuments(loaded)
        store.setActiveDocId(loaded[0].id)
      } else {
        store.createDocument('book')
      }
      // Load saved theme preference
      const settings = await window.api.getSettings()
      if (settings.theme === 'light') store.setTheme('light')
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

  const handleOpenFile = useCallback(async () => {
    const res = await window.api.openFile()
    if (res.canceled || !res.data) return
    if (res.error) { alert(res.error); return }
    const doc = res.data as any
    if (!doc.id) return
    doc.filePath = res.filePath
    doc.updatedAt = Date.now()
    store.upsertDocument(doc)
    store.setActiveDocId(doc.id)
    await window.api.saveDocument(doc.id, doc)
  }, [store])

  const handleShowInFinder = useCallback(async () => {
    const doc = store.activeDoc as any
    if (!doc?.filePath) return
    await window.api.showInFinder(doc.filePath)
  }, [store])

  const handlePrint = useCallback(async () => {
    await window.api.printDoc()
  }, [])

  // Sync window title with active document
  useEffect(() => {
    const title = store.activeDoc?.title
    document.title = title ? `${title} — Scriptorium` : 'Scriptorium'
  }, [store.activeDoc?.title])

  // ⌘S / ⌘⇧S / ⌘O / ⌘N / ⌘W global shortcuts — MUST be after all handlers declared
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (e.shiftKey) handleSaveAs()
        else handleSaveFile()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault()
        handleOpenFile()
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
        // Only intercept if no text input / editor is focused
        const target = e.target as HTMLElement
        if (!target.isContentEditable && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          setShowNewDoc(true)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        const target = e.target as HTMLElement
        if (!target.isContentEditable && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          const doc = store.activeDoc
          if (doc && confirm(`¿Cerrar "${doc.title || 'Sin título'}"?`)) {
            window.api.deleteDocument(doc.id)
            store.deleteDocument(doc.id)
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSaveFile, handleSaveAs, handleOpenFile, store])

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

  // Execute AI document commands from chat
  const handleDocCommand = useCallback((action: DocAction) => {
    if (!store.activeDoc) return
    const doc = store.activeDoc
    switch (action.type) {
      case 'set_title':
        store.updateDocument(doc.id, { title: action.title })
        handleSave(doc.id, { ...doc, title: action.title })
        break
      case 'create_frame': {
        const fn = (window as any).__layoutCreateTextFrame
        if (fn) fn(action.content, action.page ?? 0)
        break
      }
      case 'replace_text': {
        // Replace in document write-mode content
        if (doc.content?.includes(action.find)) {
          const newContent = doc.content.replaceAll(action.find, action.replace)
          store.updateDocument(doc.id, { content: newContent })
          handleSave(doc.id, { ...doc, content: newContent })
        }
        break
      }
    }
  }, [store, handleSave])

  const handleApplyDocSetup = useCallback((setup: DocumentSetup) => {
    if (!store.activeDoc) return
    store.updateDocument(store.activeDoc.id, {
      layoutPageSize: setup.pageSizeKey,
      layoutPageCount: setup.pageCount,
      facingPages: setup.facingPages,
      layoutCustomWidthMM: setup.customWidthMM,
      layoutCustomHeightMM: setup.customHeightMM,
      marginTopMM: setup.marginTopMM,
      marginBottomMM: setup.marginBottomMM,
      marginInnerMM: setup.marginInnerMM,
      marginOuterMM: setup.marginOuterMM,
      bleedMM: setup.bleedMM,
    })
    setShowDocSetup(false)
  }, [store])

  const handleToggleTheme = useCallback(async () => {
    const next = store.theme === 'dark' ? 'light' : 'dark'
    store.setTheme(next)
    await window.api.setSettings({ theme: next })
  }, [store])

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      data-theme={store.theme}
      style={{ background: 'var(--app-bg)' }}
    >
      <TitleBar
        store={store}
        onNewDoc={() => setShowNewDoc(true)}
        onOpenFile={handleOpenFile}
        onSave={handleSaveFile}
        onSaveAs={handleSaveAs}
        onShowInFinder={handleShowInFinder}
        onPrint={handlePrint}
        onCloseDoc={() => { if (store.activeDoc) store.deleteDocument(store.activeDoc.id) }}
        onToggleTheme={handleToggleTheme}
        onDocSetup={() => setShowDocSetup(true)}
      />

      {/* Document tabs */}
      <DocTabsBar store={store} onNewDoc={() => setShowNewDoc(true)} onSave={handleSave} />

      {/* Ollama setup banner — appears only when needed */}
      {ollamaBanner && (
        <OllamaSetupBanner
          mode={ollamaBanner}
          onSetupModels={() => { setShowModelSetup(true); setOllamaBanner(null) }}
          onDismiss={() => setOllamaBanner(null)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
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

        <AISidebar store={store} onSave={handleSave} onInsertCitation={handleInsertCitation} onCommand={handleDocCommand} />
      </div>

      {store.showSettings && (
        <SettingsModal
          store={store}
          onOpenModelSetup={() => { store.setShowSettings(false); setShowModelSetup(true) }}
        />
      )}
      {showModelSetup && (
        <ModelSetupModal
          installedModels={installedModels}
          onClose={() => setShowModelSetup(false)}
          onModelInstalled={(modelId) => {
            setInstalledModels(prev => [...prev.filter(m => m !== modelId), modelId])
            store.setOllamaStatus('online')
            store.setOllamaActiveModel(modelId)
            setShowModelSetup(false)
          }}
        />
      )}
      {showDocSetup && store.activeDoc && (
        <DocumentSetupModal
          setup={buildSetupFromDocument(store.activeDoc)}
          onApply={handleApplyDocSetup}
          onClose={() => setShowDocSetup(false)}
        />
      )}
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
