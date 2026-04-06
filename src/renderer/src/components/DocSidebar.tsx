import React from 'react'
import type { Document } from '../store/useStore'

const DOC_ICONS: Record<string, string> = {
  book: '📖',
  paper: '📄',
  thesis: '🎓',
  research: '🔬',
  notes: '📝',
}

const DOC_LABELS: Record<string, string> = {
  book: 'Libro',
  paper: 'Paper',
  thesis: 'Tesis',
  research: 'Investigación',
  notes: 'Notas',
}

interface Props {
  store: any
  onNewDoc: () => void
  onSave: (id: string, data: object) => void
}

export function DocSidebar({ store, onNewDoc, onSave }: Props) {
  const { documents, activeDocId, setActiveDocId, deleteDocument } = store

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('¿Eliminar este documento?')) {
      window.api.deleteDocument(id)
      deleteDocument(id)
    }
  }

  return (
    <aside className="w-52 shrink-0 bg-ink-800 border-r border-ink-700 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-ink-700">
        <button
          onClick={onNewDoc}
          className="w-full py-1.5 rounded bg-accent-600 hover:bg-accent-500 text-white text-xs font-sans transition text-center"
        >
          + Nuevo documento
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {documents.length === 0 ? (
          <p className="text-ink-500 text-xs text-center mt-8 px-4">
            Sin documentos
          </p>
        ) : (
          documents.map((doc: Document) => (
            <div
              key={doc.id}
              onClick={() => setActiveDocId(doc.id)}
              className={`group relative px-3 py-2.5 mx-2 mb-1 rounded-lg cursor-pointer transition ${
                activeDocId === doc.id
                  ? 'bg-ink-600 text-white'
                  : 'hover:bg-ink-700 text-ink-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0 mt-0.5">
                  {DOC_ICONS[doc.docType] || '📄'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-sans font-medium truncate leading-tight">
                    {doc.title}
                  </p>
                  <p className="text-ink-500 text-[10px] mt-0.5">
                    {DOC_LABELS[doc.docType] || doc.docType}
                  </p>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, doc.id)}
                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-ink-500 hover:text-red-400 text-xs transition"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-ink-700 text-ink-500 text-[10px] font-sans">
        {documents.length} documento{documents.length !== 1 ? 's' : ''}
      </div>
    </aside>
  )
}
