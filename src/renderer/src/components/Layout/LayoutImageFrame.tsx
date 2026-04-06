import React, { useRef, useCallback, useEffect, useState } from 'react'
import type { LayoutImageFrame } from '../../lib/threadEngine'

interface Props {
  frame: LayoutImageFrame
  isSelected: boolean
  onSelect: (addToSelection?: boolean) => void
  onUpdate: (updates: Partial<LayoutImageFrame>) => void
  onDelete: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  scale: number
}

export function LayoutImageFrameComp({ frame, isSelected, onSelect, onUpdate, onDelete, onContextMenu, scale }: Props) {
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, fw: 0, fh: 0 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)

  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
  }, [frame.x, frame.y, onSelect])

  const onMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); setResizing(true)
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
          width: Math.max(50, resizeStart.current.fw + dx),
          height: Math.max(40, resizeStart.current.fh + dy),
        })
      }
    }
    const up = () => { setDragging(false); setResizing(false) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, resizing, scale, onUpdate])

  const handlePickImage = async () => {
    const src = await window.api.pickImage()
    if (src) onUpdate({ src })
  }

  const objectFit = frame.fit === 'fill' ? 'cover' : frame.fit === 'crop' ? 'cover' : 'contain'

  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x, top: frame.y,
        width: frame.width, height: frame.height,
        border: (frame.borderWidth || 0) > 0
          ? `${frame.borderWidth}px solid ${frame.borderColor || '#cbd5e1'}`
          : `1.5px solid ${isSelected ? '#e3703f' : '#cbd5e1'}`,
        boxSizing: 'border-box',
        background: '#f8f7f4',
        cursor: dragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        zIndex: isSelected ? 20 : (frame.zIndex || 10),
        borderRadius: frame.cornerRadius || 0,
        opacity: frame.opacity !== undefined ? frame.opacity : 1,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey || e.metaKey) }}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu?.(e) }}
    >
      {/* Image */}
      {frame.src ? (
        <img
          src={frame.src}
          alt={frame.caption}
          style={{ width: '100%', height: frame.caption ? 'calc(100% - 24px)' : '100%', objectFit, display: 'block' }}
          draggable={false}
        />
      ) : (
        <div
          style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}
          onDoubleClick={handlePickImage}
        >
          <span style={{ fontSize: 24, opacity: 0.3 }}>🖼</span>
          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'sans-serif' }}>Doble clic para seleccionar imagen</span>
        </div>
      )}

      {/* Caption */}
      {frame.caption && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.5)', color: 'white',
          fontSize: 9, padding: '3px 6px', fontFamily: 'sans-serif',
        }}>
          {frame.caption}
        </div>
      )}

      {/* Controls */}
      {isSelected && (
        <>
          <div
            onMouseDown={onMouseDownDrag}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 20,
              cursor: 'grab', background: 'rgba(227, 112, 63, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 4px',
            }}
          >
            <span style={{ fontSize: 8, color: '#e3703f', fontFamily: 'sans-serif', userSelect: 'none' }}>
              🖼 {Math.round(frame.width)}×{Math.round(frame.height)}
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); handlePickImage() }}
                style={{ ...smallBtnStyle, background: '#6366f1' }}>📁</button>
              {/* Fit toggle */}
              {(['fit', 'fill', 'crop'] as const).map(f => (
                <button key={f} onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onUpdate({ fit: f }) }}
                  style={{ ...smallBtnStyle, background: frame.fit === f ? '#e3703f' : '#94a3b8' }}>
                  {f}
                </button>
              ))}
              <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete() }}
                style={{ ...smallBtnStyle, background: '#ef4444' }}>✕</button>
            </div>
          </div>
          <div onMouseDown={onMouseDownResize}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 12, height: 12, background: '#e3703f', cursor: 'se-resize', borderRadius: 2 }}
          />
        </>
      )}
    </div>
  )
}

const smallBtnStyle: React.CSSProperties = {
  fontSize: 8, color: 'white', border: 'none',
  borderRadius: 2, padding: '1px 4px', cursor: 'pointer', fontFamily: 'sans-serif',
}
