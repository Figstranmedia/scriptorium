import React, { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  icon?: string
  shortcut?: string
  action: () => void
  danger?: boolean
  separator?: never
}

export interface ContextMenuSeparator {
  separator: true
  label?: never
  icon?: never
  action?: never
}

type MenuItem = ContextMenuItem | ContextMenuSeparator

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', handler)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', handler); window.removeEventListener('keydown', esc) }
  }, [onClose])

  // Adjust position so menu doesn't go off-screen
  const adjX = Math.min(x, window.innerWidth - 200)
  const adjY = Math.min(y, window.innerHeight - items.length * 30 - 20)

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjX,
        top: adjY,
        minWidth: 190,
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 6,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 9999,
        padding: '4px 0',
        fontFamily: 'sans-serif',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return <div key={i} style={{ height: 1, background: '#334155', margin: '3px 0' }} />
        }
        const it = item as ContextMenuItem
        return (
          <div
            key={i}
            onClick={() => { it.action(); onClose() }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              fontSize: 12,
              color: it.danger ? '#f87171' : '#e2e8f0',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2d3f5a')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {it.icon && <span style={{ fontSize: 12, opacity: 0.8 }}>{it.icon}</span>}
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.shortcut && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 8 }}>{it.shortcut}</span>}
          </div>
        )
      })}
    </div>
  )
}
