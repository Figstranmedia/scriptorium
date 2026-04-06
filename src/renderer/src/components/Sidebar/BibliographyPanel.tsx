import React, { useState } from 'react'
import type { Reference, CitationStyle } from '../../store/useStore'
import { formatReference, formatInlineCitation } from '../../lib/citations'

interface Props {
  references: Reference[]
  citationStyle: CitationStyle
  onAddRef: (ref: Reference) => void
  onDeleteRef: (id: string) => void
  onUpdateStyle: (style: CitationStyle) => void
  onInsertCitation: (text: string) => void
}

const EMPTY_REF: Omit<Reference, 'id'> = {
  type: 'book',
  author: '',
  title: '',
  year: '',
  publisher: '',
  journal: '',
  volume: '',
  issue: '',
  pages: '',
  url: '',
  doi: '',
  city: '',
  edition: '',
  accessDate: '',
}

const TYPE_ICONS: Record<Reference['type'], string> = {
  book: '📖',
  article: '📄',
  website: '🌐',
  thesis: '🎓',
  conference: '🗣',
}

const CITATION_STYLES: { id: CitationStyle; label: string }[] = [
  { id: 'apa', label: 'APA 7' },
  { id: 'mla', label: 'MLA 9' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'ieee', label: 'IEEE' },
]

export function BibliographyPanel({ references, citationStyle, onAddRef, onDeleteRef, onUpdateStyle, onInsertCitation }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Omit<Reference, 'id'>>(EMPTY_REF)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleAdd = () => {
    if (!form.author.trim() || !form.title.trim()) return
    onAddRef({ ...form, id: `ref_${Date.now()}` })
    setForm(EMPTY_REF)
    setShowForm(false)
  }

  const FIELDS_BY_TYPE: Record<Reference['type'], (keyof typeof EMPTY_REF)[]> = {
    book: ['author', 'title', 'year', 'edition', 'city', 'publisher'],
    article: ['author', 'title', 'year', 'journal', 'volume', 'issue', 'pages', 'doi'],
    website: ['author', 'title', 'year', 'publisher', 'url', 'accessDate'],
    thesis: ['author', 'title', 'year', 'publisher', 'url'],
    conference: ['author', 'title', 'year', 'journal', 'pages', 'publisher'],
  }

  const FIELD_LABELS: Record<keyof typeof EMPTY_REF, string> = {
    type: 'Tipo', author: 'Autor(es)', title: 'Título', year: 'Año',
    publisher: 'Editorial / Institución', journal: 'Revista / Conferencia',
    volume: 'Volumen', issue: 'Número', pages: 'Páginas', url: 'URL',
    doi: 'DOI', city: 'Ciudad', edition: 'Edición', accessDate: 'Fecha de acceso',
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Style selector */}
      <div className="px-3 py-2 border-b border-ink-200 bg-white shrink-0">
        <p className="text-[10px] text-ink-400 font-sans mb-1.5 uppercase tracking-wider">Estilo de citación</p>
        <div className="flex gap-1">
          {CITATION_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => onUpdateStyle(s.id)}
              className={`flex-1 py-1 rounded text-[11px] font-sans border transition ${
                citationStyle === s.id
                  ? 'border-accent-400 bg-accent-50 text-accent-700 font-semibold'
                  : 'border-ink-200 text-ink-400 hover:border-ink-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reference list */}
      <div className="flex-1 overflow-y-auto">
        {references.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <p className="text-2xl mb-2">📚</p>
            <p className="text-xs text-ink-400 font-sans">Sin referencias. Agrega tu primera fuente.</p>
          </div>
        )}

        {references.map((ref, i) => (
          <div key={ref.id} className="border-b border-ink-100 last:border-0">
            <div
              className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-ink-50 transition"
              onClick={() => setExpandedId(expandedId === ref.id ? null : ref.id)}
            >
              <span className="shrink-0 text-base mt-0.5">{TYPE_ICONS[ref.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-sans font-semibold text-ink-700 leading-tight truncate">{ref.title}</p>
                <p className="text-[10px] text-ink-400 font-sans truncate">{ref.author} — {ref.year}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onInsertCitation(formatInlineCitation(ref, i + 1, citationStyle)) }}
                  className="px-1.5 py-0.5 rounded bg-accent-100 hover:bg-accent-200 text-accent-700 text-[10px] font-sans transition"
                  title="Insertar cita en el texto"
                >
                  Citar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteRef(ref.id) }}
                  className="text-ink-300 hover:text-red-400 text-xs px-1 transition"
                  title="Eliminar"
                >✕</button>
              </div>
            </div>

            {/* Expanded: formatted citation preview */}
            {expandedId === ref.id && (
              <div className="px-3 pb-3 bg-ink-50">
                <p className="text-[10px] text-ink-400 font-sans mb-1 uppercase tracking-wider">Formato {citationStyle.toUpperCase()}</p>
                <p
                  className="text-[11px] text-ink-600 font-sans leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatReference(ref, i + 1, citationStyle).replace(/\*(.*?)\*/g, '<em>$1</em>') }}
                />
              </div>
            )}
          </div>
        ))}

        {/* Add reference form */}
        {showForm && (
          <div className="p-3 bg-white border-t border-ink-200">
            <p className="text-xs font-sans font-semibold text-ink-700 mb-3">Nueva referencia</p>

            {/* Type */}
            <div className="flex gap-1 mb-3">
              {(Object.keys(TYPE_ICONS) as Reference['type'][]).map(t => (
                <button
                  key={t}
                  onClick={() => setField('type', t)}
                  className={`flex-1 py-1 rounded text-[10px] font-sans border transition ${form.type === t ? 'border-accent-400 bg-accent-50 text-accent-700' : 'border-ink-200 text-ink-400'}`}
                  title={t}
                >
                  {TYPE_ICONS[t]}
                </button>
              ))}
            </div>

            {/* Fields by type */}
            <div className="space-y-2">
              {FIELDS_BY_TYPE[form.type].map(field => (
                <div key={field}>
                  <label className="block text-[10px] text-ink-400 font-sans mb-0.5">{FIELD_LABELS[field]}</label>
                  <input
                    type="text"
                    value={(form[field] || '') as string}
                    onChange={(e) => setField(field, e.target.value)}
                    placeholder={field === 'author' ? 'García, L. & Martínez, P.' : ''}
                    className="w-full text-xs px-2 py-1.5 border border-ink-200 rounded outline-none focus:border-accent-400 font-sans"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-1.5 rounded text-xs font-sans text-ink-500 border border-ink-200 hover:bg-ink-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.author.trim() || !form.title.trim()}
                className="flex-1 py-1.5 rounded text-xs font-sans text-white bg-accent-500 hover:bg-accent-600 transition disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!showForm && (
        <div className="p-3 border-t border-ink-200 shrink-0">
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-white text-xs font-sans transition"
          >
            + Agregar referencia
          </button>
          {references.length > 0 && (
            <p className="text-[10px] text-ink-400 font-sans text-center mt-2">
              {references.length} referencia{references.length !== 1 ? 's' : ''} · Exporta a PDF para incluirlas
            </p>
          )}
        </div>
      )}
    </div>
  )
}
