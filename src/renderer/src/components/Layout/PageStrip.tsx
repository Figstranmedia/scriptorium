/**
 * PageStrip — left sidebar with page thumbnails (Block 7).
 * Click to scroll to page, right-click for insert/delete page.
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
  onScrollToPage: (pageIndex: number) => void
  onAddPage: (afterIndex: number) => void
  onDeletePage: (pageIndex: number) => void
}

export function PageStrip({ pageCount, pageSize, frames, activePageIndex, onScrollToPage, onAddPage, onDeletePage }: Props) {
  const [contextPage, setContextPage] = useState<number | null>(null)
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 })

  const aspect = pageSize.heightMM / pageSize.widthMM
  const thumbW = 72
  const thumbH = Math.round(thumbW * aspect)

  const handleContextMenu = (e: React.MouseEvent, pageIndex: number) => {
    e.preventDefault()
    setContextPage(pageIndex)
    setContextPos({ x: e.clientX, y: e.clientY })
  }

  return (
    <div style={{
      width: 88,
      background: '#1a202c',
      borderRight: '1px solid #2d3748',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      {Array.from({ length: pageCount }, (_, i) => {
        const pageFrames = frames.filter(f => f.pageIndex === i)
        const isActive = i === activePageIndex
        return (
          <div
            key={i}
            onClick={() => onScrollToPage(i)}
            onContextMenu={(e) => handleContextMenu(e, i)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 4px 4px',
              cursor: 'pointer',
              background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
              transition: 'background 0.15s',
            }}
          >
            {/* Thumbnail */}
            <div style={{
              width: thumbW,
              height: thumbH,
              background: '#fff',
              border: `1px solid ${isActive ? '#6366f1' : '#2d3748'}`,
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0,
            }}>
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
            {/* Page number */}
            <span style={{
              marginTop: 3,
              fontSize: 9,
              fontFamily: 'sans-serif',
              color: isActive ? '#a5b4fc' : '#64748b',
            }}>{i + 1}</span>
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
          onInsertBefore={() => { onAddPage(contextPage - 1); setContextPage(null) }}
          onInsertAfter={() => { onAddPage(contextPage); setContextPage(null) }}
          onDelete={() => { onDeletePage(contextPage); setContextPage(null) }}
        />
      )}
    </div>
  )
}

function PageContextMenu({ x, y, pageIndex, pageCount, onClose, onInsertBefore, onInsertAfter, onDelete }: {
  x: number; y: number; pageIndex: number; pageCount: number
  onClose: () => void; onInsertBefore: () => void; onInsertAfter: () => void; onDelete: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed', left: x, top: y,
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 9999, padding: '4px 0', minWidth: 180,
        fontFamily: 'sans-serif',
      }}
      onMouseLeave={onClose}
    >
      {[
        { label: 'Insertar página antes', action: onInsertBefore },
        { label: 'Insertar página después', action: onInsertAfter },
        { label: null },
        { label: 'Eliminar página', action: onDelete, danger: true, disabled: pageCount <= 1 },
      ].map((item, i) => {
        if (!item.label) return <div key={i} style={{ height: 1, background: '#334155', margin: '3px 0' }} />
        return (
          <div key={i}
            onClick={item.disabled ? undefined : item.action}
            style={{
              padding: '5px 14px', fontSize: 12,
              color: item.danger ? '#f87171' : '#e2e8f0',
              cursor: item.disabled ? 'default' : 'pointer',
              opacity: item.disabled ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = '#2d3f5a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >{item.label}</div>
        )
      })}
    </div>
  )
}
