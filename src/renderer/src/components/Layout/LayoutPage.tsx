import React, { useRef, useState } from 'react'
import type { LayoutFrame, LayoutImageFrame, LayoutShapeFrame, LayoutChartFrame, LayoutTableFrame, AnyLayoutFrame } from '../../lib/threadEngine'
import { isImageFrame, isShapeFrame, isChartFrame, isTableFrame } from '../../lib/threadEngine'
import { LayoutTextFrameComp } from './LayoutTextFrame'
import { LayoutImageFrameComp } from './LayoutImageFrame'
import { LayoutShapeFrameComp } from './LayoutShapeFrame'
import { LayoutChartFrameComp } from './LayoutChartFrame'
import { LayoutTableFrameComp } from './LayoutTableFrame'
import type { Guide } from '../../store/useStore'

export interface PageSize {
  name: string
  widthMM: number
  heightMM: number
}

export const PAGE_SIZES: Record<string, PageSize> = {
  A4:     { name: 'A4',     widthMM: 210, heightMM: 297 },
  Letter: { name: 'Letter', widthMM: 216, heightMM: 279 },
  A5:     { name: 'A5',     widthMM: 148, heightMM: 210 },
  Legal:  { name: 'Legal',  widthMM: 216, heightMM: 356 },
}

export function mmToPx(mm: number): number {
  return (mm / 25.4) * 96
}

export type DrawMode = 'pointer' | 'draw-text' | 'draw-image' | 'draw-rect' | 'draw-ellipse' | 'draw-line' | 'draw-chart' | 'draw-table'

interface DrawRect { x: number; y: number; w: number; h: number }

interface Props {
  pageIndex: number
  pageSize: PageSize
  frames: AnyLayoutFrame[]
  contentMap: Map<string, string>
  selectedFrameIds: string[]
  showBaselineGrid: boolean
  baselineGridStep: number
  linkingFrom: string | null
  drawMode: DrawMode
  guides: Guide[]
  snapLines?: Array<{axis: 'h'|'v'; position: number}>
  onSelectFrame: (id: string | null, addToSelection?: boolean) => void
  onSelectFramesByRect?: (ids: string[]) => void
  onUpdateFrame: (id: string, updates: Partial<AnyLayoutFrame>) => void
  onDeleteFrame: (id: string) => void
  onAddTextFrame: (pageIndex: number, x: number, y: number, w?: number, h?: number) => void
  onAddImageFrame: (pageIndex: number, x: number, y: number, w?: number, h?: number) => void
  onAddShapeFrame: (pageIndex: number, x: number, y: number, shapeType: 'rect' | 'ellipse' | 'line', w?: number, h?: number) => void
  onAddChartFrame: (pageIndex: number, x: number, y: number, w?: number, h?: number) => void
  onAddTableFrame: (pageIndex: number, x: number, y: number, w?: number, h?: number) => void
  onStartLink: (id: string) => void
  onCompleteLink: (targetId: string) => void
  onLinkToNewFrame?: (pageIndex: number, x: number, y: number, w: number, h: number) => void
  onDoubleClickGuide?: (guideId: string) => void
  onContextMenu?: (e: React.MouseEvent, frameId: string | null) => void
  onAIAction?: (action: string, text: string) => void
  scale: number
  autoEditFrameId?: string | null
  onAutoEditDone?: () => void
}

