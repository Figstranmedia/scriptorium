/**
 * Rulers — horizontal and vertical rulers with mm scale and crosshair tracking.
 * Dragging from a ruler creates a guide.
 */
import React, { useRef, useCallback } from 'react'
import type { Guide } from '../../store/useStore'

const RULER_SIZE = 20  // px thick
const BG = '#2d3748'
const TICK_COLOR = '#718096'
const TEXT_COLOR = '#a0aec0'

interface Props {
  scale: number
  scrollLeft: number
  scrollTop: number
  pageOffsetLeft: number   // px from canvas left edge to page left edge (before scale)
  pageOffsetTop: number
  guides: Guide[]
  onAddGuide: (guide: Omit<Guide, 'id'>) => void
  mousePageX: number   // cursor position in page coords (px), -1 if outside
  mousePageY: number
}

function mmToPx(mm: number) { return (mm / 25.4) * 96 }
function pxToMm(px: number) { return (px * 25.4) / 96 }

export function HorizontalRuler({ scale, scrollLeft, pageOffsetLeft, guides, onAddGuide, mousePageX }: Omit<Props, 'scrollTop' | 'pageOffsetTop' | 'mousePageY'> & { mousePageY?: never }) {
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const screenX = e.clientX - rect.left
    // Convert screen x to page x
    const pageX = (screenX + scrollLeft - pageOffsetLeft * scale) / scale
    onAddGuide({ axis: 'v', position: Math.round(pageX) })
    e.preventDefault()
  }, [scale, scrollLeft, pageOffsetLeft, onAddGuide])

  // Draw ticks at every 5mm, labels at every 10mm
  const tickInterval = mmToPx(5) * scale
  const labelInterval = mmToPx(10) * scale
  const offset = (pageOffsetLeft * scale - scrollLeft)

  const ticks: React.ReactNode[] = []
  const visibleWidth = 2000  // render enough ticks
  const startMM = Math.floor(-offset / (mmToPx(1) * scale))
  const endMM = startMM + Math.ceil(visibleWidth / (mmToPx(1) * scale)) + 10

  for (let mm = startMM; mm <= endMM; mm += 5) {
    const x = mm * mmToPx(1) * scale + offset
    if (x < 0 || x > visibleWidth) continue
    const isLabel = mm % 10 === 0
    ticks.push(
      <line key={mm} x1={x} y1={isLabel ? 4 : 10} x2={x} y2={RULER_SIZE} stroke={TICK_COLOR} strokeWidth={isLabel ? 0.75 : 0.5} />,
    )
    if (isLabel && mm !== 0) {
      ticks.push(
        <text key={`t${mm}`} x={x + 1} y={10} fontSize={7} fill={TEXT_COLOR} fontFamily="sans-serif">{mm}</text>
      )
    }
  }

  // Guide marks on ruler
  const guideMarks = guides.filter(g => g.axis === 'v').map(g => {
    const gx = g.position * scale + offset
    return <line key={g.id} x1={gx} y1={0} x2={gx} y2={RULER_SIZE} stroke="#4299e1" strokeWidth={1} />
  })

  // Cursor crosshair
  const cursorLine = mousePageX >= 0
    ? <line x1={mousePageX * scale + offset} y1={0} x2={mousePageX * scale + offset} y2={RULER_SIZE} stroke="#f6ad55" strokeWidth={0.75} />
    : null

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: RULER_SIZE, right: 0, height: RULER_SIZE,
        background: BG, cursor: 'crosshair', zIndex: 50, userSelect: 'none', overflow: 'hidden',
      }}
      onMouseDown={onMouseDown}
    >
      <svg width="100%" height={RULER_SIZE} style={{ overflow: 'visible' }}>
        {ticks}
        {guideMarks}
        {cursorLine}
      </svg>
    </div>
  )
}

export function VerticalRuler({ scale, scrollTop, pageOffsetTop, guides, onAddGuide, mousePageY }: Omit<Props, 'scrollLeft' | 'pageOffsetLeft' | 'mousePageX'> & { mousePageX?: never }) {
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const screenY = e.clientY - rect.top
    const pageY = (screenY + scrollTop - pageOffsetTop * scale) / scale
    onAddGuide({ axis: 'h', position: Math.round(pageY) })
    e.preventDefault()
  }, [scale, scrollTop, pageOffsetTop, onAddGuide])

  const offset = (pageOffsetTop * scale - scrollTop)
  const ticks: React.ReactNode[] = []
  const startMM = Math.floor(-offset / (mmToPx(1) * scale))
  const endMM = startMM + Math.ceil(3000 / (mmToPx(1) * scale)) + 10

  for (let mm = startMM; mm <= endMM; mm += 5) {
    const y = mm * mmToPx(1) * scale + offset
    if (y < 0 || y > 3000) continue
    const isLabel = mm % 20 === 0
    ticks.push(
      <line key={mm} x1={isLabel ? 4 : 10} y1={y} x2={RULER_SIZE} y2={y} stroke={TICK_COLOR} strokeWidth={isLabel ? 0.75 : 0.5} />
    )
    if (isLabel && mm > 0) {
      ticks.push(
        <g key={`t${mm}`} transform={`translate(${RULER_SIZE - 12}, ${y + 1}) rotate(90)`}>
          <text fontSize={7} fill={TEXT_COLOR} fontFamily="sans-serif" textAnchor="start">{mm}</text>
        </g>
      )
    }
  }

  const guideMarks = guides.filter(g => g.axis === 'h').map(g => {
    const gy = g.position * scale + offset
    return <line key={g.id} x1={0} y1={gy} x2={RULER_SIZE} y2={gy} stroke="#4299e1" strokeWidth={1} />
  })

  const cursorLine = mousePageY !== undefined && mousePageY >= 0
    ? <line x1={0} y1={mousePageY * scale + offset} x2={RULER_SIZE} y2={mousePageY * scale + offset} stroke="#f6ad55" strokeWidth={0.75} />
    : null

  return (
    <div
      style={{
        position: 'absolute', top: RULER_SIZE, left: 0, bottom: 0, width: RULER_SIZE,
        background: BG, cursor: 'crosshair', zIndex: 50, userSelect: 'none', overflow: 'hidden',
      }}
      onMouseDown={onMouseDown}
    >
      <svg width={RULER_SIZE} height="100%" style={{ overflow: 'visible' }}>
        {ticks}
        {guideMarks}
        {cursorLine}
      </svg>
    </div>
  )
}

export function RulerCorner() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: RULER_SIZE, height: RULER_SIZE,
      background: '#1a202c', zIndex: 51,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={10} height={10}>
        <line x1={0} y1={5} x2={10} y2={5} stroke={TICK_COLOR} strokeWidth={0.5} />
        <line x1={5} y1={0} x2={5} y2={10} stroke={TICK_COLOR} strokeWidth={0.5} />
      </svg>
    </div>
  )
}

export const RULER_SIZE_PX = RULER_SIZE
