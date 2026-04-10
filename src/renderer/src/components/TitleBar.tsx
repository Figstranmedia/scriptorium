import React, { useState, useEffect, useRef } from 'react'

interface Props {
  store: any
  onNewDoc: () => void
  onOpenFile?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onShowInFinder?: () => void
  onPrint?: () => void
  onImportPDF?: () => void
  onImportDOCX?: () => void
  onImportPDFAsImages?: () => void
  onCloseDoc?: () => void
  onToggleTheme?: () => void
}

// ─── Submenu item types ──────────────────────────────────────────────────────
type MenuItem =
  | { type: 'item'; label: string; shortcut?: string; action: () => void; disabled?: boolean }
  | { type: 'separator' }
  | { type: 'submenu'; label: string; items: MenuItem[] }

// ─── Recursive menu renderer ─────────────────────────────────────────────────
function MenuItems({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [openSub, setOpenSub] = useState<string | null>(null)

  return (
    <>
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={i} className="my-1 border-t border-white/10" />
        }
        if (item.type === 'submenu') {
          return (
            <div
              key={i}
              className="relative"
              onMouseEnter={() => setOpenSub(item.label)}
              onMouseLeave={() => setOpenSub(null)}
            >
              <div className="flex items-center justify-between px-3 py-1.5 rounded hover:bg-white/10 cursor-default text-xs text-ink-100 select-none">
                <span>{item.label}</span>
                <span className="ml-4 text-ink-400">›</span>
              </div>
              {openSub === item.label && (
                <div className="absolute left-full top-0 ml-1 bg-ink-800 border border-white/10 rounded-lg shadow-xl min-w-[180px] py-1 z-[200]">
                  <MenuItems items={item.items} onClose={onClose} />
                </div>
              )}
            </div>
          )
        }
        // type === 'item'
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { item.action(); onClose() }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs text-left transition select-none
              ${item.disabled
                ? 'text-ink-500 cursor-default'
                : 'text-ink-100 hover:bg-white/10 cursor-default'
              }`}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="ml-4 text-ink-500 font-mono text-[10px]">{item.shortcut}</span>}
          </button>
        )
      })}
    </>
  )
}

// ─── Ollama status dot ────────────────────────────────────────────────────────
function OllamaDot({ status, model }: { status: string; model: string }) {
  const colors: Record<string, string> = {
    idle:     'bg-ink-600',
    checking: 'bg-yellow-400 animate-pulse',
    online:   'bg-emerald-400',
    offline:  'bg-red-500',
  }
  const labels: Record<string, string> = {
    idle:     'Agente: no verificado',
    checking: 'Verificando agente local…',
    online:   `Agente local: ${model || 'Ollama'}`,
    offline:  'Agente local: sin conexión',
  }

  return (
    <div className="flex items-center gap-1.5 titlebar-nodrag" title={labels[status] || ''}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors[status] || colors.idle}`} />
      {status === 'online' && model && (
        <span className="text-[10px] text-emerald-400 font-sans max-w-[120px] truncate hidden sm:block">
          {model}
        </span>
      )}
      {status === 'offline' && (
        <span className="text-[10px] text-red-400 font-sans hidden sm:block">offline</span>
      )}
    </div>
  )
}

