import React, { useState, useEffect } from 'react'

interface ModelDef {
  id: string
  name: string
  by: string
  size: string
  ram: string
  desc: string
  recommended?: boolean
  tag?: string
}

const CATALOG: ModelDef[] = [
  {
    id: 'gemma3:4b',
    name: 'Gemma 3',
    by: 'Google',
    size: '~2.5 GB',
    ram: '8 GB RAM',
    desc: 'Excelente para escritura y análisis literario. Rápido y preciso.',
    recommended: true,
    tag: 'Recomendado',
  },
  {
    id: 'gemma3:12b',
    name: 'Gemma 3 (12B)',
    by: 'Google',
    size: '~7 GB',
    ram: '16 GB RAM',
    desc: 'Mayor calidad de respuesta. Ideal si tienes suficiente RAM.',
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2',
    by: 'Meta',
    size: '~2 GB',
    ram: '8 GB RAM',
    desc: 'El más ligero y rápido. Perfecto para sugerencias rápidas.',
    tag: 'Más rápido',
  },
  {
    id: 'mistral:7b',
    name: 'Mistral',
    by: 'Mistral AI',
    size: '~4 GB',
    ram: '8 GB RAM',
    desc: 'Equilibrado entre velocidad y calidad. Muy bueno en español.',
  },
  {
    id: 'qwen2.5:7b',
    name: 'Qwen 2.5',
    by: 'Alibaba',
    size: '~4.4 GB',
    ram: '8 GB RAM',
    desc: 'Multilingüe avanzado. Destacado en comprensión lectora.',
    tag: 'Mejor en español',
  },
  {
    id: 'phi4-mini',
    name: 'Phi-4 Mini',
    by: 'Microsoft',
    size: '~2.5 GB',
    ram: '8 GB RAM',
    desc: 'Muy eficiente. Bueno para edición y corrección de estilo.',
  },
]

interface PullState {
  modelId: string
  status: string
  percent: number | null
  done: boolean
  error?: string
}

interface Props {
  onClose: () => void
  onModelInstalled: (modelId: string) => void
  installedModels: string[]
}

