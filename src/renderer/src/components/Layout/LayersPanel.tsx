import React from 'react'
import type { AnyLayoutFrame, LayoutFrame } from '../../lib/threadEngine'
import { isImageFrame } from '../../lib/threadEngine'

interface Props {
  frames: AnyLayoutFrame[]
  selectedFrameIds: string[]
  pageCount: number
  onSelectFrame: (id: string) => void
  onUpdateFrame: (id: string, updates: Partial<AnyLayoutFrame>) => void
  onDeleteFrame: (id: string) => void
}

export function LayersPanel({ frames, selectedFrameIds, pageCount, onSelectFrame, onUpdateFrame, onDeleteFrame }: Props) {
  // Group by page
  const byPage: AnyLayoutFrame[][] = Array.from({ length: pageCount }, (_, i) =>
    frames.filter(f => f.pageIndex === i)
  )

  return (
    <div className="flex flex-col overflow-y-auto text-[11px] font-sans">
      {byPage.map((pageFrames, pageIdx) => (
        <div key={pageIdx}>
          <div className="px-3 py-1.5 bg-slate-700 text-slate-300 font-semibold text-[10px] uppercase tracking-wider sticky top-0 z-10">
            Página {pageIdx + 1}
          </div>
          {pageFrames.length === 0 ? (
            <div className="px-3 py-2 text-slate-500 text-[10px]">Sin marcos</div>
          ) : (
            [...pageFrames].reverse().map(frame => {
              const isImg = isImageFrame(frame)
              const tf = frame as LayoutFrame
              const isSelected = selectedFrameIds.includes(frame.id)
              const isLocked = !isImg && tf.locked
              const label = isImg
                ? `🖼 Imagen`
                : (tf.ownContent
                  ? `T "${tf.ownContent.slice(0, 18).replace(/\n/g, ' ')}${tf.ownContent.length > 18 ? '…' : ''}"`
                  : `T Marco texto`)

              return (
                <div
                  key={frame.id}
                  onClick={() => onSelectFrame(frame.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-700 cursor-pointer transition ${
                    isSelected
                      ? 'bg-orange-500/20 border-l-2 border-l-orange-400'
                      : 'hover:bg-slate-700/50'
                  }`}
                >
                  <span className={`text-[10px] ${isImg ? 'text-purple-400' : 'text-blue-400'}`}>
                    {isImg ? '▣' : '▤'}
                  </span>
                  <span className={`flex-1 truncate text-[10px] ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {label}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {Math.round(frame.x)},{Math.round(frame.y)}
                  </span>
                  {/* Lock toggle */}
                  {!isImg && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onUpdateFrame(frame.id, { locked: !tf.locked } as Partial<AnyLayoutFrame>)
                      }}
                      className={`text-[10px] opacity-60 hover:opacity-100 transition ${tf.locked ? 'text-yellow-400' : 'text-slate-500'}`}
                      title={tf.locked ? 'Desbloquear' : 'Bloquear'}
                    >
                      {tf.locked ? '🔒' : '🔓'}
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteFrame(frame.id) }}
                    className="text-[10px] text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                    title="Eliminar marco"
                  >✕</button>
                </div>
              )
            })
          )}
        </div>
      ))}
    </div>
  )
}
