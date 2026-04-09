import React, { useState, useCallback } from 'react'
import type { Document } from '../store/useStore'

const DOC_ICONS: Record<string, string> = {
  book: '📖', paper: '📄', thesis: '🎓',
  research: '🔬', notes: '📝', cover: '🎨',
}
const DOC_LABELS: Record<string, string> = {
  book: 'Libro', paper: 'Paper', thesis: 'Tesis',
  research: 'Investigación', notes: 'Notas', cover: 'Portada',
}

interface Props {
  store: any
  onNewDoc: () => void
  onSave: (id: string, data: object) => void
}

export function DocSidebar({ store, onNewDoc, onSave }: Props) {
  const { documents, activeDocId, setActiveDocId, deleteDocument } = store
  const [collapsed, setCollapsed] = useState(false)
  const [draggingOver, setDraggingOver] = useState(false)

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('¿Eliminar este documento?')) {
      window.api.deleteDocument(id)
      deleteDocument(id)
    }
  }

  // ── PDF drag & drop ──────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const items = Array.from(e.dataTransfer.items)
    const hasPDF = items.some(item => item.type === 'application/pdf' || item.kind === 'file')
    if (hasPDF) {
      e.preventDefault()
      setDraggingOver(true)
    }
  }, [])

  const handleDragLeave = useCallback(() => setDraggingOver(false), [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    const files = Array.from(e.dataTransfer.files)
    const pdf = files.find(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf')
    if (!pdf) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      const name = pdf.name.replace(/\.pdf$/i, '')
      // Trigger the LayoutCanvas PDF importer via global
      if ((window as any).__triggerPDFImportWithData) {
        (window as any).__triggerPDFImportWithData(base64, name)
      }
    }
    reader.readAsDataURL(pdf)
  }, [])

  // ── Collapsed (icon strip) mode ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside
        style={{ width: 44, background: '#18181b', borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}
        className="flex flex-col items-center py-2 gap-1 overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setCollapsed(false)}
          title="Expandir panel"
          className="w-8 h-8 rounded flex items-center justify-center text-xs transition"
          style={{ color: '#6e6e78', background: 'rgba(255,255,255,0.05)' }}
        >›</button>

        <div className="w-6 h-px my-1" style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* New doc */}
        <button onClick={onNewDoc} title="Nuevo documento"
          className="w-8 h-8 rounded flex items-center justify-center text-sm transition"
          style={{ color: '#a0a0a8', background: 'transparent' }}>+</button>

        {/* Doc icons */}
        {documents.map((doc: Document) => (
          <button
            key={doc.id}
            onClick={() => setActiveDocId(doc.id)}
            title={doc.title}
            className="w-8 h-8 rounded flex items-center justify-center text-base transition"
            style={{
              background: activeDocId === doc.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              outline: activeDocId === doc.id ? '1px solid rgba(255,255,255,0.15)' : 'none',
            }}
          >
            {DOC_ICONS[doc.docType] || '📄'}
          </button>
        ))}

        {draggingOver && (
          <div className="absolute inset-0 flex items-center justify-center rounded" style={{ background: 'rgba(41,151,255,0.15)', border: '2px dashed #2997ff' }}>
            <span className="text-2xl">⬇</span>
          </div>
        )}
      </aside>
    )
  }

  // ── Expanded mode ────────────────────────────────────────────────────────────
  return (
    <aside
      className="shrink-0 flex flex-col overflow-hidden relative"
      style={{ width: 196, background: '#18181b', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {draggingOver && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2"
          style={{ background: 'rgba(41,151,255,0.12)', border: '2px dashed #2997ff', borderRadius: 4, pointerEvents: 'none' }}
        >
          <span className="text-3xl">📄</span>
          <span className="text-xs font-sans" style={{ color: '#60a5fa' }}>Soltar PDF para importar</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={onNewDoc}
          className="flex-1 py-1.5 rounded text-xs font-sans transition text-center"
          style={{ background: 'rgba(41,151,255,0.15)', color: '#60a5fa', border: '1px solid rgba(41,151,255,0.25)' }}
        >
          + Nuevo
        </button>
        <button
          onClick={() => setCollapsed(true)}
          title="Colapsar panel"
          className="ml-2 w-6 h-6 rounded flex items-center justify-center text-xs transition"
          style={{ color: '#48484f', background: 'transparent' }}
        >‹</button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto py-1">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-8 px-4 gap-2">
            <p className="text-xs text-center" style={{ color: '#36363c' }}>Sin documentos</p>
            <p className="text-[10px] text-center" style={{ color: '#2c2c30' }}>Arrastra un PDF aquí para importarlo</p>
          </div>
        ) : (
          documents.map((doc: Document) => (
            <div
              key={doc.id}
              onClick={() => setActiveDocId(doc.id)}
              className="group relative px-2.5 py-2 mx-1.5 mb-0.5 rounded-lg cursor-pointer transition"
              style={{
                background: activeDocId === doc.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                outline: activeDocId === doc.id ? '1px solid rgba(255,255,255,0.1)' : 'none',
              }}
              onMouseEnter={e => { if (activeDocId !== doc.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (activeDocId !== doc.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0 mt-0.5 leading-none">{DOC_ICONS[doc.docType] || '📄'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-sans font-medium truncate leading-tight" style={{ color: activeDocId === doc.id ? '#e4e4e6' : '#a0a0a8' }}>
                    {doc.title}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#48484f' }}>
                    {DOC_LABELS[doc.docType] || doc.docType}
                  </p>
                </div>
              </div>
              <button
                onClick={e => handleDelete(e, doc.id)}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-xs transition"
                style={{ color: '#ef4444' }}
                title="Eliminar"
              >✕</button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-sans" style={{ color: '#36363c' }}>
          {documents.length} doc{documents.length !== 1 ? 's' : ''} · Arrastra PDF para importar
        </p>
      </div>
    </aside>
  )
}
