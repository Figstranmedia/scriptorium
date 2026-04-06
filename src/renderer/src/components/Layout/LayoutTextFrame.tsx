import React, { useRef, useCallback, useEffect, useState } from 'react'
import type { LayoutFrame } from '../../lib/threadEngine'

interface Props {
  frame: LayoutFrame
  content: string
  isSelected: boolean
  isLinkingFrom: boolean
  isLinkTarget: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<LayoutFrame>) => void
  onDelete: () => void
  onStartLink: () => void
  scale: number
}

export function LayoutTextFrameComp({
  frame, content, isSelected, isLinkingFrom, isLinkTarget,
  onSelect, onUpdate, onDelete, onStartLink, scale,
}: Props) {
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, fw: 0, fh: 0 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)

  // Check overflow: content renders beyond the frame's inner height
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > contentRef.current.clientHeight)
    }
  }, [content, frame.width, frame.height])

  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
  }, [frame.x, frame.y, onSelect])

  const onMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, fw: frame.width, fh: frame.height }
  }, [frame.width, frame.height])

  useEffect(() => {
    if (!dragging && !resizing) return
    const move = (e: MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragStart.current.mx) / scale
        const dy = (e.clientY - dragStart.current.my) / scale
        onUpdate({ x: dragStart.current.fx + dx, y: dragStart.current.fy + dy })
      }
      if (resizing) {
        const dx = (e.clientX - resizeStart.current.mx) / scale
        const dy = (e.clientY - resizeStart.current.my) / scale
        onUpdate({
          width: Math.max(80, resizeStart.current.fw + dx),
          height: Math.max(60, resizeStart.current.fh + dy),
        })
      }
    }
    const up = () => { setDragging(false); setResizing(false) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, resizing, scale, onUpdate])

  const borderColor = isLinkingFrom
    ? '#6366f1'
    : isLinkTarget
    ? '#10b981'
    : isSelected
    ? '#e3703f'
    : '#cbd5e1'

  const ff = frame.fontFamily === 'serif'
    ? 'Lora, Georgia, serif'
    : frame.fontFamily === 'sans'
    ? 'Figtree, sans-serif'
    : 'monospace'

  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        border: `1.5px solid ${borderColor}`,
        boxSizing: 'border-box',
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 20 : 10,
        background: 'transparent',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Content area */}
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          top: frame.paddingTop,
          left: frame.paddingLeft,
          right: frame.paddingRight,
          bottom: frame.paddingBottom,
          overflow: 'hidden',
          fontSize: frame.fontSize,
          lineHeight: frame.lineHeight,
          fontFamily: ff,
          columnCount: frame.columns > 1 ? frame.columns : undefined,
          columnGap: frame.columns > 1 ? frame.columnGutter : undefined,
          color: '#1a1714',
          userSelect: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: content || '' }}
      />

      {/* Overflow indicator */}
      {isOverflowing && !frame.threadNextId && (
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            background: '#ef4444',
            color: 'white',
            fontSize: 9,
            padding: '1px 4px',
            fontFamily: 'sans-serif',
            borderRadius: '2px 0 0 0',
          }}
          title="Texto desbordado — vincula a otro marco"
        >
          ⊠ overflow
        </div>
      )}

      {/* Thread indicator: has next */}
      {frame.threadNextId && (
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            background: '#6366f1',
            color: 'white',
            fontSize: 9,
            padding: '1px 4px',
            fontFamily: 'sans-serif',
            borderRadius: '2px 0 0 0',
          }}
        >
          → cont.
        </div>
      )}
      {frame.threadPrevId && (
        <div
          style={{
            position: 'absolute',
            top: -1,
            left: -1,
            background: '#6366f1',
            color: 'white',
            fontSize: 9,
            padding: '1px 4px',
            fontFamily: 'sans-serif',
            borderRadius: '0 0 2px 0',
          }}
        >
          ← cont.
        </div>
      )}

      {/* Controls (shown when selected) */}
      {isSelected && (
        <>
          {/* Drag handle */}
          <div
            onMouseDown={onMouseDownDrag}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 20,
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 4,
              paddingRight: 4,
              background: 'rgba(227, 112, 63, 0.08)',
            }}
          >
            <span style={{ fontSize: 9, fontFamily: 'sans-serif', color: '#e3703f', userSelect: 'none' }}>
              ⠿ {Math.round(frame.width)}×{Math.round(frame.height)}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* Link button */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onStartLink() }}
                style={{
                  fontSize: 9, background: '#6366f1', color: 'white',
                  border: 'none', borderRadius: 2, padding: '1px 4px',
                  cursor: 'pointer', fontFamily: 'sans-serif',
                }}
                title="Vincular flujo de texto a otro marco"
              >
                ⛓ Vincular
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                style={{
                  fontSize: 9, background: '#ef4444', color: 'white',
                  border: 'none', borderRadius: 2, padding: '1px 4px',
                  cursor: 'pointer', fontFamily: 'sans-serif',
                }}
              >✕</button>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onMouseDownResize}
            style={{
              position: 'absolute',
              bottom: -4, right: -4,
              width: 12, height: 12,
              background: '#e3703f',
              cursor: 'se-resize',
              borderRadius: 2,
            }}
          />

          {/* Column handles */}
          <div style={{
            position: 'absolute',
            top: 22,
            right: -70,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate({ columns: Math.max(1, frame.columns - 1) }) }}
              style={colBtnStyle}
              title="Quitar columna"
            >-col</button>
            <span style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', fontFamily: 'sans-serif' }}>
              {frame.columns}col
            </span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate({ columns: Math.min(4, frame.columns + 1) }) }}
              style={colBtnStyle}
              title="Agregar columna"
            >+col</button>
          </div>
        </>
      )}
    </div>
  )
}

const colBtnStyle: React.CSSProperties = {
  fontSize: 8,
  background: '#f1f5f9',
  color: '#64748b',
  border: '1px solid #e2e8f0',
  borderRadius: 2,
  padding: '1px 4px',
  cursor: 'pointer',
  fontFamily: 'sans-serif',
}
