/**
 * FontPicker — searchable dropdown showing all fonts installed on the system.
 * Previews each font family name rendered in its own typeface.
 */
import React, { useState, useEffect, useRef } from 'react'
import { resolveFontFamily } from '../../lib/fontUtils'

// Common curated shortcuts shown at the top
const SHORTCUTS = [
  { label: 'Serif (Lora)',    value: 'serif' },
  { label: 'Sans (Figtree)',  value: 'sans' },
  { label: 'Mono',            value: 'mono' },
]

interface Props {
  value: string
  onChange: (v: string) => void
}

export function FontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [fonts, setFonts] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = async () => {
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 50)
    if (fonts.length === 0) {
      setLoading(true)
      try {
        const list = await window.api.listFonts()
        setFonts(list || [])
      } catch { /* ignore */ }
      setLoading(false)
    }
  }

  const all = [
    ...SHORTCUTS,
    ...fonts.map(f => ({ label: f, value: f })),
  ]

  const filtered = search
    ? all.filter(f => f.label.toLowerCase().includes(search.toLowerCase()))
    : all

  const displayLabel = SHORTCUTS.find(s => s.value === value)?.label ?? value

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      {/* Trigger */}
      <button
        onClick={handleOpen}
        style={{
          width: '100%',
          padding: '3px 8px',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          fontSize: 11,
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: resolveFontFamily(value),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLabel}</span>
        <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'sans-serif' }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 2,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999,
          maxHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 200,
        }}>
          {/* Search */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar fuente..."
              style={{
                width: '100%',
                padding: '3px 6px',
                fontSize: 11,
                border: '1px solid #e2e8f0',
                borderRadius: 3,
                outline: 'none',
                fontFamily: 'sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: '#94a3b8', fontFamily: 'sans-serif' }}>
                Cargando fuentes…
              </div>
            )}
            {filtered.slice(0, 100).map(f => (
              <div
                key={f.value}
                onClick={() => { onChange(f.value); setOpen(false); setSearch('') }}
                style={{
                  padding: '5px 10px',
                  fontSize: 13,
                  fontFamily: resolveFontFamily(f.value),
                  cursor: 'pointer',
                  background: f.value === value ? '#f0f4ff' : 'transparent',
                  color: f.value === value ? '#3b5bdb' : '#1e293b',
                  borderLeft: f.value === value ? '2px solid #6366f1' : '2px solid transparent',
                }}
                onMouseEnter={e => { if (f.value !== value) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => { if (f.value !== value) e.currentTarget.style.background = 'transparent' }}
              >
                {f.label}
              </div>
            ))}
            {filtered.length === 0 && !loading && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: '#94a3b8', fontFamily: 'sans-serif' }}>
                No se encontró "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
