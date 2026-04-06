import React from 'react'

interface Props {
  store: any
  onNewDoc: () => void
}

export function TitleBar({ store, onNewDoc }: Props) {
  const doc = store.activeDoc

  return (
    <div className="titlebar-drag h-11 flex items-center px-4 gap-3 bg-ink-800 text-ink-200 select-none shrink-0">
      {/* macOS traffic lights space */}
      <div className="w-16 shrink-0 titlebar-nodrag" />

      {/* App name */}
      <span className="text-ink-400 text-xs font-sans tracking-widest uppercase">Scriptorium</span>
      <span className="text-ink-600">·</span>

      {/* Doc title */}
      {doc && (
        <span
          className="text-sm font-serif text-ink-200 truncate max-w-xs"
          title={doc.title}
        >
          {doc.title}
        </span>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2 titlebar-nodrag">
        <button
          onClick={onNewDoc}
          title="Nuevo documento"
          className="px-3 py-1 rounded text-xs bg-ink-700 hover:bg-ink-600 text-ink-200 transition font-sans"
        >
          + Nuevo
        </button>
        <button
          onClick={() => store.setSidebarOpen(!store.sidebarOpen)}
          title="Panel IA"
          className={`px-3 py-1 rounded text-xs transition font-sans ${
            store.sidebarOpen
              ? 'bg-accent-600 text-white'
              : 'bg-ink-700 hover:bg-ink-600 text-ink-200'
          }`}
        >
          IA
        </button>
        <button
          onClick={() => store.setShowSettings(true)}
          title="Ajustes"
          className="px-2 py-1 rounded text-xs bg-ink-700 hover:bg-ink-600 text-ink-200 transition"
        >
          ⚙
        </button>
      </div>
    </div>
  )
}
