import React, { useRef } from 'react'
import type { LayoutFrame, LayoutImageFrame, AnyLayoutFrame } from '../../lib/threadEngine'
import { isImageFrame } from '../../lib/threadEngine'
import { LayoutTextFrameComp } from './LayoutTextFrame'
import { LayoutImageFrameComp } from './LayoutImageFrame'

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

// Convert mm to px at 96dpi
export function mmToPx(mm: number): number {
  return (mm / 25.4) * 96
}

interface Props {
  pageIndex: number
  pageSize: PageSize
  frames: AnyLayoutFrame[]
  contentMap: Map<string, string>
  selectedFrameId: string | null
  showBaselineGrid: boolean
  baselineGridStep: number
  linkingFrom: string | null
  onSelectFrame: (id: string | null) => void
  onUpdateFrame: (id: string, updates: Partial<AnyLayoutFrame>) => void
  onDeleteFrame: (id: string) => void
  onAddFrame: (pageIndex: number, x: number, y: number) => void
  onStartLink: (id: string) => void
  onCompleteLink: (targetId: string) => void
  scale: number
}

export function LayoutPage({
  pageIndex, pageSize, frames, contentMap,
  selectedFrameId, showBaselineGrid, baselineGridStep,
  linkingFrom, onSelectFrame, onUpdateFrame, onDeleteFrame,
  onAddFrame, onStartLink, onCompleteLink, scale,
}: Props) {
  const pageRef = useRef<HTMLDivElement>(null)
  const widthPx = mmToPx(pageSize.widthMM)
  const heightPx = mmToPx(pageSize.heightMM)

  const pageFrames = frames.filter(f => f.pageIndex === pageIndex)

  const handlePageClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) === pageRef.current) {
      if (linkingFrom) return
      onSelectFrame(null)
    }
  }

  const handlePageDblClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) !== pageRef.current) return
    const rect = pageRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    onAddFrame(pageIndex, x, y)
  }

  return (
    <div className="flex flex-col items-center mb-12">
      {/* Page label */}
      <div className="mb-2 text-[11px] font-sans text-slate-400 select-none">
        Página {pageIndex + 1} — {pageSize.name}
      </div>

      {/* Page canvas */}
      <div
        ref={pageRef}
        className="relative bg-white shadow-2xl select-none"
        style={{
          width: widthPx,
          height: heightPx,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          marginBottom: `${(heightPx * (scale - 1))}px`,
          cursor: linkingFrom ? 'crosshair' : 'default',
        }}
        onClick={handlePageClick}
        onDoubleClick={handlePageDblClick}
      >
        {/* Baseline grid overlay */}
        {showBaselineGrid && (
          <BaselineGridOverlay width={widthPx} height={heightPx} step={baselineGridStep} />
        )}

        {/* Margin guides */}
        <MarginGuides width={widthPx} height={heightPx} />

        {/* Frames */}
        {pageFrames.map(frame => {
          if (isImageFrame(frame)) {
            return (
              <LayoutImageFrameComp
                key={frame.id}
                frame={frame}
                isSelected={selectedFrameId === frame.id}
                onSelect={() => onSelectFrame(frame.id)}
                onUpdate={(updates) => onUpdateFrame(frame.id, updates)}
                onDelete={() => onDeleteFrame(frame.id)}
                scale={scale}
              />
            )
          }
          return (
            <LayoutTextFrameComp
              key={frame.id}
              frame={frame as LayoutFrame}
              content={contentMap.get(frame.id) || ''}
              isSelected={selectedFrameId === frame.id}
              isLinkingFrom={linkingFrom === frame.id}
              isLinkTarget={linkingFrom !== null && linkingFrom !== frame.id}
              onSelect={() => {
                if (linkingFrom && linkingFrom !== frame.id) {
                  onCompleteLink(frame.id)
                } else {
                  onSelectFrame(frame.id)
                }
              }}
              onUpdate={(updates) => onUpdateFrame(frame.id, updates)}
              onDelete={() => onDeleteFrame(frame.id)}
              onStartLink={() => onStartLink(frame.id)}
              scale={scale}
            />
          )
        })}

        {/* Drop hint when no frames */}
        {pageFrames.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-200 text-sm font-sans select-none">
              Doble clic para agregar marco
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function BaselineGridOverlay({ width, height, step }: { width: number; height: number; step: number }) {
  const lines: React.ReactNode[] = []
  for (let y = step; y < height; y += step) {
    lines.push(
      <line key={y} x1={0} y1={y} x2={width} y2={y} />
    )
  }
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      style={{ zIndex: 1 }}
    >
      <g stroke="rgba(99,102,241,0.15)" strokeWidth="0.5">
        {lines}
      </g>
    </svg>
  )
}

function MarginGuides({ width, height }: { width: number; height: number }) {
  const m = 57 // ~15mm in px
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      style={{ zIndex: 1 }}
    >
      <rect
        x={m} y={m}
        width={width - m * 2} height={height - m * 2}
        fill="none"
        stroke="rgba(220,38,38,0.12)"
        strokeWidth="0.75"
        strokeDasharray="4,3"
      />
    </svg>
  )
}
