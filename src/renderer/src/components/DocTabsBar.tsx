/**
 * DocTabsBar — horizontal browser-style document tabs replacing the left DocSidebar.
 * Shows all open documents as tabs. Supports PDF drag-and-drop to import.
 */
import React, { useState, useCallback, useRef } from 'react'
import type { Document } from '../store/useStore'

const DOC_ICONS: Record<string, string> = {
  book: '📖', paper: '📄', thesis: '🎓',
  research: '🔬', notes: '📝', cover: '🎨',
}

interface Props {
  store: any
  onNewDoc: () => void
  onSave: (id: string, data: object) => void
}

export function DocTabsBar({ store, onNewDoc, onSave }: Props) {
  const { documents, activeDocId, setActiveDocId, deleteDocument } = store
  const [draggingOver, setDraggingOver] = useState(false)
  const [contextTab, setContextTab] = useState<string | null>(null)
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('¿Cerrar este documento?')) {
      window.api.deleteDocument(id)
      deleteDocument(id)
    }
  }, [deleteDocument])

  // ── Context menu ─────────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextTab(id)
    setContextPos({ x: e.clientX, y: e.clientY })
  }, [])

  // ── PDF drag & drop ──────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const items = Array.from(e.dataTransfer.items)
    if (items.some(item => item.type === 'application/pdf' || item.kind === 'file')) {
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
      if ((window as any).__triggerPDFImportWithData) {
        (window as any).__triggerPDFImportWithData(base64, name)
      }
    }
    reader.readAsDataURL(pdf)
  }, [])

  const sorted = [...documents].sort((a: Document, b: Document) => b.updatedAt - a.updatedAt)

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 34,
        background: 'var(--app-bg)',
        borderBottom: '1px solid var(--app-border)',
        flexShrink: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        userSelect: 'none',
        position: 'relative',
        scrollbarWidth: 'none',
      }}
    >
      {/* Tabs */}
      {sorted.map((doc: Document) => {
        const isActive = doc.id === activeDocId
        return (
          <div
            key={doc.id}
            onClick={() => setActiveDocId(doc.id)}
            onContextMenu={e => handleContextMenu(e, doc.id)}
            title={doc.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 10px 0 10px',
              height: '100%',
              maxWidth: 200,
              minWidth: 80,
              cursor: 'pointer',
              flexShrink: 0,
              position: 'relative',
              background: isActive ? 'var(--tab-active-bg)' : 'transparent',
              borderRight: '1px solid var(--app-border)',
              borderBottom: isActive ? '2px solid var(--tab-active-border)' : '2px solid transparent',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(128,128,128,0.08)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            {/* Icon */}
            <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0, opacity: isActive ? 1 : 0.6 }}>
              {DOC_ICONS[doc.docType] || '📄'}
            </span>

            {/* Title */}
            <span style={{
              fontSize: 11,
              fontFamily: 'system-ui, Figtree, sans-serif',
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--app-text)' : 'var(--app-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}>
              {doc.title || 'Sin título'}
            </span>

            {/* Close button */}
            <button
              onClick={e => handleDelete(e, doc.id)}
              title="Cerrar"
              style={{
                flexShrink: 0,
                width: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 3,
                background: 'none', border: 'none',
                color: isActive ? '#6b7280' : 'transparent',
                cursor: 'pointer',
                fontSize: 10, lineHeight: 1,
                padding: 0,
                transition: 'color 0.1s, background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.color = isActive ? '#6b7280' : 'transparent'; e.currentTarget.style.background = 'none' }}
            >✕</button>
          </div>
        )
      })}

      {/* New tab button */}
      <button
        onClick={onNewDoc}
        title="Nuevo documento (⌘N)"
        style={{
          flexShrink: 0,
          width: 34, height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none',
          color: 'var(--app-text-dim)',
          fontSize: 16,
          cursor: 'pointer',
          borderRight: '1px solid var(--app-border)',
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--app-text-dim)')}
      >+</button>

      {/* PDF drop overlay */}
      {draggingOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12,
          background: 'rgba(41,151,255,0.12)',
          border: '2px dashed rgba(41,151,255,0.5)',
          borderRadius: 0,
          pointerEvents: 'none',
          fontSize: 11,
          color: '#60a5fa',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <span>📄</span>
          <span>Soltar PDF para importar</span>
        </div>
      )}

      {/* Context menu */}
      {contextTab && (
        <TabContextMenu
          x={contextPos.x}
          y={contextPos.y}
          docId={contextTab}
          onClose={() => setContextTab(null)}
          onActivate={() => { setActiveDocId(contextTab); setContextTab(null) }}
          onDelete={() => {
            if (confirm('¿Cerrar este documento?')) {
              window.api.deleteDocument(contextTab)
              deleteDocument(contextTab)
            }
            setContextTab(null)
          }}
        />
      )}
    </div>
  )
}

function TabContextMenu({ x, y, docId, onClose, onActivate, onDelete }: {
  x: number; y: number; docId: string
  onClose: () => void; onActivate: () => void; onDelete: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', left: x, top: y,
        background: '#222226', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 9999, padding: '4px 0', minWidth: 180,
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseLeave={onClose}
    >
      {[
        { label: 'Abrir', action: onActivate },
        { label: null },
        { label: 'Cerrar', action: onDelete, danger: true },
      ].map((item, i) => {
        if (!item.label) return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
        return (
          <div key={i}
            onClick={item.action}
            style={{
              padding: '6px 14px', fontSize: 12,
              color: item.danger ? '#f87171' : '#c8c8cc',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >{item.label}</div>
        )
      })}
    </div>
  )
}
