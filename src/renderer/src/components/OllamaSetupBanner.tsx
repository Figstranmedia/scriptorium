import React from 'react'

type BannerMode = 'not-running' | 'no-models'

interface Props {
  mode: BannerMode
  onSetupModels: () => void
  onDismiss: () => void
}

export function OllamaSetupBanner({ mode, onSetupModels, onDismiss }: Props) {
  if (mode === 'not-running') {
    return (
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-sans flex-shrink-0"
           style={{ background: '#2d1e00', borderBottom: '1px solid #7c4500', color: '#fbbf24' }}>
        <span className="text-base">🖥</span>
        <div className="flex-1">
          <span className="font-semibold">Ollama no está corriendo.</span>
          {' '}Para usar IA local, instala Ollama y ejecuta{' '}
          <code className="px-1 py-0.5 rounded font-mono" style={{ background: '#3d2800', color: '#fcd34d' }}>
            ollama serve
          </code>
          {' '}en tu terminal.
        </div>
        <a
          href="https://ollama.com/download"
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1 rounded text-xs font-semibold transition shrink-0"
          style={{ background: '#92400e', color: '#fef3c7' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#b45309')}
          onMouseLeave={e => (e.currentTarget.style.background = '#92400e')}
          onClick={e => { e.preventDefault(); window.open('https://ollama.com/download') }}
        >
          Descargar Ollama
        </a>
        <button onClick={onDismiss}
          className="text-sm leading-none transition shrink-0"
          style={{ color: '#d97706', opacity: 0.7 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          title="Cerrar">×</button>
      </div>
    )
  }

  // no-models
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs font-sans flex-shrink-0"
         style={{ background: '#0c1a2e', borderBottom: '1px solid #1e3a5f', color: '#93c5fd' }}>
      <span className="text-base">📦</span>
      <div className="flex-1">
        <span className="font-semibold">Ollama detectado, pero sin modelos instalados.</span>
        {' '}Descarga un modelo para usar IA local sin costo ni internet.
      </div>
      <button
        onClick={onSetupModels}
        className="px-3 py-1 rounded text-xs font-semibold transition shrink-0"
        style={{ background: '#1e3a5f', color: '#bfdbfe' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#1e4080')}
        onMouseLeave={e => (e.currentTarget.style.background = '#1e3a5f')}
      >
        Instalar modelo
      </button>
      <button onClick={onDismiss}
        className="text-sm leading-none transition shrink-0"
        style={{ color: '#60a5fa', opacity: 0.7 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        title="Cerrar">×</button>
    </div>
  )
}
