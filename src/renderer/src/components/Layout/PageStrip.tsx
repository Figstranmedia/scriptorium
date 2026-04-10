/**
 * PageStrip — left sidebar with page thumbnails in Affinity Publisher spread layout.
 * Page 1 alone, then pages 2+3, 4+5, … shown as side-by-side spreads.
 */
import React, { useRef, useState } from 'react'
import type { AnyLayoutFrame } from '../../lib/threadEngine'
import { isImageFrame } from '../../lib/threadEngine'
import type { PageSize } from './LayoutPage'

interface Props {
  pageCount: number
  pageSize: PageSize
  frames: AnyLayoutFrame[]
  activePageIndex: number
  spreadPages: number[]
  width?: number
  onScrollToPage: (pageIndex: number) => void
  onAddPage: (afterIndex: number) => void
  onDeletePage: (pageIndex: number) => void
  onToggleSpread: (pageIndex: number) => void
}

// Build display groups: [[0], [1,2], [3,4], …]
function buildGroups(pageCount: number): number[][] {
  const groups: number[][] = []
  if (pageCount === 0) return groups
  groups.push([0]) // first page alone
  let i = 1
  while (i < pageCount) {
    if (i + 1 < pageCount) {
      groups.push([i, i + 1])
      i += 2
    } else {
      groups.push([i])
      i++
    }
  }
  return groups
}

