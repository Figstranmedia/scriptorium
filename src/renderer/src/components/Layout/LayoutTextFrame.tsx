import React, { useRef, useCallback, useEffect, useState } from 'react'
import type { LayoutFrame } from '../../lib/threadEngine'
import { resolveFontFamily } from '../../lib/fontUtils'

interface Props {
  frame: LayoutFrame
  /** Threaded content from distributeContent (used when frame.ownContent is empty) */
  threadedContent: string
  isSelected: boolean
  isLinkingFrom: boolean
  isLinkTarget: boolean
  onSelect: (addToSelection?: boolean) => void
  onUpdate: (updates: Partial<LayoutFrame>) => void
  onDelete: () => void
  onStartLink: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  scale: number
}

export function LayoutTextFrameComp({
  frame, threadedContent, isSelected, isLinkingFrom, isLinkTarget,
  onSelect, onUpdate, onDelete, onStartLink, onContextMenu, scale,
}: Props) {
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, fw: 0, fh: 0 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const displayContent = frame.ownContent || threadedContent

  useEffect(() => {
    if (displayRef.current && !isEditing) {
      setIsOverflowing(displayRef.current.scrollHeight > displayRef.current.clientHeight)
    }
  }, [displayContent, frame.width, frame.height, isEditing])

  // Enter edit mode on double-click
  const enterEdit = useCallback((e: React.MouseEvent) => {
    if (frame.locked) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    setIsEditing(true)
  }, [frame.locked, onSelect])

  // Exit edit mode and save content
  const exitEdit = useCallback(() => {
    if (textareaRef.current) {
      onUpdate({ ownContent: textareaRef.current.value })
    }
    setIsEditing(false)
  }, [onUpdate])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  // Escape to exit edit mode
  useEffect(() => {
    if (!isEditing) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitEdit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isEditing, exitEdit])

  // Drag handlers — only when not editing
  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
  }, [frame.x, frame.y, onSelect, isEditing])

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
    : isEditing
    ? '#2563eb'
    : isSelected
    ? '#e3703f'
    : '#cbd5e1'

  const ff = resolveFontFamily(frame.fontFamily)

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    top: frame.paddingTop,
    left: frame.paddingLeft,
    right: frame.paddingRight,
    bottom: frame.paddingBottom,
    fontSize: frame.fontSize,
    lineHeight: frame.lineHeight,
    fontFamily: ff,
    fontWeight: frame.fontWeight || 'normal',
    fontStyle: frame.fontStyle || 'normal',
    color: frame.textColor || '#1a1714',
    textAlign: frame.textAlign || 'left',
    letterSpacing: frame.letterSpacing ? `${frame.letterSpacing}px` : undefined,
    columnCount: frame.columns > 1 ? frame.columns : undefined,
    columnGap: frame.columns > 1 ? frame.columnGutter : undefined,
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        border: isEditing
          ? '1.5px solid #2563eb'
          : (frame.borderWidth || 0) > 0
            ? `${frame.borderWidth}px ${frame.borderStyle || 'solid'} ${frame.borderColor || 'transparent'}`
            : `1.5px solid ${borderColor}`,
        boxSizing: 'border-box',
        cursor: frame.locked ? 'default' : isEditing ? 'text' : dragging ? 'grabbing' : 'grab',
        zIndex: isEditing ? 30 : isSelected ? 20 : (frame.zIndex || 10),
        background: isEditing ? 'rgba(255,255,255,0.97)' : (frame.backgroundColor || 'transparent'),
        boxShadow: isEditing ? '0 4px 20px rgba(0,0,0,0.15)' : undefined,
        borderRadius: frame.cornerRadius || 0,
        opacity: frame.opacity !== undefined ? frame.opacity : 1,
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!isEditing) onSelect(e.shiftKey || e.metaKey)
      }}
      onDoubleClick={enterEdit}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu?.(e) }}
    >
      {/* Display content (when not editing) */}
      {!isEditing && (
        <div
          ref={displayRef}
          style={{ ...textStyle, overflow: 'hidden', userSelect: 'none' }}
          dangerouslySetInnerHTML={{
            __html: frame.ownContent
              ? frame.ownContent.replace(/\n/g, '<br>')
              : (threadedContent || '')
          }}
        />
      )}

      {/* Edit mode — textarea overlay */}
      {isEditing && (
        <>
          <div style={{ position: 'absolute', top: -22, left: 0, display: 'flex', gap: 4, zIndex: 40 }}>
            <div style={{ background: '#2563eb', color: 'white', fontSize: 9, padding: '2px 6px', borderRadius: '4px 4px 0 0', fontFamily: 'sans-serif', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>✏️ Editando</span>
              <button
                onClick={(e) => { e.stopPropagation(); exitEdit() }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', fontSize: 9, padding: '1px 5px', borderRadius: 2, cursor: 'pointer' }}
              >
                ✓ Listo
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            defaultValue={frame.ownContent}
            onBlur={exitEdit}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: frame.paddingTop,
              left: frame.paddingLeft,
              right: frame.paddingRight,
              bottom: frame.paddingBottom,
              width: `calc(100% - ${frame.paddingLeft + frame.paddingRight}px)`,
              height: `calc(100% - ${frame.paddingTop + frame.paddingBottom}px)`,
              resize: 'none',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: frame.fontSize,
              lineHeight: frame.lineHeight,
              fontFamily: ff,
              fontWeight: frame.fontWeight || 'normal',
              color: frame.textColor || '#1a1714',
              textAlign: frame.textAlign || 'left',
              letterSpacing: frame.letterSpacing ? `${frame.letterSpacing}px` : undefined,
              padding: 0,
            }}
          />
        </>
      )}

      {/* Overflow indicator */}
      {!isEditing && isOverflowing && !frame.threadNextId && (
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          background: '#ef4444', color: 'white',
          fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '2px 0 0 0',
        }} title="Texto desbordado — vincula a otro marco">
          ⊠ overflow
        </div>
      )}

      {/* Thread indicators */}
      {frame.threadNextId && (
        <div style={{ position: 'absolute', bottom: -1, right: -1, background: '#6366f1', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '2px 0 0 0' }}>
          → cont.
        </div>
      )}
      {frame.threadPrevId && (
        <div style={{ position: 'absolute', top: -1, left: -1, background: '#6366f1', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '0 0 2px 0' }}>
          ← cont.
        </div>
      )}

      {/* Controls (shown when selected and not editing) */}
      {isSelected && !isEditing && (
        <>
          {/* Drag handle bar */}
          <div
            onMouseDown={onMouseDownDrag}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 20,
              cursor: 'grab',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingLeft: 4, paddingRight: 4,
              background: 'rgba(227, 112, 63, 0.08)',
            }}
          >
            <span style={{ fontSize: 9, fontFamily: 'sans-serif', color: '#e3703f', userSelect: 'none' }}>
              ⠿ {Math.round(frame.width)}×{Math.round(frame.height)}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onStartLink() }}
                style={{ fontSize: 9, background: '#6366f1', color: 'white', border: 'none', borderRadius: 2, padding: '1px 4px', cursor: 'pointer', fontFamily: 'sans-serif' }}
                title="Vincular flujo de texto a otro marco"
              >⛓ Vincular</button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                style={{ fontSize: 9, background: '#ef4444', color: 'white', border: 'none', borderRadius: 2, padding: '1px 4px', cursor: 'pointer', fontFamily: 'sans-serif' }}
              >✕</button>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onMouseDownResize}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 12, height: 12, background: '#e3703f', cursor: 'se-resize', borderRadius: 2 }}
          />

          {/* Column controls */}
          <div style={{ position: 'absolute', top: 22, right: -70, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate({ columns: Math.max(1, frame.columns - 1) }) }}
              style={colBtnStyle} title="Quitar columna"
            >-col</button>
            <span style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', fontFamily: 'sans-serif' }}>{frame.columns}col</span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate({ columns: Math.min(4, frame.columns + 1) }) }}
              style={colBtnStyle} title="Agregar columna"
            >+col</button>
          </div>
        </>
      )}

      {/* Lock badge */}
      {frame.locked && (
        <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 10, opacity: 0.4 }}>🔒</div>
      )}
    </div>
  )
}

const colBtnStyle: React.CSSProperties = {
  fontSize: 8, background: '#f1f5f9', color: '#64748b',
  border: '1px solid #e2e8f0', borderRadius: 2, padding: '1px 4px',
  cursor: 'pointer', fontFamily: 'sans-serif',
}
