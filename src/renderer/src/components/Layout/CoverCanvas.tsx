import React, { useState, useCallback, useRef } from 'react'
import type { AnyLayoutFrame, LayoutFrame, LayoutImageFrame } from '../../lib/threadEngine'
import { createDefaultFrame, createDefaultImageFrame, isImageFrame } from '../../lib/threadEngine'
import { mmToPx, type DrawMode } from './LayoutPage'
import { LayoutTextFrameComp } from './LayoutTextFrame'
import { LayoutImageFrameComp } from './LayoutImageFrame'
import { LayoutPropertiesPanel } from './LayoutPropertiesPanel'
import type { Document, CoverConfig } from '../../store/useStore'

interface Props {
  document: Document
  onSave: (id: string, data: object) => void
  onAIAction?: (action: string, text: string) => void
}

export function CoverCanvas({ document, onSave, onAIAction }: Props) {
  const cfg = document.coverConfig as CoverConfig
  const [frames, setFrames] = useState<AnyLayoutFrame[]>(document.layoutFrames || [])
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([])
  const [drawMode, setDrawMode] = useState<DrawMode>('pointer')
  const [scale, setScale] = useState(0.55)
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Spread dimensions in px
  const bleedPx   = mmToPx(cfg.bleedMM)
  const coverWPx  = mmToPx(cfg.coverWidthMM)
  const coverHPx  = mmToPx(cfg.coverHeightMM)
  const spinePx   = mmToPx(cfg.spineMM)
  const spreadWPx = bleedPx + coverWPx + spinePx + coverWPx + bleedPx
  const spreadHPx = bleedPx + coverHPx + bleedPx

  // Zone start positions
  const bleedL   = 0
  const backX    = bleedPx
  const spineX   = bleedPx + coverWPx
  const frontX   = bleedPx + coverWPx + spinePx
  const bleedR   = frontX + coverWPx
  const safeInset = mmToPx(5) // 5mm safe area inside cover

  const saveLayout = useCallback((newFrames: AnyLayoutFrame[]) => {
    const data = { ...document, layoutFrames: newFrames }
    onSave(document.id, data)
  }, [document, onSave])

  const selectedFrame = selectedFrameIds.length === 1
    ? frames.find(f => f.id === selectedFrameIds[0]) || null
    : null

  // Frame updates
  const handleFrameUpdate = useCallback((id: string, updates: Partial<AnyLayoutFrame>) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, ...updates } as AnyLayoutFrame : f)
      saveLayout(next)
      return next
    })
  }, [saveLayout])

  const handleFrameDelete = useCallback((id: string) => {
    setFrames(prev => {
      const next = prev.filter(f => f.id !== id)
      saveLayout(next)
      return next
    })
    setSelectedFrameIds(ids => ids.filter(i => i !== id))
  }, [saveLayout])

  // Draw a new frame on mousedown+drag
  const drawStart = useRef<{ x: number; y: number } | null>(null)

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (drawMode === 'pointer') return
    if ((e.target as HTMLElement).closest('[data-frame]')) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    drawStart.current = { x, y }
  }, [drawMode, scale])

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drawStart.current) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const x2 = (e.clientX - rect.left) / scale
    const y2 = (e.clientY - rect.top) / scale
    const x = Math.min(drawStart.current.x, x2)
    const y = Math.min(drawStart.current.y, y2)
    const w = Math.abs(x2 - drawStart.current.x)
    const h = Math.abs(y2 - drawStart.current.y)
    drawStart.current = null

    if (w < 10 || h < 10) return

    let newFrame: AnyLayoutFrame
    if (drawMode === 'draw-text') {
      newFrame = createDefaultFrame({ x, y, width: w, height: h, pageIndex: 0 })
    } else {
      newFrame = createDefaultImageFrame({ x, y, width: w, height: h, pageIndex: 0 })
    }

    setFrames(prev => {
      const next = [...prev, newFrame]
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([newFrame.id])
    setDrawMode('pointer')
  }, [drawMode, scale, saveLayout])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-frame]')) return
    setSelectedFrameIds([])
    setEditingFrameId(null)
  }, [])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setDrawMode('pointer'); setSelectedFrameIds([]); setEditingFrameId(null) }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFrameIds.length && !editingFrameId) {
      selectedFrameIds.forEach(id => handleFrameDelete(id))
    }
    if (e.key === 't' || e.key === 'T') setDrawMode('draw-text')
    if (e.key === 'i' || e.key === 'I') setDrawMode('draw-image')
  }, [selectedFrameIds, editingFrameId, handleFrameDelete])

  return (
    <div className="flex flex-1 overflow-hidden bg-ink-100 outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      <div className="flex flex-col gap-1 p-2 bg-ink-800 border-r border-ink-700">
        <button
          title="Puntero (Esc)"
          onClick={() => setDrawMode('pointer')}
          className={`w-8 h-8 rounded flex items-center justify-center text-sm transition ${drawMode === 'pointer' ? 'bg-accent-500 text-white' : 'text-ink-300 hover:bg-ink-700'}`}
        >↖</button>
        <button
          title="Texto (T)"
          onClick={() => setDrawMode('draw-text')}
          className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition ${drawMode === 'draw-text' ? 'bg-accent-500 text-white' : 'text-ink-300 hover:bg-ink-700'}`}
        >T</button>
        <button
          title="Imagen (I)"
          onClick={() => setDrawMode('draw-image')}
          className={`w-8 h-8 rounded flex items-center justify-center text-sm transition ${drawMode === 'draw-image' ? 'bg-accent-500 text-white' : 'text-ink-300 hover:bg-ink-700'}`}
        >🖼</button>
        <hr className="border-ink-600 my-1" />
        <button title="Zoom +" onClick={() => setScale(s => Math.min(2, +(s + 0.1).toFixed(1)))} className="w-8 h-8 rounded flex items-center justify-center text-xs text-ink-300 hover:bg-ink-700">+</button>
        <button title="Zoom −" onClick={() => setScale(s => Math.max(0.2, +(s - 0.1).toFixed(1)))} className="w-8 h-8 rounded flex items-center justify-center text-xs text-ink-300 hover:bg-ink-700">−</button>
        <span className="text-ink-500 text-xs text-center">{Math.round(scale * 100)}%</span>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto">
        <div className="min-h-full flex items-start justify-center p-8">
          <div
            ref={canvasRef}
            style={{
              width: spreadWPx * scale,
              height: spreadHPx * scale,
              position: 'relative',
              cursor: drawMode !== 'pointer' ? 'crosshair' : 'default',
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
          >
            {/* Spread background */}
            <div style={{
              position: 'absolute', inset: 0,
              width: spreadWPx * scale, height: spreadHPx * scale,
              background: 'white',
              boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
            }} />

            {/* Zone overlays */}
            <ZoneOverlay scale={scale}
              bleedL={bleedL} bleedR={bleedR} bleedPx={bleedPx}
              backX={backX} spineX={spineX} frontX={frontX}
              spinePx={spinePx} coverWPx={coverWPx} coverHPx={coverHPx}
              spreadHPx={spreadHPx} safeInset={safeInset} spineMM={cfg.spineMM}
            />

            {/* Frames */}
            {frames.map(frame => {
              if (isImageFrame(frame)) {
                return (
                  <div key={frame.id} data-frame style={{ position: 'absolute', left: frame.x * scale, top: frame.y * scale }}>
                    <LayoutImageFrameComp
                      frame={frame}
                      scale={scale}
                      selected={selectedFrameIds.includes(frame.id)}
                      onSelect={() => setSelectedFrameIds([frame.id])}
                      onUpdate={(u) => handleFrameUpdate(frame.id, u)}
                      onDelete={() => handleFrameDelete(frame.id)}
                    />
                  </div>
                )
              }
              const tf = frame as LayoutFrame
              return (
                <div key={tf.id} data-frame style={{ position: 'absolute', left: tf.x * scale, top: tf.y * scale }}>
                  <LayoutTextFrameComp
                    frame={tf}
                    scale={scale}
                    selected={selectedFrameIds.includes(tf.id)}
                    isEditing={editingFrameId === tf.id}
                    onSelect={() => setSelectedFrameIds([tf.id])}
                    onDoubleClick={() => setEditingFrameId(tf.id)}
                    onBlur={() => setEditingFrameId(null)}
                    onUpdate={(u) => handleFrameUpdate(tf.id, u)}
                    onDelete={() => handleFrameDelete(tf.id)}
                    onAIAction={onAIAction}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-64 bg-white border-l border-ink-200 overflow-y-auto flex flex-col">
        {/* Cover info */}
        <div className="p-3 border-b border-ink-100 bg-ink-50">
          <p className="text-xs font-sans font-semibold text-ink-700 mb-1">Portada — {document.title}</p>
          <p className="text-xs text-ink-500">
            {cfg.coverWidthMM} × {cfg.coverHeightMM} mm · {cfg.pageCount} págs · lomo {cfg.spineMM} mm
          </p>
          <div className="flex gap-1 mt-2">
            <div className="flex items-center gap-1 text-xs text-ink-500">
              <div className="w-3 h-3 rounded" style={{ background: '#fecaca' }} /> Sangría
            </div>
            <div className="flex items-center gap-1 text-xs text-ink-500 ml-2">
              <div className="w-3 h-3 rounded" style={{ background: '#c7d2fe' }} /> Lomo
            </div>
          </div>
        </div>

        {selectedFrame ? (
          <LayoutPropertiesPanel
            frame={selectedFrame}
            onUpdate={(u) => handleFrameUpdate(selectedFrame.id, u)}
            onDelete={() => handleFrameDelete(selectedFrame.id)}
          />
        ) : (
          <div className="p-4 text-xs text-ink-400 font-sans">
            Selecciona un cuadro para editar sus propiedades.<br /><br />
            <strong className="text-ink-600">T</strong> — dibujar texto<br />
            <strong className="text-ink-600">I</strong> — dibujar imagen<br />
            <strong className="text-ink-600">Esc</strong> — puntero
          </div>
        )}
      </div>
    </div>
  )
}

interface ZoneProps {
  scale: number
  bleedL: number; bleedR: number; bleedPx: number
  backX: number; spineX: number; frontX: number
  spinePx: number; coverWPx: number; coverHPx: number
  spreadHPx: number; safeInset: number; spineMM: number
}

function ZoneOverlay({ scale, bleedL, bleedR, bleedPx, backX, spineX, frontX, spinePx, coverWPx, coverHPx, spreadHPx, safeInset, spineMM }: ZoneProps) {
  const s = scale
  const label = (text: string, x: number, y: number, color: string, rotate = false) => (
    <div key={text} style={{
      position: 'absolute',
      left: x * s, top: y * s,
      fontSize: 9 * s,
      color,
      pointerEvents: 'none',
      userSelect: 'none',
      transform: rotate ? 'rotate(-90deg)' : undefined,
      transformOrigin: rotate ? 'top left' : undefined,
      whiteSpace: 'nowrap',
      fontFamily: 'sans-serif',
      fontWeight: 600,
    }}>{text}</div>
  )

  return (
    <>
      {/* Bleed zones — semi-transparent red */}
      {/* Left bleed */}
      <div style={{
        position: 'absolute', left: bleedL * s, top: 0,
        width: bleedPx * s, height: spreadHPx * s,
        background: 'rgba(254,202,202,0.35)', pointerEvents: 'none',
        borderRight: '1px dashed rgba(239,68,68,0.5)',
      }} />
      {/* Right bleed */}
      <div style={{
        position: 'absolute', left: bleedR * s, top: 0,
        width: bleedPx * s, height: spreadHPx * s,
        background: 'rgba(254,202,202,0.35)', pointerEvents: 'none',
        borderLeft: '1px dashed rgba(239,68,68,0.5)',
      }} />
      {/* Top bleed */}
      <div style={{
        position: 'absolute', left: backX * s, top: 0,
        width: (coverWPx + spinePx + coverWPx) * s, height: bleedPx * s,
        background: 'rgba(254,202,202,0.35)', pointerEvents: 'none',
        borderBottom: '1px dashed rgba(239,68,68,0.5)',
      }} />
      {/* Bottom bleed */}
      <div style={{
        position: 'absolute', left: backX * s, top: (bleedPx + coverHPx) * s,
        width: (coverWPx + spinePx + coverWPx) * s, height: bleedPx * s,
        background: 'rgba(254,202,202,0.35)', pointerEvents: 'none',
        borderTop: '1px dashed rgba(239,68,68,0.5)',
      }} />

      {/* Spine zone */}
      <div style={{
        position: 'absolute',
        left: spineX * s, top: bleedPx * s,
        width: spinePx * s, height: coverHPx * s,
        background: 'rgba(199,210,254,0.45)',
        border: '1px dashed rgba(129,140,248,0.7)',
        pointerEvents: 'none',
      }} />

      {/* Safe area dashes — back cover */}
      <div style={{
        position: 'absolute',
        left: (backX + safeInset) * s, top: (bleedPx + safeInset) * s,
        width: (coverWPx - safeInset * 2) * s, height: (coverHPx - safeInset * 2) * s,
        border: '1px dashed rgba(100,116,139,0.35)',
        pointerEvents: 'none',
      }} />
      {/* Safe area dashes — front cover */}
      <div style={{
        position: 'absolute',
        left: (frontX + safeInset) * s, top: (bleedPx + safeInset) * s,
        width: (coverWPx - safeInset * 2) * s, height: (coverHPx - safeInset * 2) * s,
        border: '1px dashed rgba(100,116,139,0.35)',
        pointerEvents: 'none',
      }} />

      {/* Labels */}
      {label('CONTRAPORTADA', (backX + coverWPx / 2 - 30) * s, (bleedPx + 8) * s, 'rgba(100,116,139,0.6)')}
      {label('PORTADA', (frontX + coverWPx / 2 - 18) * s, (bleedPx + 8) * s, 'rgba(22,101,52,0.6)')}
      {spinePx > mmToPx(8) && label(`LOMO ${spineMM}mm`, (spineX + spinePx / 2) * s, (bleedPx + coverHPx / 2) * s, 'rgba(67,56,202,0.7)', true)}
    </>
  )
}