export function PageStrip({
  pageCount, pageSize, frames, activePageIndex, spreadPages, width = 96,
  onScrollToPage, onAddPage, onDeletePage, onToggleSpread,
}: Props) {
  const [contextPage, setContextPage] = useState<number | null>(null)
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 })

  const aspect = pageSize.heightMM / pageSize.widthMM

  // Calculate thumb width to fit within the panel
  // For a spread pair the two thumbs must fit side-by-side with gap + padding
  const padding = 8
  const availableW = Math.max(60, width - padding * 2)

  const handleContextMenu = (e: React.MouseEvent, pageIndex: number) => {
    e.preventDefault()
    setContextPage(pageIndex)
    setContextPos({ x: e.clientX, y: e.clientY })
  }

  const groups = buildGroups(pageCount)

  return (
    <div style={{
      width,
      background: '#1a202c',
      borderRight: '1px solid #2d3748',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      userSelect: 'none',
      flexShrink: 0,
      transition: 'width 0.05s',
    }}>
      {groups.map(group => {
        const isSingle = group.length === 1
        // Thumbnail dimensions
        const thumbW = isSingle
          ? Math.min(availableW, 72)
          : Math.floor((availableW - 4) / 2) // pair with 4px gap

        const thumbH = Math.round(thumbW * aspect)
        const isActive = group.some(i => i === activePageIndex)
        const label = group.map(i => i + 1).join(', ')

        return (
          <div
            key={group[0]}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: `8px ${padding}px 4px`,
              cursor: 'pointer',
              background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
              borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
              transition: 'background 0.15s',
            }}
          >
            {/* Spread label */}
            <div style={{
              alignSelf: 'flex-start',
              fontSize: 9,
              color: isActive ? '#a5b4fc' : '#4a5568',
              fontFamily: 'system-ui, sans-serif',
              marginBottom: 4,
              letterSpacing: '0.03em',
              paddingLeft: 2,
            }}>
              {isSingle ? `Página ${label}` : `Páginas ${label}`}
            </div>

            {/* Thumbnail(s) */}
            <div style={{ display: 'flex', gap: isSingle ? 0 : 4 }}>
              {group.map(pageIdx => {
                const pageFrames = frames.filter(f => f.pageIndex === pageIdx)
                const isThisActive = pageIdx === activePageIndex

                return (
                  <div
                    key={pageIdx}
                    onClick={() => onScrollToPage(pageIdx)}
                    onContextMenu={(e) => handleContextMenu(e, pageIdx)}
                    title={`Página ${pageIdx + 1}`}
                    style={{
                      width: thumbW,
                      height: thumbH,
                      background: '#fff',
                      border: `1.5px solid ${isThisActive ? '#6366f1' : isActive ? 'rgba(99,102,241,0.4)' : '#2d3748'}`,
                      borderRadius: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      flexShrink: 0,
                      boxShadow: isThisActive ? '0 0 0 1px rgba(99,102,241,0.5)' : 'none',
                    }}
                  >
                    {/* Mini frame representations */}
                    {pageFrames.map(f => {
                      const scaleX = thumbW / ((pageSize.widthMM / 25.4) * 96)
                      const scaleY = thumbH / ((pageSize.heightMM / 25.4) * 96)
                      return (
                        <div key={f.id} style={{
                          position: 'absolute',
                          left: f.x * scaleX,
                          top: f.y * scaleY,
                          width: f.width * scaleX,
                          height: f.height * scaleY,
                          background: isImageFrame(f) ? 'rgba(168,85,247,0.2)' : 'rgba(99,102,241,0.15)',
                          border: `0.5px solid ${isImageFrame(f) ? 'rgba(168,85,247,0.4)' : 'rgba(99,102,241,0.3)'}`,
                          boxSizing: 'border-box',
                        }} />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Add page button */}
      <div
        onClick={() => onAddPage(pageCount - 1)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 4px',
          cursor: 'pointer',
          color: '#64748b',
          fontSize: 18,
          transition: 'color 0.15s',
          flexShrink: 0,
        }}
        title="Agregar página"
        onMouseEnter={e => (e.currentTarget.style.color = '#a5b4fc')}
        onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
      >+</div>

      {/* Context menu */}
      {contextPage !== null && (
        <PageContextMenu
          x={contextPos.x}
          y={contextPos.y}
          pageIndex={contextPage}
          pageCount={pageCount}
          onClose={() => setContextPage(null)}
          isSpread={spreadPages.includes(contextPage)}
          onInsertBefore={() => { onAddPage(contextPage - 1); setContextPage(null) }}
          onInsertAfter={() => { onAddPage(contextPage); setContextPage(null) }}
          onDelete={() => { onDeletePage(contextPage); setContextPage(null) }}
          onToggleSpread={() => { onToggleSpread(contextPage); setContextPage(null) }}
        />
      )}
    </div>
  )
}

function PageContextMenu({ x, y, pageIndex, pageCount, isSpread, onClose, onInsertBefore, onInsertAfter, onDelete, onToggleSpread }: {
  x: number; y: number; pageIndex: number; pageCount: number; isSpread: boolean
  onClose: () => void; onInsertBefore: () => void; onInsertAfter: () => void
  onDelete: () => void; onToggleSpread: () => void
}) {
  const items = [
    { label: `Página ${pageIndex + 1}`, header: true },
    { label: null },
    { label: isSpread ? '⊟ Convertir a página suelta' : '⊞ Convertir a doble página', action: onToggleSpread },
    { label: null },
    { label: '↑ Insertar página antes', action: onInsertBefore },
    { label: '↓ Insertar página después', action: onInsertAfter },
    { label: null },
    { label: '✕ Eliminar página', action: onDelete, danger: true, disabled: pageCount <= 1 },
  ]

  return (
    <div
      style={{
        position: 'fixed', left: x, top: y,
        background: '#222226', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 9999, padding: '4px 0', minWidth: 210,
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseLeave={onClose}
    >
      {items.map((item, i) => {
        if (!item.label) return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
        if ('header' in item && item.header) return (
          <div key={i} style={{ padding: '4px 12px', fontSize: 10, color: '#48484f', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {item.label}
          </div>
        )
        return (
          <div key={i}
            onClick={item.disabled ? undefined : item.action}
            style={{
              padding: '6px 14px', fontSize: 12,
              color: item.danger ? '#f87171' : '#c8c8cc',
              cursor: item.disabled ? 'default' : 'pointer',
              opacity: item.disabled ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >{item.label}</div>
        )
      })}
    </div>
  )
}