export function LayoutPage({
  pageIndex, pageSize, frames, contentMap,
  selectedFrameIds, showBaselineGrid, baselineGridStep,
  linkingFrom, drawMode, guides, snapLines = [],
  onSelectFrame, onSelectFramesByRect, onUpdateFrame, onDeleteFrame,
  onAddTextFrame, onAddImageFrame, onAddShapeFrame, onAddChartFrame, onAddTableFrame, onStartLink, onCompleteLink,
  onLinkToNewFrame, onDoubleClickGuide, onContextMenu, onAIAction, scale,
  autoEditFrameId, onAutoEditDone,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null)
  const widthPx = mmToPx(pageSize.widthMM)
  const heightPx = mmToPx(pageSize.heightMM)
  const pageFrames = frames.filter(f => f.pageIndex === pageIndex)

  // Draw mode rubber-band state
  const drawStart = useRef<{ x: number; y: number } | null>(null)
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null)

  // Rubber-band multi-selection state
  const selectStart = useRef<{ x: number; y: number } | null>(null)
  const [selectRect, setSelectRect] = useState<DrawRect | null>(null)

  const getPageXY = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = pageRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) !== pageRef.current) return
    const { x, y } = getPageXY(e)

    if (drawMode === 'draw-text' || drawMode === 'draw-image' || drawMode === 'draw-rect' || drawMode === 'draw-ellipse' || drawMode === 'draw-line' || drawMode === 'draw-chart' || drawMode === 'draw-table') {
      e.preventDefault()
      drawStart.current = { x, y }
      setDrawRect({ x, y, w: 0, h: 0 })
    } else if (linkingFrom) {
      // In link mode: drag on empty page to create a new linked frame
      e.preventDefault()
      drawStart.current = { x, y }
      setDrawRect({ x, y, w: 0, h: 0 })
    } else if (drawMode === 'pointer') {
      // Start rubber-band selection
      e.preventDefault()
      selectStart.current = { x, y }
      setSelectRect({ x, y, w: 0, h: 0 })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (drawStart.current) {
      const { x, y } = getPageXY(e)
      setDrawRect({ x: Math.min(x, drawStart.current.x), y: Math.min(y, drawStart.current.y), w: Math.abs(x - drawStart.current.x), h: Math.abs(y - drawStart.current.y) })
    }
    if (selectStart.current) {
      const { x, y } = getPageXY(e)
      setSelectRect({ x: Math.min(x, selectStart.current.x), y: Math.min(y, selectStart.current.y), w: Math.abs(x - selectStart.current.x), h: Math.abs(y - selectStart.current.y) })
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (drawStart.current && drawRect) {
      const w = Math.max(60, drawRect.w); const h = Math.max(40, drawRect.h)
      if (linkingFrom) {
        // Link mode: create + link a new text frame if drag was large enough
        if (drawRect.w > 20 && drawRect.h > 20) {
          onLinkToNewFrame?.(pageIndex, drawRect.x, drawRect.y, w, h)
        }
      } else if (w > 10 || (drawMode === 'draw-line' && w > 10)) {
        if (drawMode === 'draw-text') onAddTextFrame(pageIndex, drawRect.x, drawRect.y, w, h)
        else if (drawMode === 'draw-image') onAddImageFrame(pageIndex, drawRect.x, drawRect.y, w, h)
        else if (drawMode === 'draw-rect') onAddShapeFrame(pageIndex, drawRect.x, drawRect.y, 'rect', w, Math.max(20, h))
        else if (drawMode === 'draw-ellipse') onAddShapeFrame(pageIndex, drawRect.x, drawRect.y, 'ellipse', w, Math.max(20, h))
        else if (drawMode === 'draw-line') onAddShapeFrame(pageIndex, drawRect.x, drawRect.y, 'line', w, 2)
        else if (drawMode === 'draw-chart') onAddChartFrame(pageIndex, drawRect.x, drawRect.y, w, Math.max(80, h))
        else if (drawMode === 'draw-table') onAddTableFrame(pageIndex, drawRect.x, drawRect.y, w, Math.max(80, h))
      }
      drawStart.current = null; setDrawRect(null); e.stopPropagation()
    }
    if (selectStart.current && selectRect) {
      if (selectRect.w > 5 || selectRect.h > 5) {
        // Find all frames within the rubber-band rect
        const { x, y, w, h } = selectRect
        const hit = pageFrames.filter(f =>
          f.x < x + w && f.x + f.width > x && f.y < y + h && f.y + f.height > y
        ).map(f => f.id)
        if (onSelectFramesByRect) onSelectFramesByRect(hit)
      }
      selectStart.current = null; setSelectRect(null)
    }
  }

  const handlePageClick = (e: React.MouseEvent) => {
    if (drawMode !== 'pointer') return
    if ((e.target as HTMLElement) === pageRef.current) {
      if (linkingFrom) return
      onSelectFrame(null)
    }
  }

  const handlePageDblClick = (e: React.MouseEvent) => {
    if (drawMode !== 'pointer') return
    if ((e.target as HTMLElement) !== pageRef.current) return
    const { x, y } = getPageXY(e)
    onAddTextFrame(pageIndex, x, y)
  }

  const handlePageContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) === pageRef.current) {
      e.preventDefault()
      onContextMenu?.(e, null)
    }
  }

  const isDrawing = drawMode !== 'pointer'
  const pageCursor = isDrawing ? 'crosshair' : linkingFrom ? 'crosshair' : 'default'

  return (
    <div className="flex flex-col items-center mb-12">
      <div className="mb-2 text-[11px] font-sans text-slate-400 select-none">
        Página {pageIndex + 1} — {pageSize.name}
      </div>
      <div
        ref={pageRef}
        className="relative bg-white shadow-2xl select-none"
        style={{
          width: widthPx, height: heightPx,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: `${(heightPx * (scale - 1))}px`,
          cursor: pageCursor,
        }}
        onClick={handlePageClick}
        onDoubleClick={handlePageDblClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handlePageContextMenu}
      >
        {showBaselineGrid && <BaselineGridOverlay width={widthPx} height={heightPx} step={baselineGridStep} />}
        <MarginGuides width={widthPx} height={heightPx} />

        {/* Guide lines */}
        {guides.map(g => (
          <div
            key={g.id}
            onDoubleClick={() => onDoubleClickGuide?.(g.id)}
            style={{
              position: 'absolute',
              pointerEvents: 'auto',
              cursor: 'pointer',
              zIndex: 5,
              ...(g.axis === 'v'
                ? { left: g.position, top: 0, bottom: 0, width: 0, borderLeft: '1px dashed #4299e1' }
                : { top: g.position, left: 0, right: 0, height: 0, borderTop: '1px dashed #4299e1' }
              ),
            }}
            title="Doble clic para eliminar guía"
          />
        ))}

        {/* Snap indicator lines */}
        {snapLines.map((line, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              zIndex: 25,
              ...(line.axis === 'v'
                ? { left: line.position, top: 0, bottom: 0, width: 0, borderLeft: '1px solid #f97316' }
                : { top: line.position, left: 0, right: 0, height: 0, borderTop: '1px solid #f97316' }
              ),
            }}
          />
        ))}

        {/* Frames */}
        {pageFrames.map(frame => {
          if (isTableFrame(frame)) {
            return (
              <LayoutTableFrameComp
                key={frame.id}
                frame={frame as LayoutTableFrame}
                isSelected={selectedFrameIds.includes(frame.id)}
                scale={scale}
                onSelect={(e) => onSelectFrame(frame.id, e.shiftKey || e.metaKey)}
                onUpdate={(updates) => onUpdateFrame(frame.id, updates)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, frame.id) }}
              />
            )
          }
          if (isChartFrame(frame)) {
            return (
              <LayoutChartFrameComp
                key={frame.id}
                frame={frame as LayoutChartFrame}
                isSelected={selectedFrameIds.includes(frame.id)}
                onSelect={() => onSelectFrame(frame.id)}
                onUpdate={(updates) => onUpdateFrame(frame.id, updates)}
                onDelete={() => onDeleteFrame(frame.id)}
                scale={scale}
              />
            )
          }
          if (isShapeFrame(frame)) {
            return (
              <LayoutShapeFrameComp
                key={frame.id}
                frame={frame as LayoutShapeFrame}
                isSelected={selectedFrameIds.includes(frame.id)}
                onSelect={(add) => onSelectFrame(frame.id, add)}
                onUpdate={(updates) => onUpdateFrame(frame.id, updates)}
                onDelete={() => onDeleteFrame(frame.id)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, frame.id) }}
                scale={scale}
              />
            )
          }
          if (isImageFrame(frame)) {
            return (
              <LayoutImageFrameComp
                key={frame.id}
                frame={frame}
                isSelected={selectedFrameIds.includes(frame.id)}
                onSelect={(add) => {
                  if (linkingFrom && linkingFrom !== frame.id) { onCompleteLink(frame.id); return }
                  onSelectFrame(frame.id, add)
                }}
                onUpdate={(updates) => onUpdateFrame(frame.id, updates)}
                onDelete={() => onDeleteFrame(frame.id)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, frame.id) }}
                scale={scale}
              />
            )
          }
          const tf = frame as LayoutFrame
          return (
            <LayoutTextFrameComp
              key={frame.id}
              frame={tf}
              threadedContent={contentMap.get(frame.id) || ''}
              isSelected={selectedFrameIds.includes(frame.id)}
              isLinkingFrom={linkingFrom === frame.id}
              isLinkTarget={linkingFrom !== null && linkingFrom !== frame.id}
              onSelect={(add) => {
                if (linkingFrom && linkingFrom !== frame.id) { onCompleteLink(frame.id); return }
                onSelectFrame(frame.id, add)
              }}
              onUpdate={(updates) => onUpdateFrame(frame.id, updates)}
              onDelete={() => onDeleteFrame(frame.id)}
              onStartLink={() => onStartLink(frame.id)}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, frame.id) }}
              onAIAction={onAIAction}
              scale={scale}
              autoEdit={autoEditFrameId === frame.id}
              onAutoEditDone={onAutoEditDone}
            />
          )
        })}

        {/* Draw preview */}
        {drawRect && drawRect.w > 4 && drawRect.h > 4 && (
          <div style={{
            position: 'absolute', left: drawRect.x, top: drawRect.y, width: drawRect.w, height: drawRect.h,
            border: `1.5px dashed ${drawMode === 'draw-image' ? '#a855f7' : '#2563eb'}`,
            background: drawMode === 'draw-image' ? 'rgba(168,85,247,0.06)' : 'rgba(37,99,235,0.06)',
            pointerEvents: 'none', boxSizing: 'border-box',
          }}>
            <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 9, fontFamily: 'sans-serif', color: drawMode === 'draw-image' ? '#a855f7' : '#2563eb', userSelect: 'none' }}>
              {Math.round(drawRect.w)} × {Math.round(drawRect.h)}
            </span>
          </div>
        )}

        {/* Rubber-band selection rect */}
        {selectRect && (selectRect.w > 4 || selectRect.h > 4) && (
          <div style={{
            position: 'absolute', left: selectRect.x, top: selectRect.y, width: selectRect.w, height: selectRect.h,
            border: '1px dashed #6366f1', background: 'rgba(99,102,241,0.05)',
            pointerEvents: 'none', boxSizing: 'border-box',
          }} />
        )}

        {pageFrames.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-200 text-sm font-sans select-none">
              {linkingFrom ? 'Arrastra para crear marco vinculado' : drawMode === 'pointer' ? 'Doble clic para agregar marco' : 'Arrastra para crear marco'}
            </p>
          </div>
        )}

        {/* Thread connection lines — shown when a linked frame is selected */}
        <ThreadLines
          frames={pageFrames as LayoutFrame[]}
          allFrames={frames as LayoutFrame[]}
          selectedFrameIds={selectedFrameIds}
          pageIndex={pageIndex}
        />
      </div>
    </div>
  )
}

