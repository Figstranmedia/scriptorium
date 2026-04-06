import React, { useState, useRef } from 'react'
import type { SidebarTab, Reference, CitationStyle } from '../../store/useStore'
import { BibliographyPanel } from './BibliographyPanel'

interface Props {
  store: any
  onSave: (id: string, data: object) => void
  onInsertCitation?: (text: string) => void
}

const TABS: { id: SidebarTab; label: string; emoji: string; title: string }[] = [
  { id: 'research',     label: 'Investigar',  emoji: '🔬', title: 'Análisis e investigación de fuentes' },
  { id: 'suggest',      label: 'Redactar',    emoji: '✍️', title: 'Sugerencias de redacción' },
  { id: 'restructure',  label: 'Estructurar', emoji: '🗂', title: 'Reorganizar estructura' },
  { id: 'replace',      label: 'Edición',     emoji: '⚡', title: 'Resultado de edición directa' },
  { id: 'bibliography', label: 'Bibliog.',    emoji: '📚', title: 'Gestor de referencias y citas' },
  { id: 'browser',      label: 'Fuentes',     emoji: '🌐', title: 'Navegador de referencias' },
]

export function AISidebar({ store, onSave, onInsertCitation }: Props) {
  const {
    sidebarTab, setSidebarTab, setSidebarOpen,
    aiResult, selectedText,
    browserUrl, setBrowserUrl,
    activeDoc, updateDocument,
  } = store
  const [urlInput, setUrlInput] = useState(browserUrl)
  const webviewRef = useRef<HTMLElement>(null)

  const handleNavigate = (url: string) => {
    let finalUrl = url.trim()
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) finalUrl = 'https://' + finalUrl
    setBrowserUrl(finalUrl)
    setUrlInput(finalUrl)
  }

  const handleSearch = (query: string) => {
    handleNavigate(`https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`)
    setSidebarTab('browser' as SidebarTab)
  }

  const handleAddRef = (ref: Reference) => {
    if (!activeDoc) return
    const refs = [...(activeDoc.references || []), ref]
    updateDocument(activeDoc.id, { references: refs })
    onSave(activeDoc.id, { ...activeDoc, references: refs })
  }

  const handleDeleteRef = (id: string) => {
    if (!activeDoc) return
    const refs = (activeDoc.references || []).filter((r: Reference) => r.id !== id)
    updateDocument(activeDoc.id, { references: refs })
    onSave(activeDoc.id, { ...activeDoc, references: refs })
  }

  const handleUpdateCitationStyle = (style: CitationStyle) => {
    if (!activeDoc) return
    updateDocument(activeDoc.id, { citationStyle: style })
    onSave(activeDoc.id, { ...activeDoc, citationStyle: style })
  }

  return (
    <aside className="w-96 shrink-0 border-l border-ink-200 bg-ink-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-0 shrink-0">
        <span className="text-xs font-sans font-semibold text-ink-500 uppercase tracking-wider">Asistente IA</span>
        <button onClick={() => setSidebarOpen(false)} className="text-ink-400 hover:text-ink-700 text-lg leading-none transition">×</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-ink-200 mt-2 px-2 shrink-0 gap-0.5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            title={tab.title}
            className={`flex items-center gap-1 px-2 py-2 text-[11px] font-sans border-b-2 transition whitespace-nowrap shrink-0 ${
              sidebarTab === tab.id
                ? 'border-accent-500 text-accent-600 font-semibold'
                : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {sidebarTab === 'browser' ? (
          <BrowserPanel url={browserUrl} urlInput={urlInput} setUrlInput={setUrlInput} onNavigate={handleNavigate} webviewRef={webviewRef} />
        ) : sidebarTab === 'bibliography' ? (
          <BibliographyPanel
            references={activeDoc?.references || []}
            citationStyle={activeDoc?.citationStyle || 'apa'}
            onAddRef={handleAddRef}
            onDeleteRef={handleDeleteRef}
            onUpdateStyle={handleUpdateCitationStyle}
            onInsertCitation={(text) => onInsertCitation?.(text)}
          />
        ) : (
          <AIResultPanel
            aiResult={aiResult}
            selectedText={selectedText}
            tab={sidebarTab}
            onSearchSource={(query: string) => handleSearch(query)}
          />
        )}
      </div>

      {/* Quick search (only for AI tabs) */}
      {sidebarTab !== 'browser' && sidebarTab !== 'bibliography' && (
        <div className="p-3 border-t border-ink-200 shrink-0">
          <p className="text-[10px] text-ink-400 font-sans mb-1.5">Buscar en Google Scholar:</p>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Buscar fuentes..."
              defaultValue={selectedText.slice(0, 60)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch((e.target as HTMLInputElement).value) }}
              className="flex-1 text-xs px-2 py-1.5 rounded border border-ink-200 bg-white outline-none focus:border-accent-400 font-sans"
            />
            <button
              onClick={(e) => { const input = (e.currentTarget.previousElementSibling as HTMLInputElement); handleSearch(input.value) }}
              className="px-2 py-1.5 rounded bg-accent-500 text-white text-xs hover:bg-accent-600 transition"
            >→</button>
          </div>
        </div>
      )}
    </aside>
  )
}

// ── AI result panel ──────────────────────────────────────────────────────────

function AIResultPanel({ aiResult, selectedText, tab, onSearchSource }: {
  aiResult: any; selectedText: string; tab: SidebarTab; onSearchSource: (q: string) => void
}) {
  if (aiResult.loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="ai-loading flex gap-1"><span /><span /><span /></div>
        <p className="text-xs text-ink-400 font-sans">Consultando IA...</p>
      </div>
    )
  }

  if (!aiResult.content && !aiResult.error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-3xl mb-3">{tab === 'research' ? '🔬' : tab === 'suggest' ? '✍️' : tab === 'restructure' ? '🗂' : '⚡'}</p>
        <p className="text-sm font-serif text-ink-500">Selecciona texto en el editor y usa el menú flotante para activar la IA.</p>
      </div>
    )
  }

  if (aiResult.error) {
    return (
      <div className="flex-1 p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-sans">
          <p className="font-semibold mb-1">Error</p>
          <p>{aiResult.error}</p>
          {aiResult.error.includes('API key') && <p className="mt-2 text-red-600">Configura tu API key en ⚙ Ajustes.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      {selectedText && (
        <div className="bg-white border border-ink-200 rounded-lg p-3">
          <p className="text-[10px] text-ink-400 font-sans mb-1 uppercase tracking-wider">Texto analizado</p>
          <p className="text-xs font-serif text-ink-600 line-clamp-3 italic">"{selectedText.slice(0, 200)}{selectedText.length > 200 ? '...' : ''}"</p>
        </div>
      )}
      <div className="bg-white border border-ink-200 rounded-lg p-4">
        <MarkdownContent content={aiResult.content} />
      </div>
      {tab === 'research' && (
        <button onClick={() => onSearchSource(selectedText.slice(0, 80))} className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-sans transition">
          🌐 Ver fuentes en Google Scholar
        </button>
      )}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="text-xs font-sans text-ink-700 space-y-1.5 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-ink-800 text-sm mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-ink-800">{line.slice(2, -2)}</p>
        if (line.startsWith('- ') || line.startsWith('• ')) return <p key={i} className="pl-3 text-ink-600">• {line.slice(2)}</p>
        if (line.match(/^\d+\./)) return <p key={i} className="pl-3 text-ink-600">{line}</p>
        if (line.trim() === '') return <div key={i} className="h-1" />
        const boldParts = line.split(/\*\*(.*?)\*\*/g)
        if (boldParts.length > 1) {
          return <p key={i}>{boldParts.map((part, j) => j % 2 === 1 ? <strong key={j} className="font-semibold text-ink-800">{part}</strong> : <span key={j}>{part}</span>)}</p>
        }
        return <p key={i} className="text-ink-600">{line}</p>
      })}
    </div>
  )
}

// ── Browser panel ────────────────────────────────────────────────────────────

function BrowserPanel({ url, urlInput, setUrlInput, onNavigate, webviewRef }: {
  url: string; urlInput: string; setUrlInput: (v: string) => void
  onNavigate: (url: string) => void; webviewRef: React.Ref<HTMLElement>
}) {
  const QUICK_LINKS = [
    { label: 'Scholar', url: 'https://scholar.google.com' },
    { label: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov' },
    { label: 'JSTOR', url: 'https://www.jstor.org' },
    { label: 'arXiv', url: 'https://arxiv.org' },
    { label: 'Dialnet', url: 'https://dialnet.unirioja.es' },
    { label: 'Redalyc', url: 'https://www.redalyc.org' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-2 py-2 border-b border-ink-200 bg-white shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); onNavigate(urlInput) }} className="flex gap-1">
          <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 text-[11px] px-2 py-1.5 rounded border border-ink-200 bg-ink-50 outline-none focus:border-accent-400 font-mono"
            placeholder="https://..." />
          <button type="submit" className="px-2 py-1.5 rounded bg-ink-200 hover:bg-ink-300 text-ink-600 text-xs transition">→</button>
        </form>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {QUICK_LINKS.map(link => (
            <button key={link.url} onClick={() => onNavigate(link.url)}
              className="px-2 py-0.5 rounded-full bg-ink-100 hover:bg-accent-100 text-ink-500 hover:text-accent-700 text-[10px] font-sans transition">
              {link.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <webview ref={webviewRef as any} src={url} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
