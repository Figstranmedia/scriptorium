import React, { useRef, useCallback, useEffect, useState } from 'react'
import type { LayoutShapeFrame } from '../../lib/threadEngine'

interface Props {
  frame: LayoutShapeFrame
  isSelected: boolean
  onSelect: (addToSelection?: boolean) => void
  onUpdate: (updates: Partial<LayoutShapeFrame>) => void
  onDelete: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  scale: number
}

const DASH: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '8 4',
  dotted: '2 4',
}

function ShapeSVG({ frame }: { frame: LayoutShapeFrame }) {
  const { width: w, height: h, shapeType, fillColor, strokeColor, strokeWidth: sw, strokeStyle, cornerRadius } = frame
  const da = DASH[strokeStyle]

  const sharedStroke = {
    stroke: strokeColor || 'none',
    strokeWidth: sw,
    ...(da ? { strokeDasharray: da } : {}),
  }

  if (shapeType === 'rect') {
    const half = sw / 2
    return (
      <svg width={w} height={h} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', overflow: 'visible' }}>
        <rect
          x={half} y={half}
          width={Math.max(0, w - sw)} height={Math.max(0, h - sw)}
          fill={fillColor || 'transparent'}
          rx={cornerRadius} ry={cornerRadius}
          {...sharedStroke}
        />
      </svg>
    )
  }

  if (shapeType === 'ellipse') {
    const rx = Math.max(0, (w - sw) / 2)
    const ry = Math.max(0, (h - sw) / 2)
    return (
      <svg width={w} height={h} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', overflow: 'visible' }}>
        <ellipse
          cx={w / 2} cy={h / 2}
          rx={rx} ry={ry}
          fill={fillColor || 'transparent'}
          {...sharedStroke}
        />
      </svg>
    )
  }

  // line — runs from left-center to right-center
  return (
    <svg width={w} height={Math.max(h, sw + 2)} xmlns="http://www.w3.org/2000/svg"
         style={{ display: 'block', overflow: 'visible' }}>
      <line
        x1={0} y1={h / 2}
        x2={w} y2={h / 2}
        stroke={strokeColor || '#64748b'}
        strokeWidth={sw}
        {...(da ? { strokeDasharray: da } : {})}
      />
    </svg>
  )
}

export function LayoutShapeFrameComp({
  frame, isSelected, onSelect, onUpdate, onDelete, onContextMenu, scale
}: Props) {
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, fw: 0, fh: 0 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)

  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (frame.locked) return
    e.preventDefault(); e.stopPropagation(); onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
  }, [frame.x, frame.y, frame.locked, onSelect])

  const onMouseDownResize = useCallback((e: React.MouseEvent) => {
    if (frame.locked) return
    e.preventDefault(); e.stopPropagation(); setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, fw: frame.width, fh: frame.height }
  }, [frame.width, frame.height, frame.locked])

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
          width: Math.max(20, resizeStart.current.fw + dx),
          height: Math.max(frame.shapeType === 'line' ? 2 : 20, resizeStart.current.fh + dy),
        })
      }
    }
    const up = () => { setDragging(false); setResizing(false) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, resizing, scale, frame.shapeType, onUpdate])

  const selColor = '#e3703f'
  const shapeLabel = frame.shapeType === 'rect' ? '▭' : frame.shapeType === 'ellipse' ? '◯' : '╱'

  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x, top: frame.y,
        width: frame.width, height: Math.max(frame.height, frame.strokeWidth + 2),
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: isSelected ? 20 : (frame.zIndex || 10),
        opacity: frame.opacity,
        outline: isSelected ? `1.5px solid ${selColor}` : '1px solid transparent',
        boxSizing: 'border-box',
      }}
      onClick={e => { e.stopPropagation(); onSelect(e.shiftKey || e.metaKey) }}
      onMouseDown={onMouseDownDrag}
      onContextMenu={e => { e.stopPropagation(); onContextMenu?.(e) }}
    >
      <ShapeSVG frame={frame} />

      {/* Selection controls */}
      {isSelected && (
        <>
          {/* Top bar */}
          <div style={{
            position: 'absolute', top: -20, left: 0, right: 0, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(227,112,63,0.9)', borderRadius: '3px 3px 0 0', padding: '0 4px',
          }}>
            <span style={{ fontSize: 9, color: '#fff', fontFamily: 'sans-serif', userSelect: 'none' }}>
              {shapeLabel} {Math.round(frame.width)}×{Math.round(frame.height)}
            </span>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDelete() }}
              style={{ fontSize: 9, color: '#fff', background: '#ef4444', border: 'none', borderRadius: 2, padding: '1px 4px', cursor: 'pointer' }}>
              ✕
            </button>
          </div>

          {/* SE resize handle */}
          <div
            onMouseDown={onMouseDownResize}
            style={{
              position: 'absolute', bottom: -5, right: -5,
              width: 10, height: 10, background: selColor,
              cursor: 'se-resize', borderRadius: 2,
            }}
          />

          {/* Corner handles (visual only) */}
          {[[-4,-4],[frame.width-6,-4],[-4,frame.height-6]].map(([l,t], i) => (
            <div key={i} style={{
              position: 'absolute', left: l, top: t,
              width: 8, height: 8, background: '#fff',
              border: `1.5px solid ${selColor}`, borderRadius: 1, pointerEvents: 'none',
            }} />
          ))}
        </>
      )}
    </div>
  )
}