// ─── Thread connection lines SVG overlay ──────────────────────────────────────
function ThreadLines({
  frames, allFrames, selectedFrameIds, pageIndex,
}: {
  frames: LayoutFrame[]
  allFrames: LayoutFrame[]
  selectedFrameIds: string[]
  pageIndex: number
}) {
  // Only show connections when a frame in a chain is selected.
  // Guard against circular refs with visited set to prevent infinite loops.
  const chainIds = new Set<string>()
  selectedFrameIds.forEach(id => {
    const visited = new Set<string>()
    let cur = allFrames.find(f => f.id === id) as LayoutFrame | undefined
    // Walk forward
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id); chainIds.add(cur.id)
      cur = cur.threadNextId ? allFrames.find(f => f.id === cur!.threadNextId) as LayoutFrame | undefined : undefined
    }
    visited.clear()
    cur = allFrames.find(f => f.id === id) as LayoutFrame | undefined
    // Walk backward
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id); chainIds.add(cur.id)
      cur = cur.threadPrevId ? allFrames.find(f => f.id === cur!.threadPrevId) as LayoutFrame | undefined : undefined
    }
  })
  if (chainIds.size === 0) return null

  const lines: React.ReactNode[] = []
  frames.forEach(src => {
    if (!src.threadNextId || !chainIds.has(src.id)) return
    const dst = allFrames.find(f => f.id === src.threadNextId)
    if (!dst) return
    // Source exit: bottom-right corner
    const x1 = src.x + src.width
    const y1 = src.y + src.height
    if (dst.pageIndex === pageIndex) {
      // Same page — draw bezier curve with arrowhead
      const x2 = dst.x
      const y2 = dst.y
      const cpx = x1 + Math.max(40, Math.abs(x2 - x1) * 0.5)
      const cpy = y1 + Math.max(20, Math.abs(y2 - y1) * 0.3)
      lines.push(
        <path key={src.id}
          d={`M ${x1} ${y1} C ${cpx} ${cpy}, ${x2} ${y2 - 20}, ${x2} ${y2}`}
          stroke="#6366f1" strokeWidth={1.5} fill="none" strokeDasharray="6 3"
          markerEnd="url(#thread-arrow)"
          opacity={0.8}
        />
      )
    } else {
      // Different page — draw a short exit stub + page badge
      lines.push(
        <g key={src.id}>
          <line x1={x1} y1={y1} x2={x1 + 20} y2={y1 + 20} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.8} />
          <rect x={x1 + 16} y={y1 + 14} width={40} height={14} rx={3} fill="#6366f1" opacity={0.85} />
          <text x={x1 + 36} y={y1 + 24} textAnchor="middle" fontSize={9} fill="white" fontFamily="system-ui">
            {`→ P.${dst.pageIndex + 1}`}
          </text>
        </g>
      )
    }
  })

  if (lines.length === 0) return null

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 90, overflow: 'visible' }}
      width="100%" height="100%"
    >
      <defs>
        <marker id="thread-arrow" markerWidth="7" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#6366f1" />
        </marker>
      </defs>
      {lines}
    </svg>
  )
}

function BaselineGridOverlay({ width, height, step }: { width: number; height: number; step: number }) {
  const lines: React.ReactNode[] = []
  for (let y = step; y < height; y += step) lines.push(<line key={y} x1={0} y1={y} x2={width} y2={y} />)
  return (
    <svg className="absolute inset-0 pointer-events-none" width={width} height={height} style={{ zIndex: 1 }}>
      <g stroke="rgba(99,102,241,0.15)" strokeWidth="0.5">{lines}</g>
    </svg>
  )
}

function MarginGuides({ width, height }: { width: number; height: number }) {
  const m = 57
  return (
    <svg className="absolute inset-0 pointer-events-none" width={width} height={height} style={{ zIndex: 1 }}>
      <rect x={m} y={m} width={width - m * 2} height={height - m * 2} fill="none" stroke="rgba(220,38,38,0.12)" strokeWidth="0.75" strokeDasharray="4,3" />
    </svg>
  )
}
