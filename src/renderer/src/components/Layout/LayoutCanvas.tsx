import React, { useState, useCallback, useEffect, useMemo } from 'react'
import type { AnyLayoutFrame, LayoutFrame, LayoutImageFrame } from '../../lib/threadEngine'
import {
  createDefaultFrame, createDefaultImageFrame, distributeContent, isImageFrame
} from '../../lib/threadEngine'
import { LayoutPage, PAGE_SIZES, type PageSize } from './LayoutPage'
import { LayoutPropertiesPanel } from './LayoutPropertiesPanel'
import { PreflightBadge, PreflightPanel } from './PreflightPanel'
import { MasterPagePanel, createDefaultMaster, type MasterPage } from './MasterPagePanel'
import { runPreflight } from '../../lib/preflight'
import type { Document } from '../../store/useStore'

interface Props {
  document: Document
  onSave: (id: string, data: object) => void
}

export function LayoutCanvas({ document, onSave }: Props) {
  const [frames, setFrames] = useState<AnyLayoutFrame[]>(document.layoutFrames || [])
  const [pageCount, setPageCount] = useState<number>(Math.max(1, document.layoutPageCount || 1))
  const [pageSizeKey, setPageSizeKey] = useState<string>(document.layoutPageSize || 'A4')
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [showBaselineGrid, setShowBaselineGrid] = useState(false)
  const [masters, setMasters] = useState<MasterPage[]>(document.layoutMasters || [])
  const [pageAssignments, setPageAssignments] = useState<Record<number, string>>(document.layoutPageAssignments || {})
  const [rightPanelTab, setRightPanelTab] = useState<'props' | 'preflight' | 'masters'>('props')
  const [baselineStep, setBaselineStep] = useState(18)
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)
  const [scale, setScale] = useState(0.7)

  const pageSize: PageSize = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.A4

  // Distribute document content across text frames using threading engine
  const contentMap = useMemo(() => {
    const textFrames = frames.filter(f => !isImageFrame(f)) as LayoutFrame[]
    if (textFrames.length === 0) return new Map<string, string>()
    return distributeContent(document.content || '', textFrames)
  }, [document.content, frames])

  // Preflight report (recomputed when frames/contentMap changes)
  const preflightReport = useMemo(
    () => runPreflight(frames, contentMap, pageCount),
    [frames, contentMap, pageCount]
  )

  const saveLayout = useCallback((
    newFrames: AnyLayoutFrame[],
    pc?: number,
    psk?: string,
    newMasters?: MasterPage[],
    newAssignments?: Record<number, string>,
  ) => {
    onSave(document.id, {
      ...document,
      layoutFrames: newFrames,
      layoutPageCount: pc ?? pageCount,
      layoutPageSize: psk ?? pageSizeKey,
      layoutMasters: newMasters ?? masters,
      layoutPageAssignments: newAssignments ?? pageAssignments,
    })
  }, [document, onSave, pageCount, pageSizeKey, masters, pageAssignments])

  const handleUpdateFrame = useCallback((id: string, updates: Partial<AnyLayoutFrame>) => {
    setFrames(prev => {
      const next = prev.map(f => f.id === id ? { ...f, ...updates } : f)
      saveLayout(next)
      return next
    })
  }, [saveLayout])

  const handleDeleteFrame = useCallback((id: string) => {
    setFrames(prev => {
      // Unlink threading references
      const next = prev
        .filter(f => f.id !== id)
        .map(f => {
          if (!isImageFrame(f)) {
            const tf = f as LayoutFrame
            return {
              ...tf,
              threadNextId: tf.threadNextId === id ? null : tf.threadNextId,
              threadPrevId: tf.threadPrevId === id ? null : tf.threadPrevId,
            }
          }
          return f
        })
      if (selectedFrameId === id) setSelectedFrameId(null)
      saveLayout(next)
      return next
    })
  }, [selectedFrameId, saveLayout])

  const handleAddTextFrame = useCallback((pageIndex: number, x: number, y: number) => {
    const frame = createDefaultFrame(pageIndex, x, y)
    setFrames(prev => { const next = [...prev, frame]; saveLayout(next); return next })
    setSelectedFrameId(frame.id)
  }, [saveLayout])

  const handleAddImageFrame = useCallback((pageIndex: number) => {
    const frame = createDefaultImageFrame(pageIndex, 60, 60)
    setFrames(prev => { const next = [...prev, frame]; saveLayout(next); return next })
    setSelectedFrameId(frame.id)
  }, [saveLayout])

  const handleStartLink = useCallback((id: string) => {
    setLinkingFrom(id)
  }, [])

  const handleCompleteLink = useCallback((targetId: string) => {
    if (!linkingFrom || linkingFrom === targetId) { setLinkingFrom(null); return }
    setFrames(prev => {
      const next = prev.map(f => {
        if (!isImageFrame(f)) {
          const tf = f as LayoutFrame
          if (tf.id === linkingFrom) return { ...tf, threadNextId: targetId }
          if (tf.id === targetId) return { ...tf, threadPrevId: linkingFrom }
        }
        return f
      })
      saveLayout(next)
      return next
    })
    setLinkingFrom(null)
  }, [linkingFrom, saveLayout])

  const handleUnlink = useCallback((id: string) => {
    setFrames(prev => {
      const frame = prev.find(f => f.id === id) as LayoutFrame | undefined
      if (!frame) return prev
      const nextId = frame.threadNextId
      const next = prev.map(f => {
        if (!isImageFrame(f)) {
          const tf = f as LayoutFrame
          if (tf.id === id) return { ...tf, threadNextId: null }
          if (tf.id === nextId) return { ...tf, threadPrevId: null }
        }
        return f
      })
      saveLayout(next)
      return next
    })
  }, [saveLayout])

  // Master page handlers
  const handleCreateMaster = useCallback((name: string) => {
    const m = createDefaultMaster(name)
    const newMasters = [...masters, m]
    setMasters(newMasters)
    saveLayout(frames, pageCount, pageSizeKey, newMasters)
  }, [masters, frames, pageCount, pageSizeKey, saveLayout])

  const handleDeleteMaster = useCallback((id: string) => {
    const newMasters = masters.filter(m => m.id !== id)
    const newAssignments = { ...pageAssignments }
    Object.keys(newAssignments).forEach(k => { if (newAssignments[Number(k)] === id) delete newAssignments[Number(k)] })
    setMasters(newMasters)
    setPageAssignments(newAssignments)
    saveLayout(frames, pageCount, pageSizeKey, newMasters, newAssignments)
  }, [masters, pageAssignments, frames, pageCount, pageSizeKey, saveLayout])

  const handleUpdateMaster = useCallback((id: string, updates: Partial<MasterPage>) => {
    const newMasters = masters.map(m => m.id === id ? { ...m, ...updates } : m)
    setMasters(newMasters)
    saveLayout(frames, pageCount, pageSizeKey, newMasters)
  }, [masters, frames, pageCount, pageSizeKey, saveLayout])

  const handleAssignMaster = useCallback((pageIndex: number, masterId: string | null) => {
    const newAssignments = { ...pageAssignments }
    if (masterId) newAssignments[pageIndex] = masterId
    else delete newAssignments[pageIndex]
    setPageAssignments(newAssignments)
    saveLayout(frames, pageCount, pageSizeKey, masters, newAssignments)
  }, [pageAssignments, frames, pageCount, pageSizeKey, masters, saveLayout])

  const selectedFrame = frames.find(f => f.id === selectedFrameId) || null

  // Cancel linking on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLinkingFrom(null); setSelectedFrameId(null) }
      if (e.key === 'Delete' && selectedFrameId) handleDeleteFrame(selectedFrameId)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [linkingFrom, selectedFrameId, handleDeleteFrame])

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-700">
      {/* Layout toolbar */}
      <div className="absolute top-0 left-52 right-0 z-30 flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs font-sans">
        {/* Page controls */}
        <select value={pageSizeKey}
          onChange={e => { setPageSizeKey(e.target.value); saveLayout(frames, pageCount, e.target.value) }}
          className="bg-slate-700 text-slate-200 border border-slate-600 rounded px-2 py-1 text-xs">
          {Object.keys(PAGE_SIZES).map(k => <option key={k} value={k}>{k}</option>)}
        </select>

        <button onClick={() => { const p = pageCount + 1; setPageCount(p); saveLayout(frames, p) }}
          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition">+ Página</button>
        <button onClick={() => { if (pageCount > 1) { const p = pageCount - 1; setPageCount(p); saveLayout(frames, p) } }}
          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition" disabled={pageCount <= 1}>− Página</button>
        <span className="text-slate-400">{pageCount} pág.</span>

        <div className="w-px h-4 bg-slate-600 mx-1" />

        {/* Add frame buttons */}
        <button
          onClick={() => handleAddTextFrame(0, 60, 60)}
          className="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white transition"
          title="Agregar marco de texto en página 1"
        >+ Texto</button>
        <button
          onClick={() => handleAddImageFrame(0)}
          className="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white transition"
          title="Agregar marco de imagen en página 1"
        >+ Imagen</button>

        {linkingFrom && (
          <div className="px-3 py-1 rounded bg-indigo-500 text-white animate-pulse">
            Haz clic en el marco destino para vincular el texto →
            <button onClick={() => setLinkingFrom(null)} className="ml-2 underline">Cancelar</button>
          </div>
        )}

        <div className="flex-1" />

        {/* Preflight badge */}
        <PreflightBadge report={preflightReport} />

        <div className="w-px h-4 bg-slate-600 mx-1" />

        {/* Baseline grid */}
        <button
          onClick={() => setShowBaselineGrid(!showBaselineGrid)}
          className={`px-2 py-1 rounded transition text-xs ${showBaselineGrid ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          title="Grid de línea base"
        >⊟ Grid</button>
        {showBaselineGrid && (
          <input type="number" min={8} max={40} value={baselineStep}
            onChange={e => setBaselineStep(Number(e.target.value))}
            className="w-14 text-center bg-slate-700 text-slate-200 border border-slate-600 rounded px-1 py-0.5 text-xs"
            title="Paso del grid (px)"
          />
        )}

        <div className="w-px h-4 bg-slate-600 mx-1" />

        {/* Zoom */}
        {[0.5, 0.7, 1.0].map(z => (
          <button key={z} onClick={() => setScale(z)}
            className={`px-2 py-1 rounded text-xs transition ${scale === z ? 'bg-slate-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>

      {/* Page canvas scroll area */}
      <div className="flex-1 overflow-auto pt-14 pb-16">
        <div className="flex flex-col items-center py-8 min-h-full">
          {Array.from({ length: pageCount }, (_, i) => (
            <LayoutPage
              key={i}
              pageIndex={i}
              pageSize={pageSize}
              frames={frames}
              contentMap={contentMap}
              selectedFrameId={selectedFrameId}
              showBaselineGrid={showBaselineGrid}
              baselineGridStep={baselineStep}
              linkingFrom={linkingFrom}
              onSelectFrame={setSelectedFrameId}
              onUpdateFrame={handleUpdateFrame}
              onDeleteFrame={handleDeleteFrame}
              onAddFrame={handleAddTextFrame}
              onStartLink={handleStartLink}
              onCompleteLink={handleCompleteLink}
              scale={scale}
            />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-56 shrink-0 bg-slate-800 border-l border-slate-700 overflow-hidden flex flex-col pt-14">
        {/* Panel tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          {([
            { id: 'props', label: 'Props', emoji: '⚙' },
            { id: 'preflight', label: 'Preflight', emoji: preflightReport.status === 'ok' ? '✓' : preflightReport.status === 'error' ? '✗' : '⚠' },
            { id: 'masters', label: 'Master', emoji: '📋' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setRightPanelTab(tab.id)}
              className={`flex-1 py-2 text-[10px] font-sans transition ${
                rightPanelTab === tab.id
                  ? 'text-white border-b-2 border-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {rightPanelTab === 'props' && (
            <LayoutPropertiesPanel frame={selectedFrame} onUpdate={handleUpdateFrame} onUnlink={handleUnlink} />
          )}
          {rightPanelTab === 'preflight' && (
            <div className="p-3">
              <PreflightPanel report={preflightReport} onSelectFrame={setSelectedFrameId} />
            </div>
          )}
          {rightPanelTab === 'masters' && (
            <MasterPagePanel
              masters={masters}
              pageAssignments={pageAssignments}
              pageCount={pageCount}
              onCreateMaster={handleCreateMaster}
              onDeleteMaster={handleDeleteMaster}
              onUpdateMaster={handleUpdateMaster}
              onAssignMaster={handleAssignMaster}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-slate-700 text-[10px] font-sans text-slate-500">
          {frames.filter(f => !isImageFrame(f)).length}T · {frames.filter(f => isImageFrame(f)).length}I · {pageCount}pág
        </div>
      </div>
    </div>
  )
}
