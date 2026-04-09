import React, { useState } from 'react'
import type { DocType, CoverConfig } from '../store/useStore'
import { CoverSetupModal } from './Layout/CoverSetupModal'

interface Props {
  onClose: () => void
  onCreate: (type: DocType, coverConfig?: CoverConfig) => void
}

const TYPES: { id: DocType; emoji: string; label: string; desc: string }[] = [
  {
    id: 'book',
    emoji: '📖',
    label: 'Libro',
    desc: 'Capítulos, narrativa, ensayo largo. Fuente serif, márgenes amplios.',
  },
  {
    id: 'cover',
    emoji: '🎨',
    label: 'Portada de libro',
    desc: 'Diseño de tapa, lomo y contraportada como pieza única para imprenta.',
  },
  {
    id: 'paper',
    emoji: '📄',
    label: 'Paper / Artículo',
    desc: 'Artículo académico o periodístico. Estructura IMRaD o periodística.',
  },
  {
    id: 'thesis',
    emoji: '🎓',
    label: 'Tesis',
    desc: 'Trabajo de grado o posgrado. Doble espacio, Times New Roman.',
  },
  {
    id: 'research',
    emoji: '🔬',
    label: 'Investigación',
    desc: 'Notas de investigación, recopilación de fuentes y análisis.',
  },
  {
    id: 'notes',
    emoji: '📝',
    label: 'Notas libres',
    desc: 'Apuntes sin estructura fija. Estilo minimalista.',
  },
]

export function NewDocModal({ onClose, onCreate }: Props) {
  const [selected, setSelected] = useState<DocType>('book')
  const [showCoverSetup, setShowCoverSetup] = useState(false)

  function handleCreate() {
    if (selected === 'cover') {
      setShowCoverSetup(true)
    } else {
      onCreate(selected)
    }
  }

  if (showCoverSetup) {
    return (
      <CoverSetupModal
        onClose={() => setShowCoverSetup(false)}
        onCreate={(coverConfig) => {
          onCreate('cover', coverConfig)
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-ink-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-sans font-semibold">Nuevo documento</h2>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-white text-xl leading-none transition"
          >×</button>
        </div>

        {/* Type grid */}
        <div className="p-5 grid grid-cols-1 gap-2">
          {TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => setSelected(type.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition ${
                selected === type.id
                  ? 'border-accent-400 bg-accent-50'
                  : 'border-ink-100 hover:border-ink-200 hover:bg-ink-50'
              }`}
            >
              <span className="text-2xl shrink-0">{type.emoji}</span>
              <div>
                <p className="font-sans font-semibold text-ink-800 text-sm">{type.label}</p>
                <p className="font-sans text-xs text-ink-500 mt-0.5">{type.desc}</p>
              </div>
              {selected === type.id && (
                <span className="ml-auto text-accent-500 text-lg shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-sans text-ink-500 hover:bg-ink-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            className="px-6 py-2 rounded-lg text-sm font-sans text-white bg-accent-500 hover:bg-accent-600 transition font-semibold"
          >
            {selected === 'cover' ? 'Configurar portada →' : 'Crear documento'}
          </button>
        </div>
      </div>
    </div>
  )
}