export function ModelSetupModal({ onClose, onModelInstalled, installedModels }: Props) {
  const [pulling, setPulling] = useState<PullState | null>(null)

  // Register progress listener once
  useEffect(() => {
    window.api.onOllamaPullProgress((data) => {
      setPulling(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: data.status,
          percent: data.percent ?? prev.percent,
          done: data.done,
        }
      })
    })
    return () => window.api.offOllamaPullProgress()
  }, [])

  const handleInstall = async (model: ModelDef) => {
    setPulling({ modelId: model.id, status: 'Iniciando descarga…', percent: 0, done: false })
    const res = await window.api.ollamaPullModel(model.id)
    if (res.error) {
      setPulling(prev => prev ? { ...prev, error: res.error, status: 'Error' } : null)
    } else {
      setPulling(prev => prev ? { ...prev, done: true, percent: 100, status: 'Instalado' } : null)
      onModelInstalled(model.id)
    }
  }

  const isInstalling = pulling && !pulling.done && !pulling.error
  const justInstalled = pulling?.done

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
           style={{ background: '#16161a', border: '1px solid #2e2e38', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 shrink-0"
             style={{ background: '#111114', borderBottom: '1px solid #2e2e38' }}>
          <div>
            <h2 className="font-sans font-semibold text-white text-base">
              Instalar modelo de IA local
            </h2>
            <p className="text-xs font-sans mt-1" style={{ color: '#9ca3af' }}>
              Se ejecuta en tu computadora. Sin costo, sin internet después de descargar.
            </p>
          </div>
          {!isInstalling && (
            <button onClick={onClose}
              className="text-xl leading-none ml-4 transition"
              style={{ color: '#6b7280' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>×</button>
          )}
        </div>

        {/* Progress — shown during/after pull */}
        {pulling && (
          <div className="px-6 py-4 shrink-0"
               style={{ background: pulling.error ? '#2a1010' : pulling.done ? '#0f2a1a' : '#0f1a2e',
                        borderBottom: '1px solid #2e2e38' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-sans font-semibold" style={{ color: pulling.error ? '#fca5a5' : pulling.done ? '#86efac' : '#93c5fd' }}>
                {pulling.error ? '✗ Error' : pulling.done ? `✓ ${CATALOG.find(m => m.id === pulling.modelId)?.name} instalado` : `⬇ Descargando ${CATALOG.find(m => m.id === pulling.modelId)?.name}…`}
              </span>
              {pulling.percent !== null && !pulling.done && !pulling.error && (
                <span className="text-xs font-sans font-mono" style={{ color: '#60a5fa' }}>{pulling.percent}%</span>
              )}
            </div>

            {/* Progress bar */}
            {!pulling.error && (
              <div className="rounded-full overflow-hidden h-1.5 mb-2"
                   style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: pulling.done ? '100%' : `${pulling.percent ?? 0}%`,
                    background: pulling.done ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                  }}
                />
              </div>
            )}

            <p className="text-[10px] font-sans font-mono truncate" style={{ color: '#6b7280' }}>
              {pulling.error || pulling.status}
            </p>

            {pulling.done && (
              <button onClick={onClose}
                className="mt-3 px-4 py-1.5 rounded text-xs font-sans font-semibold transition"
                style={{ background: '#166534', color: '#86efac' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#14532d')}
                onMouseLeave={e => (e.currentTarget.style.background = '#166534')}>
                Comenzar a usar →
              </button>
            )}
            {pulling.error && (
              <button onClick={() => setPulling(null)}
                className="mt-2 text-xs font-sans underline" style={{ color: '#f87171' }}>
                Intentar con otro modelo
              </button>
            )}
          </div>
        )}

        {/* Model catalog */}
        {!justInstalled && (
          <div className="overflow-y-auto flex-1 p-4 grid grid-cols-1 gap-2.5">
            {CATALOG.map(model => {
              const isInstalled = installedModels.some(m => m.startsWith(model.id.split(':')[0]))
              const isThisPulling = pulling?.modelId === model.id && !pulling.done && !pulling.error

              return (
                <div key={model.id}
                     className="flex items-center gap-4 rounded-lg px-4 py-3 transition"
                     style={{
                       background: model.recommended ? 'rgba(79,70,229,0.1)' : 'rgba(255,255,255,0.03)',
                       border: model.recommended ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.07)',
                     }}>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-sans font-semibold text-white">{model.name}</span>
                      <span className="text-[10px] font-sans px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                        {model.by}
                      </span>
                      {model.tag && (
                        <span className="text-[10px] font-sans px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                background: model.recommended ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.2)',
                                color: model.recommended ? '#a5b4fc' : '#6ee7b7',
                              }}>
                          {model.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-sans mt-0.5" style={{ color: '#9ca3af' }}>{model.desc}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-sans" style={{ color: '#6b7280' }}>💾 {model.size}</span>
                      <span className="text-[10px] font-sans" style={{ color: '#6b7280' }}>🧠 {model.ram} mín.</span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {isInstalled ? (
                      <span className="text-xs font-sans font-semibold px-3 py-1.5 rounded"
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                        ✓ Instalado
                      </span>
                    ) : isThisPulling ? (
                      <span className="text-xs font-sans" style={{ color: '#93c5fd' }}>Descargando…</span>
                    ) : (
                      <button
                        onClick={() => handleInstall(model)}
                        disabled={!!isInstalling}
                        className="px-3 py-1.5 rounded text-xs font-sans font-semibold transition"
                        style={{
                          background: isInstalling ? 'rgba(255,255,255,0.05)' : model.recommended ? '#4f46e5' : 'rgba(255,255,255,0.08)',
                          color: isInstalling ? '#4b5563' : '#fff',
                          cursor: isInstalling ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => { if (!isInstalling) e.currentTarget.style.background = model.recommended ? '#4338ca' : 'rgba(255,255,255,0.15)' }}
                        onMouseLeave={e => { if (!isInstalling) e.currentTarget.style.background = model.recommended ? '#4f46e5' : 'rgba(255,255,255,0.08)' }}
                      >
                        ⬇ Instalar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 shrink-0 flex items-center justify-between"
             style={{ borderTop: '1px solid #2e2e38' }}>
          <p className="text-[10px] font-sans" style={{ color: '#4b5563' }}>
            Necesitas{' '}
            <a href="https://ollama.com/download" target="_blank"
               className="underline" style={{ color: '#6b7280' }}
               onClick={e => { e.preventDefault(); window.open('https://ollama.com/download') }}>
              Ollama
            </a>
            {' '}instalado y corriendo. Ejecuta <code style={{ color: '#6b7280' }}>ollama serve</code> si no está activo.
          </p>
          {!isInstalling && !justInstalled && (
            <button onClick={onClose}
              className="text-xs font-sans transition px-3 py-1.5 rounded"
              style={{ color: '#6b7280' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#d1d5db')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
              Ahora no
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
