import React, { useState, useRef, useCallback, useEffect } from 'react'

export interface TextFrameData {
  id: string
  x: number
  y: number
  width: number
  height: number
  content: string
  style: 'default' | 'callout' | 'sidebar' | 'caption'
}

const FRAME_STYLES: Record<TextFrameData['style'], string> = {
  default: 'bg-white border border-ink-300',
  callout: 'bg-accent-50 border-2 border-accent-400',
  sidebar: 'bg-ink-800 text-white border-0',
  caption: 'bg-transparent border border-dashed border-ink-300',
}

interface Props {
  frame: TextFrameData
  onUpdate: (id: string, updates: Partial<TextFrameData>) => void
  onDelete: (id: string) => void
  containerRef: React.RefObject<HTMLDivElement>
}

export function TextFrame({ frame, onUpdate, onDelete, containerRef }: Props) {
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, fw: 0, fh: 0 })

  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (editing) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
  }, [editing, frame.x, frame.y])

  const onMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, fw: frame.width, fh: frame.height }
  }, [frame.width, frame.height])

  useEffect(() => {
    if (!dragging && !resizing) return
    const handleMove = (e: MouseEvent) => {
      if (dragging) {
        const dx = e.clientX - dragStart.current.mx
        const dy = e.clientY - dragStart.current.my
        onUpdate(frame.id, { x: dragStart.current.fx + dx, y: dragStart.current.fy + dy })
      }
      if (resizing) {
        const dx = e.clientX - resizeStart.current.mx
        const dy = e.clientY - resizeStart.current.my
        onUpdate(frame.id, {
          width: Math.max(120, resizeStart.current.fw + dx),
          height: Math.max(60, resizeStart.current.fh + dy),
        })
      }
    }
    const handleUp = () => { setDragging(false); setResizing(false) }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [dragging, resizing, frame.id, onUpdate])

  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        zIndex: 10,
        userSelect: editing ? 'text' : 'none',
      }}
      className={`rounded-lg shadow-md overflow-visible ${FRAME_STYLES[frame.style]}`}
    >
      {/* Drag handle + controls */}
      <div
        onMouseDown={onMouseDownDrag}
        onDoubleClick={() => setEditing(true)}
        className={`flex items-center justify-between px-2 py-1 cursor-move ${
          frame.style === 'sidebar' ? 'bg-ink-700' : 'bg-ink-100 border-b border-ink-200'
        } rounded-t-lg`}
        title="Doble clic para editar, arrastrar para mover"
      >
        <span className="text-[10px] font-sans text-ink-400 select-none">Marco</span>
        <div className="flex gap-1">
          {/* Style picker */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setShowMenu(!showMenu)}
            className="text-ink-400 hover:text-ink-600 text-[11px] px-1 leading-none"
            title="Cambiar estilo"
          >⋯</button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(frame.id)}
            className="text-ink-400 hover:text-red-500 text-[11px] px-0.5 leading-none"
            title="Eliminar marco"
          >✕</button>
        </div>
      </div>

      {/* Style menu */}
      {showMenu && (
        <div
          className="absolute top-7 right-0 bg-white border border-ink-200 rounded-lg shadow-lg z-20 py-1 min-w-[120px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {(['default', 'callout', 'sidebar', 'caption'] as TextFrameData['style'][]).map(s => (
            <button
              key={s}
              onClick={() => { onUpdate(frame.id, { style: s }); setShowMenu(false) }}
              className={`block w-full text-left px-3 py-1.5 text-xs font-sans hover:bg-ink-50 transition ${frame.style === s ? 'font-semibold text-accent-600' : 'text-ink-600'}`}
            >
              {{
                default: '⬜ Estándar',
                callout: '🟧 Destacado',
                sidebar: '⬛ Nota lateral',
                caption: '⬜ Leyenda',
              }[s]}
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="p-2 h-[calc(100%-30px)] overflow-auto">
        {editing ? (
          <textarea
            autoFocus
            value={frame.content}
            onChange={(e) => onUpdate(frame.id, { content: e.target.value })}
            onBlur={() => setEditing(false)}
            className={`w-full h-full resize-none outline-none text-sm font-serif bg-transparent leading-relaxed ${
              frame.style === 'sidebar' ? 'text-white placeholder-ink-400' : 'text-ink-700'
            }`}
            placeholder="Escribe aquí..."
          />
        ) : (
          <div
            className={`text-sm font-serif leading-relaxed whitespace-pre-wrap cursor-text ${
              frame.style === 'sidebar' ? 'text-ink-200' : 'text-ink-700'
            } ${!frame.content ? 'text-ink-400 italic' : ''}`}
            onDoubleClick={() => setEditing(true)}
          >
            {frame.content || 'Doble clic para escribir...'}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onMouseDownResize}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end pr-0.5 pb-0.5"
        title="Redimensionar"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-ink-400">
          <path d="M7 1L1 7M7 4L4 7M7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}