// ─── Main TitleBar ────────────────────────────────────────────────────────────
export function TitleBar({ store, onNewDoc, onOpenFile, onSave, onSaveAs, onShowInFinder, onPrint, onImportPDF, onImportDOCX, onImportPDFAsImages, onCloseDoc, onToggleTheme }: Props) {
  const doc = store.activeDoc
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Recent docs: last 5 sorted by updatedAt
  const recentDocs = [...store.documents]
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
    .slice(0, 5)

  const hasFilePath = !!(doc as any)?.filePath

  const menuItems: MenuItem[] = [
    // ── Nuevo / Abrir ──────────────────────────────────────────────────────────
    {
      type: 'item',
      label: 'Nuevo documento',
      shortcut: '⌘N',
      action: onNewDoc,
    },
    {
      type: 'item',
      label: 'Abrir…',
      shortcut: '⌘O',
      action: () => onOpenFile && onOpenFile(),
    },
    {
      type: 'submenu',
      label: 'Abrir reciente',
      items: recentDocs.length > 0
        ? recentDocs.map((d: any) => ({
            type: 'item' as const,
            label: d.title || 'Sin título',
            action: () => store.setActiveDocId(d.id),
          }))
        : [{ type: 'item' as const, label: 'Sin documentos recientes', disabled: true, action: () => {} }],
    },
    { type: 'separator' },
    // ── Guardar ───────────────────────────────────────────────────────────────
    {
      type: 'item',
      label: 'Guardar',
      shortcut: '⌘S',
      disabled: !doc,
      action: () => onSave && onSave(),
    },
    {
      type: 'item',
      label: 'Guardar como…',
      shortcut: '⌘⇧S',
      disabled: !doc,
      action: () => onSaveAs && onSaveAs(),
    },
    { type: 'separator' },
    // ── Finder / Imprimir ─────────────────────────────────────────────────────
    {
      type: 'item',
      label: 'Mostrar en Finder',
      disabled: !hasFilePath,
      action: () => onShowInFinder && onShowInFinder(),
    },
    {
      type: 'item',
      label: 'Imprimir…',
      shortcut: '⌘P',
      disabled: !doc,
      action: () => onPrint && onPrint(),
    },
    { type: 'separator' },
    // ── Importar / Exportar ───────────────────────────────────────────────────
    {
      type: 'submenu',
      label: 'Importar',
      items: [
        {
          type: 'item',
          label: 'PDF (texto)…',
          action: () => {
            if (onImportPDF) onImportPDF()
            else if ((window as any).__triggerPDFImport) (window as any).__triggerPDFImport()
          },
        },
        {
          type: 'item',
          label: 'PDF (imágenes)…',
          action: () => {
            if (onImportPDFAsImages) onImportPDFAsImages()
            else if ((window as any).__triggerPDFImportAsImages) (window as any).__triggerPDFImportAsImages()
          },
        },
        {
          type: 'item',
          label: 'Word / DOCX…',
          action: () => {
            if (onImportDOCX) onImportDOCX()
            else if ((window as any).__triggerDOCXImport) (window as any).__triggerDOCXImport()
          },
        },
      ],
    },
    {
      type: 'submenu',
      label: 'Exportar',
      items: [
        {
          type: 'item',
          label: 'PDF…',
          shortcut: '⌘E',
          disabled: !doc,
          action: () => store.setShowExport(true),
        },
        {
          type: 'item',
          label: 'PNG (páginas)…',
          disabled: !doc,
          action: () => store.setShowExport(true),
        },
        {
          type: 'item',
          label: 'SVG / Affinity…',
          disabled: !doc,
          action: () => store.setShowExport(true),
        },
        {
          type: 'item',
          label: 'Word / DOCX…',
          disabled: !doc,
          action: () => store.setShowExport(true),
        },
      ],
    },
    { type: 'separator' },
    // ── Preferencias ─────────────────────────────────────────────────────────
    {
      type: 'item',
      label: 'Preferencias del documento',
      disabled: !doc,
      action: () => store.setShowSettings(true),
    },
    {
      type: 'item',
      label: 'Ajustes de IA',
      shortcut: '⌘,',
      action: () => store.setShowSettings(true),
    },
    { type: 'separator' },
    // ── Cerrar ────────────────────────────────────────────────────────────────
    {
      type: 'item',
      label: 'Cerrar documento',
      shortcut: '⌘W',
      disabled: !doc,
      action: () => {
        if (doc) {
          if (onCloseDoc) onCloseDoc()
          else store.deleteDocument(doc.id)
        }
      },
    },
  ]

  return (
    <div className="titlebar-drag h-10 flex items-center px-4 gap-3 select-none shrink-0"
      style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
      {/* macOS traffic lights space */}
      <div className="w-16 shrink-0 titlebar-nodrag" />

      {/* File menu */}
      <div className="relative titlebar-nodrag" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className={`px-2.5 py-1 rounded text-xs font-sans transition
            ${menuOpen
              ? 'bg-white/15 text-white'
              : 'text-ink-300 hover:bg-white/10 hover:text-white'
            }`}
        >
          Archivo
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-full mt-1 rounded-lg shadow-2xl min-w-[220px] py-1 z-[100]"
            style={{ background: '#222226', border: '1px solid rgba(255,255,255,0.08)' }}>
            <MenuItems items={menuItems} onClose={() => setMenuOpen(false)} />
          </div>
        )}
      </div>

      {/* Separator */}
      <span style={{ color: 'var(--app-text-dim)' }}>·</span>

      {/* App name */}
      <span className="text-xs font-sans tracking-widest uppercase" style={{ color: 'var(--app-text-dim)', letterSpacing: '0.15em' }}>Scriptorium</span>

      {/* Doc title */}
      {doc && (
        <>
          <span style={{ color: 'var(--app-text-dim)' }}>·</span>
          <span
            className="text-sm font-serif truncate max-w-xs"
            style={{ color: 'var(--app-text)' }}
            title={doc.title}
          >
            {doc.title}
          </span>
          {doc.filePath && (
            <span className="text-[10px] font-sans truncate max-w-[160px] hidden md:block" style={{ color: 'var(--app-text-dim)' }} title={doc.filePath}>
              {doc.filePath.split('/').pop()}
            </span>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* Ollama status */}
      <OllamaDot status={store.ollamaStatus} model={store.ollamaActiveModel} />

      {/* Actions */}
      <div className="flex items-center gap-1.5 titlebar-nodrag">
        {/* Theme toggle */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            title={store.theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="px-2 py-1 rounded text-xs transition"
            style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--app-text-muted)' }}
          >
            {store.theme === 'dark' ? '☀' : '◗'}
          </button>
        )}
        <button
          onClick={() => store.setSidebarOpen(!store.sidebarOpen)}
          title="Panel IA"
          className="px-3 py-1 rounded text-xs transition font-sans"
          style={{
            background: store.sidebarOpen ? 'rgba(41,151,255,0.25)' : 'rgba(128,128,128,0.1)',
            color: store.sidebarOpen ? '#60a5fa' : 'var(--app-text-muted)',
          }}
        >
          IA
        </button>
        <button
          onClick={() => store.setShowSettings(true)}
          title="Ajustes (⌘,)"
          className="px-2 py-1 rounded text-xs transition"
          style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--app-text-muted)' }}
        >
          ⚙
        </button>
      </div>
    </div>
  )
}
