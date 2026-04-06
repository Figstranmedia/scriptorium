import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { AnyLayoutFrame, LayoutFrame, LayoutImageFrame } from '../../lib/threadEngine'
import {
  createDefaultFrame, createDefaultImageFrame, distributeContent, isImageFrame
} from '../../lib/threadEngine'
import { LayoutPage, PAGE_SIZES, mmToPx, type PageSize, type DrawMode } from './LayoutPage'
import { LayoutPropertiesPanel } from './LayoutPropertiesPanel'
import { PreflightBadge, PreflightPanel } from './PreflightPanel'
import { MasterPagePanel, createDefaultMaster, type MasterPage } from './MasterPagePanel'
import { LayersPanel } from './LayersPanel'
import { PageStrip } from './PageStrip'
import { ContextMenu } from './ContextMenu'
import { AIDesignPanel } from './AIDesignPanel'
import { runPreflight } from '../../lib/preflight'
import { parsePDF } from '../../lib/pdfImport'
import { snapPosition } from '../../lib/snap'
import type { Document, Guide } from '../../store/useStore'

interface Props {
  document: Document
  onSave: (id: string, data: object) => void
}

const MAX_HISTORY = 50

export function LayoutCanvas({ document, onSave }: Props) {
  const [frames, setFrames] = useState<AnyLayoutFrame[]>(document.layoutFrames || [])
  const [pageCount, setPageCount] = useState<number>(Math.max(1, document.layoutPageCount || 1))
  const [pageSizeKey, setPageSizeKey] = useState<string>(document.layoutPageSize || 'A4')
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([])
  const [showBaselineGrid, setShowBaselineGrid] = useState(false)
  const [masters, setMasters] = useState<MasterPage[]>(document.layoutMasters || [])
  const [pageAssignments, setPageAssignments] = useState<Record<number, string>>(document.layoutPageAssignments || {})
  const [guides, setGuides] = useState<Guide[]>(document.layoutGuides || [])
  const [rightPanelTab, setRightPanelTab] = useState<'props' | 'preflight' | 'layers' | 'masters'>('props')
  const [baselineStep, setBaselineStep] = useState(18)
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)
  const [scale, setScale] = useState(0.7)
  const [drawMode, setDrawMode] = useState<DrawMode>('pointer')
  const [importing, setImporting] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapLines, setSnapLines] = useState<Array<{axis:'h'|'v';position:number}>>([])
  const [contextMenu, setContextMenu] = useState<{x:number;y:number;frameId:string|null}|null>(null)
  const [clipboard, setClipboard] = useState<AnyLayoutFrame[]>([])
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [showAIDesign, setShowAIDesign] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Undo/Redo history
  const history = useRef<AnyLayoutFrame[][]>([JSON.parse(JSON.stringify(document.layoutFrames || []))])
  const historyIndex = useRef(0)

  const pageSize: PageSize = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.A4
  const selectedFrameId = selectedFrameIds[selectedFrameIds.length - 1] ?? null

  // Content distribution for threaded frames
  const contentMap = useMemo(() => {
    const textFrames = frames.filter(f => !isImageFrame(f)) as LayoutFrame[]
    const threadFrames = textFrames.filter(f => !f.ownContent && (f.threadNextId || f.threadPrevId || textFrames.length <= 1))
    if (threadFrames.length === 0) return new Map<string, string>()
    return distributeContent(document.content || '', threadFrames)
  }, [document.content, frames])

  const preflightReport = useMemo(() => runPreflight(frames, contentMap, pageCount), [frames, contentMap, pageCount])

  // ── Undo/Redo ────────────────────────────────────────────────────────────────
  const pushHistory = useCallback((newFrames: AnyLayoutFrame[]) => {
    const snapshot = JSON.parse(JSON.stringify(newFrames))
    history.current = history.current.slice(0, historyIndex.current + 1)
    history.current.push(snapshot)
    if (history.current.length > MAX_HISTORY) history.current.shift()
    historyIndex.current = history.current.length - 1
  }, [])

  const undo = useCallback(() => {
    if (historyIndex.current <= 0) return
    historyIndex.current--
    const prev = JSON.parse(JSON.stringify(history.current[historyIndex.current]))
    setFrames(prev)
    saveLayout(prev)
  }, [])

  const redo = useCallback(() => {
    if (historyIndex.current >= history.current.length - 1) return
    historyIndex.current++
    const next = JSON.parse(JSON.stringify(history.current[historyIndex.current]))
    setFrames(next)
    saveLayout(next)
  }, [])

  // ── Save ─────────────────────────────────────────────────────────────────────
  const saveLayout = useCallback((
    newFrames: AnyLayoutFrame[],
    pc?: number,
    psk?: string,
    newMasters?: MasterPage[],
    newAssignments?: Record<number, string>,
    newGuides?: Guide[],
  ) => {
    onSave(document.id, {
      ...document,
      layoutFrames: newFrames,
      layoutPageCount: pc ?? pageCount,
      layoutPageSize: psk ?? pageSizeKey,
      layoutMasters: newMasters ?? masters,
      layoutPageAssignments: newAssignments ?? pageAssignments,
      layoutGuides: newGuides ?? guides,
    })
  }, [document, onSave, pageCount, pageSizeKey, masters, pageAssignments, guides])

  // ── Frame CRUD ───────────────────────────────────────────────────────────────
  const handleUpdateFrame = useCallback((id: string, updates: Partial<AnyLayoutFrame>) => {
    setFrames(prev => {
      // Snap position if moving
      let snapped = updates
      if (('x' in updates || 'y' in updates) && snapEnabled) {
        const f = prev.find(fr => fr.id === id)
        if (f) {
          const nx = ('x' in updates ? updates.x : f.x) as number
          const ny = ('y' in updates ? updates.y : f.y) as number
          const { x, y, lines } = snapPosition(nx, ny, f.width, f.height, prev, guides, mmToPx(pageSize.widthMM), mmToPx(pageSize.heightMM), snapEnabled, scale, id)
          snapped = { ...updates, x, y }
          setSnapLines(lines)
          // Clear snap lines after short delay
          setTimeout(() => setSnapLines([]), 600)
        }
      }
      const next = prev.map(f => f.id === id ? { ...f, ...snapped } : f)
      saveLayout(next)
      return next
    })
  }, [saveLayout, snapEnabled, guides, pageSize, scale])

  const handleDeleteFrame = useCallback((id?: string) => {
    const idsToDelete = id ? [id] : selectedFrameIds
    if (idsToDelete.length === 0) return
    setFrames(prev => {
      const next = prev
        .filter(f => !idsToDelete.includes(f.id))
        .map(f => {
          if (!isImageFrame(f)) {
            const tf = f as LayoutFrame
            return {
              ...tf,
              threadNextId: idsToDelete.includes(tf.threadNextId || '') ? null : tf.threadNextId,
              threadPrevId: idsToDelete.includes(tf.threadPrevId || '') ? null : tf.threadPrevId,
            }
          }
          return f
        })
      pushHistory(next)
      saveLayout(next)
      return next
    })
    setSelectedFrameIds(prev => prev.filter(i => !idsToDelete.includes(i)))
  }, [selectedFrameIds, saveLayout, pushHistory])

  const handleAddTextFrame = useCallback((pageIndex: number, x: number, y: number, w?: number, h?: number) => {
    const frame = createDefaultFrame(pageIndex, x, y, { width: w ?? 400, height: h ?? 500 })
    setFrames(prev => {
      const next = [...prev, frame]
      pushHistory(next)
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
    setDrawMode('pointer')
  }, [saveLayout, pushHistory])

  const handleAddImageFrame = useCallback((pageIndex: number, x: number, y: number, w?: number, h?: number) => {
    const frame = createDefaultImageFrame(pageIndex, x ?? 60, y ?? 60)
    if (w) frame.width = w
    if (h) frame.height = h
    setFrames(prev => {
      const next = [...prev, frame]
      pushHistory(next)
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
    setDrawMode('pointer')
  }, [saveLayout, pushHistory])

  // ── Selection ────────────────────────────────────────────────────────────────
  const handleSelectFrame = useCallback((id: string | null, addToSelection?: boolean) => {
    if (id === null) { setSelectedFrameIds([]); return }
    if (addToSelection) {
      setSelectedFrameIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    } else {
      setSelectedFrameIds([id])
    }
  }, [])

  const handleSelectFramesByRect = useCallback((ids: string[]) => {
    setSelectedFrameIds(ids)
  }, [])

  // ── Alignment (multi-select) ──────────────────────────────────────────────────
  const alignFrames = useCallback((type: string) => {
    const sel = frames.filter(f => selectedFrameIds.includes(f.id))
    if (sel.length < 2) return
    const minX = Math.min(...sel.map(f => f.x))
    const maxX = Math.max(...sel.map(f => f.x + f.width))
    const minY = Math.min(...sel.map(f => f.y))
    const maxY = Math.max(...sel.map(f => f.y + f.height))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setFrames(prev => {
      const next = prev.map(f => {
        if (!selectedFrameIds.includes(f.id)) return f
        switch (type) {
          case 'left':   return { ...f, x: minX }
          case 'right':  return { ...f, x: maxX - f.width }
          case 'cx':     return { ...f, x: centerX - f.width / 2 }
          case 'top':    return { ...f, y: minY }
          case 'bottom': return { ...f, y: maxY - f.height }
          case 'cy':     return { ...f, y: centerY - f.height / 2 }
          case 'distrib-h': {
            const sorted = [...sel].sort((a, b) => a.x - b.x)
            const totalW = sorted.reduce((s, fr) => s + fr.width, 0)
            const gap = (maxX - minX - totalW) / (sorted.length - 1)
            let cx = minX
            const idx = sorted.findIndex(fr => fr.id === f.id)
            for (let i = 0; i < idx; i++) cx += sorted[i].width + gap
            return { ...f, x: cx }
          }
          case 'distrib-v': {
            const sorted = [...sel].sort((a, b) => a.y - b.y)
            const totalH = sorted.reduce((s, fr) => s + fr.height, 0)
            const gap = (maxY - minY - totalH) / (sorted.length - 1)
            let cy = minY
            const idx = sorted.findIndex(fr => fr.id === f.id)
            for (let i = 0; i < idx; i++) cy += sorted[i].height + gap
            return { ...f, y: cy }
          }
          default: return f
        }
      })
      pushHistory(next)
      saveLayout(next)
      return next
    })
  }, [frames, selectedFrameIds, saveLayout, pushHistory])

  // ── Copy / Paste / Duplicate ─────────────────────────────────────────────────
  const copyFrames = useCallback(() => {
    const sel = frames.filter(f => selectedFrameIds.includes(f.id))
    setClipboard(JSON.parse(JSON.stringify(sel)))
  }, [frames, selectedFrameIds])

  const pasteFrames = useCallback((offset = 10) => {
    if (clipboard.length === 0) return
    const newFrames = clipboard.map(f => ({
      ...JSON.parse(JSON.stringify(f)),
      id: `${f.id}_copy_${Date.now()}`,
      x: f.x + offset,
      y: f.y + offset,
    }))
    setFrames(prev => {
      const next = [...prev, ...newFrames]
      pushHistory(next)
      saveLayout(next)
      return next
    })
    setSelectedFrameIds(newFrames.map(f => f.id))
  }, [clipboard, saveLayout, pushHistory])

  const duplicateFrames = useCallback(() => {
    copyFrames()
    // paste happens after clipboard is set via effect
    const sel = frames.filter(f => selectedFrameIds.includes(f.id))
    const newFrames = sel.map(f => ({
      ...JSON.parse(JSON.stringify(f)),
      id: `${f.id}_dup_${Date.now()}_${Math.random()}`,
      x: f.x + 10,
      y: f.y + 10,
    }))
    setFrames(prev => {
      const next = [...prev, ...newFrames]
      pushHistory(next)
      saveLayout(next)
      return next
    })
    setSelectedFrameIds(newFrames.map(f => f.id))
  }, [frames, selectedFrameIds, saveLayout, pushHistory, copyFrames])

  // ── Z-order ──────────────────────────────────────────────────────────────────
  const changeZOrder = useCallback((id: string, dir: 'front'|'back'|'up'|'down') => {
    setFrames(prev => {
      const f = prev.find(fr => fr.id === id)
      if (!f) return prev
      const z = (f as LayoutFrame).zIndex ?? 10
      const next = prev.map(fr => {
        if (fr.id !== id) return fr
        const newZ = dir === 'front' ? 100 : dir === 'back' ? 1 : dir === 'up' ? z + 1 : Math.max(1, z - 1)
        return { ...fr, zIndex: newZ }
      })
      saveLayout(next)
      return next
    })
  }, [saveLayout])

  // ── Guides ───────────────────────────────────────────────────────────────────
  const handleAddGuide = useCallback((g: Omit<Guide, 'id'>) => {
    const newGuide: Guide = { ...g, id: `g_${Date.now()}` }
    setGuides(prev => {
      const next = [...prev, newGuide]
      saveLayout(frames, pageCount, pageSizeKey, masters, pageAssignments, next)
      return next
    })
  }, [frames, pageCount, pageSizeKey, masters, pageAssignments, saveLayout])

  const handleDeleteGuide = useCallback((id: string) => {
    setGuides(prev => {
      const next = prev.filter(g => g.id !== id)
      saveLayout(frames, pageCount, pageSizeKey, masters, pageAssignments, next)
      return next
    })
  }, [frames, pageCount, pageSizeKey, masters, pageAssignments, saveLayout])

  // ── Threading ────────────────────────────────────────────────────────────────
  const handleStartLink = useCallback((id: string) => setLinkingFrom(id), [])

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

  // ── Master pages ─────────────────────────────────────────────────────────────
  const handleCreateMaster = useCallback((name: string) => {
    const m = createDefaultMaster(name)
    const nm = [...masters, m]
    setMasters(nm)
    saveLayout(frames, pageCount, pageSizeKey, nm)
  }, [masters, frames, pageCount, pageSizeKey, saveLayout])

  const handleDeleteMaster = useCallback((id: string) => {
    const nm = masters.filter(m => m.id !== id)
    const na = { ...pageAssignments }
    Object.keys(na).forEach(k => { if (na[Number(k)] === id) delete na[Number(k)] })
    setMasters(nm); setPageAssignments(na)
    saveLayout(frames, pageCount, pageSizeKey, nm, na)
  }, [masters, pageAssignments, frames, pageCount, pageSizeKey, saveLayout])

  const handleUpdateMaster = useCallback((id: string, updates: Partial<MasterPage>) => {
    const nm = masters.map(m => m.id === id ? { ...m, ...updates } : m)
    setMasters(nm)
    saveLayout(frames, pageCount, pageSizeKey, nm)
  }, [masters, frames, pageCount, pageSizeKey, saveLayout])

  const handleAssignMaster = useCallback((pageIndex: number, masterId: string | null) => {
    const na = { ...pageAssignments }
    if (masterId) na[pageIndex] = masterId; else delete na[pageIndex]
    setPageAssignments(na)
    saveLayout(frames, pageCount, pageSizeKey, masters, na)
  }, [pageAssignments, frames, pageCount, pageSizeKey, masters, saveLayout])

  // ── Page management ──────────────────────────────────────────────────────────
  const handleAddPage = useCallback((afterIndex: number) => {
    const newCount = pageCount + 1
    // Shift all frames after afterIndex
    setFrames(prev => {
      const next = prev.map(f => f.pageIndex > afterIndex ? { ...f, pageIndex: f.pageIndex + 1 } : f)
      setPageCount(newCount)
      saveLayout(next, newCount)
      return next
    })
  }, [pageCount, saveLayout])

  const handleDeletePage = useCallback((pageIndex: number) => {
    if (pageCount <= 1) return
    setFrames(prev => {
      const next = prev
        .filter(f => f.pageIndex !== pageIndex)
        .map(f => f.pageIndex > pageIndex ? { ...f, pageIndex: f.pageIndex - 1 } : f)
      const newCount = pageCount - 1
      setPageCount(newCount)
      saveLayout(next, newCount)
      return next
    })
  }, [pageCount, saveLayout])

  const scrollToPage = useCallback((pageIndex: number) => {
    setActivePageIndex(pageIndex)
    if (scrollRef.current) {
      const pageH = mmToPx(pageSize.heightMM) * scale
      const paddingTop = 32
      const marginBottom = 48
      const targetY = paddingTop + pageIndex * (pageH + marginBottom)
      scrollRef.current.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }, [pageSize, scale])

  // ── PDF Import ───────────────────────────────────────────────────────────────
  const handleImportPDF = useCallback(async () => {
    setImporting(true)
    try {
      const result = await window.api.importPDF()
      if (!result) return
      const { data, name } = result
      const parsed = await parsePDF(data)
      const newPageSizeKey = parsed.pageSizeName
      const newPageSize = PAGE_SIZES[newPageSizeKey] || PAGE_SIZES.A4
      const ptToPx = 96 / 72
      const newFrames: LayoutFrame[] = parsed.blocks.map(block =>
        createDefaultFrame(block.pageIndex, Math.max(0, block.x * ptToPx), Math.max(0, block.y * ptToPx), {
          width: Math.min(block.width * ptToPx, mmToPx(newPageSize.widthMM) - block.x * ptToPx),
          height: Math.max(20, block.height * ptToPx + 8),
          fontSize: Math.max(8, Math.min(72, block.fontSize)),
          fontWeight: block.isBold ? 'bold' : 'normal',
          ownContent: block.text,
          paddingTop: 4, paddingRight: 6, paddingBottom: 4, paddingLeft: 6,
        })
      )
      const newPageCount = Math.max(pageCount, parsed.pageCount)
      setFrames(prev => {
        const next = [...prev, ...newFrames]
        pushHistory(next)
        saveLayout(next, newPageCount, newPageSizeKey)
        return next
      })
      setPageCount(newPageCount)
      setPageSizeKey(newPageSizeKey)
      alert(`PDF importado: ${name}\n${newFrames.length} bloques de texto en ${parsed.pageCount} páginas.`)
    } catch (err) {
      alert('Error al importar PDF: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
    }
  }, [pageCount, saveLayout, pushHistory])

  // ── Context menu ─────────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, frameId: string | null) => {
    e.preventDefault()
    if (frameId && !selectedFrameIds.includes(frameId)) setSelectedFrameIds([frameId])
    setContextMenu({ x: e.clientX, y: e.clientY, frameId })
  }, [selectedFrameIds])

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return []
    const fid = contextMenu.frameId
    return [
      ...(fid ? [
        { label: 'Cortar', icon: '✂️', shortcut: '⌘X', action: () => { copyFrames(); handleDeleteFrame(fid) } },
        { label: 'Copiar', icon: '📋', shortcut: '⌘C', action: copyFrames },
      ] : []),
      ...(clipboard.length > 0 ? [{ label: 'Pegar', icon: '📌', shortcut: '⌘V', action: () => pasteFrames() }] : []),
      ...(fid ? [
        { label: 'Duplicar', icon: '⧉', shortcut: '⌘D', action: duplicateFrames },
        { separator: true as const },
        { label: 'Traer al frente', icon: '⬆', action: () => changeZOrder(fid, 'front') },
        { label: 'Subir un nivel', icon: '↑', action: () => changeZOrder(fid, 'up') },
        { label: 'Bajar un nivel', icon: '↓', action: () => changeZOrder(fid, 'down') },
        { label: 'Enviar al fondo', icon: '⬇', action: () => changeZOrder(fid, 'back') },
        { separator: true as const },
        { label: 'Bloquear', icon: '🔒', action: () => handleUpdateFrame(fid, { locked: true } as Partial<AnyLayoutFrame>) },
        { separator: true as const },
        { label: 'Eliminar', icon: '🗑', danger: true, action: () => handleDeleteFrame(fid) },
      ] : []),
    ]
  }, [contextMenu, clipboard, copyFrames, pasteFrames, duplicateFrames, handleDeleteFrame, changeZOrder, handleUpdateFrame])

  // ── Scroll to track active page ──────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      const pageH = mmToPx(pageSize.heightMM) * scale + 48
      const idx = Math.round(el.scrollTop / pageH)
      setActivePageIndex(Math.max(0, Math.min(idx, pageCount - 1)))
    }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [pageSize, scale, pageCount])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }

      // Copy/Paste/Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') { e.preventDefault(); copyFrames(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') { e.preventDefault(); pasteFrames(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicateFrames(); return }

      // Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); setSelectedFrameIds(frames.map(f => f.id)); return }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFrameIds.length > 0) { e.preventDefault(); handleDeleteFrame(); return }
      }

      // Escape
      if (e.key === 'Escape') { setLinkingFrom(null); setSelectedFrameIds([]); setDrawMode('pointer'); setContextMenu(null); return }

      // Draw mode shortcuts
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-text' ? 'pointer' : 'draw-text'); return }
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-image' ? 'pointer' : 'draw-image'); return }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) { setSnapEnabled(v => !v); return }

      // Zoom
      if (e.key === '0' && !e.metaKey) { setScale(1.0); return }
      if (e.key === '1' && !e.metaKey) {
        // Fit page to canvas
        if (scrollRef.current) {
          const cw = scrollRef.current.clientWidth
          const fitScale = Math.min(1.0, (cw - 80) / mmToPx(pageSize.widthMM))
          setScale(Math.round(fitScale * 100) / 100)
        }
        return
      }

      // Arrow keys — move selected frame(s)
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && selectedFrameIds.length > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        setFrames(prev => {
          const next = prev.map(f => selectedFrameIds.includes(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f)
          saveLayout(next)
          return next
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedFrameIds, frames, undo, redo, copyFrames, pasteFrames, duplicateFrames, handleDeleteFrame, saveLayout, pageSize])

  // Zoom with Ctrl/Cmd + scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      setScale(prev => Math.max(0.25, Math.min(4.0, prev - e.deltaY * 0.001)))
    }
  }, [])

  const selectedFrame = frames.find(f => f.id === selectedFrameId) || null

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-700" style={{ position: 'relative' }}>

      {/* Page strip (left) */}
      <PageStrip
        pageCount={pageCount}
        pageSize={pageSize}
        frames={frames}
        activePageIndex={activePageIndex}
        onScrollToPage={scrollToPage}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
      />

      {/* Main canvas area */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-slate-700 text-xs font-sans flex-wrap shrink-0" style={{ zIndex: 30 }}>

          {/* Draw mode tools */}
          <div className="flex items-center gap-0.5 bg-slate-700 rounded p-0.5">
            <button onClick={() => setDrawMode('pointer')}
              className={`px-2 py-1 rounded text-xs transition ${drawMode === 'pointer' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Selección (Esc)">↖</button>
            <button onClick={() => setDrawMode('draw-text')}
              className={`px-2 py-1 rounded text-xs transition font-bold ${drawMode === 'draw-text' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Marco de texto (T)">T</button>
            <button onClick={() => setDrawMode('draw-image')}
              className={`px-2 py-1 rounded text-xs transition ${drawMode === 'draw-image' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Marco de imagen (I)">🖼</button>
          </div>

          <div className="w-px h-4 bg-slate-600" />

          {/* Undo/Redo */}
          <button onClick={undo} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition" title="Deshacer (⌘Z)">↩</button>
          <button onClick={redo} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition" title="Rehacer (⌘⇧Z)">↪</button>

          <div className="w-px h-4 bg-slate-600" />

          {/* Snap toggle */}
          <button onClick={() => setSnapEnabled(v => !v)}
            className={`px-2 py-1 rounded text-xs transition ${snapEnabled ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-400'}`}
            title="Snap magnético (S)">⊞ Snap</button>

          <div className="w-px h-4 bg-slate-600" />

          {/* Page controls */}
          <select value={pageSizeKey}
            onChange={e => { setPageSizeKey(e.target.value); saveLayout(frames, pageCount, e.target.value) }}
            className="bg-slate-700 text-slate-200 border border-slate-600 rounded px-2 py-1 text-xs">
            {Object.keys(PAGE_SIZES).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="text-slate-400">{pageCount} pág.</span>

          <div className="w-px h-4 bg-slate-600" />

          {/* PDF Import */}
          <button onClick={handleImportPDF} disabled={importing}
            className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition text-xs disabled:opacity-50"
            title="Importar PDF y detectar estructura">
            {importing ? '⏳ Importando…' : '⬆ PDF'}
          </button>

          {/* AI Design */}
          <button
            onClick={() => setShowAIDesign(v => !v)}
            className={`px-2 py-1 rounded text-xs transition ${showAIDesign ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            title="IA Diseño — modifica el marco seleccionado con IA"
          >✨ IA</button>

          {/* Linking / Draw mode hints */}
          {linkingFrom && (
            <div className="px-3 py-1 rounded bg-indigo-500 text-white animate-pulse text-xs">
              Clic en el marco destino →
              <button onClick={() => setLinkingFrom(null)} className="ml-2 underline">Cancelar</button>
            </div>
          )}
          {drawMode !== 'pointer' && !linkingFrom && (
            <div className={`px-3 py-1 rounded text-white text-xs animate-pulse ${drawMode === 'draw-text' ? 'bg-blue-600' : 'bg-purple-600'}`}>
              {drawMode === 'draw-text' ? 'Arrastra para crear marco de texto' : 'Arrastra para crear marco de imagen'}
              <button onClick={() => setDrawMode('pointer')} className="ml-2 underline">Cancelar</button>
            </div>
          )}

          {/* Alignment toolbar (multi-select) */}
          {selectedFrameIds.length >= 2 && (
            <>
              <div className="w-px h-4 bg-slate-600" />
              <div className="flex gap-0.5 bg-slate-700 rounded p-0.5">
                {[
                  { k:'left', t:'Alinear izquierdas', i:'⬛' },
                  { k:'cx',   t:'Centrar horizontal', i:'⬜' },
                  { k:'right',t:'Alinear derechas',   i:'⬛' },
                  { k:'top',  t:'Alinear arriba',     i:'⬛' },
                  { k:'cy',   t:'Centrar vertical',   i:'⬜' },
                  { k:'bottom',t:'Alinear abajo',     i:'⬛' },
                  { k:'distrib-h',t:'Distribuir H',   i:'↔' },
                  { k:'distrib-v',t:'Distribuir V',   i:'↕' },
                ].map(({ k, t, i }) => (
                  <button key={k} onClick={() => alignFrames(k)} title={t}
                    className="px-1.5 py-1 rounded text-xs text-slate-300 hover:bg-slate-600 transition">{i}</button>
                ))}
              </div>
            </>
          )}

          <div className="flex-1" />

          <PreflightBadge report={preflightReport} />
          <div className="w-px h-4 bg-slate-600" />

          {/* Baseline grid */}
          <button onClick={() => setShowBaselineGrid(!showBaselineGrid)}
            className={`px-2 py-1 rounded transition text-xs ${showBaselineGrid ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            ⊟ Grid
          </button>
          {showBaselineGrid && (
            <input type="number" min={8} max={40} value={baselineStep}
              onChange={e => setBaselineStep(Number(e.target.value))}
              className="w-14 text-center bg-slate-700 text-slate-200 border border-slate-600 rounded px-1 py-0.5 text-xs" />
          )}

          <div className="w-px h-4 bg-slate-600" />

          {/* Zoom */}
          <span className="text-slate-400 text-xs">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.25, s - 0.1))} className="px-1.5 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">−</button>
          <button onClick={() => setScale(s => Math.min(4, s + 0.1))} className="px-1.5 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs">+</button>
          {[0.5, 0.7, 1.0].map(z => (
            <button key={z} onClick={() => setScale(z)}
              className={`px-2 py-1 rounded text-xs transition ${Math.abs(scale - z) < 0.01 ? 'bg-slate-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>

        {/* Canvas scroll area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-slate-700"
          onWheel={handleWheel}
          style={{ paddingTop: 8, paddingBottom: 64 }}
        >
          <div className="flex flex-col items-center py-6 min-h-full">
            {Array.from({ length: pageCount }, (_, i) => (
              <LayoutPage
                key={i}
                pageIndex={i}
                pageSize={pageSize}
                frames={frames}
                contentMap={contentMap}
                selectedFrameIds={selectedFrameIds}
                showBaselineGrid={showBaselineGrid}
                baselineGridStep={baselineStep}
                linkingFrom={linkingFrom}
                drawMode={drawMode}
                guides={guides}
                snapLines={snapLines}
                onSelectFrame={handleSelectFrame}
                onSelectFramesByRect={handleSelectFramesByRect}
                onUpdateFrame={handleUpdateFrame}
                onDeleteFrame={(id) => handleDeleteFrame(id)}
                onAddTextFrame={handleAddTextFrame}
                onAddImageFrame={handleAddImageFrame}
                onStartLink={handleStartLink}
                onCompleteLink={handleCompleteLink}
                onDoubleClickGuide={handleDeleteGuide}
                onContextMenu={handleContextMenu}
                scale={scale}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-56 shrink-0 bg-slate-800 border-l border-slate-700 overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-700 shrink-0">
          {([
            { id: 'props',    label: 'Props',    emoji: '⚙' },
            { id: 'preflight',label: 'Check',    emoji: preflightReport.status === 'ok' ? '✓' : '⚠' },
            { id: 'layers',   label: 'Capas',    emoji: '◫' },
            { id: 'masters',  label: 'Master',   emoji: '📋' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setRightPanelTab(tab.id)}
              className={`flex-1 py-2 text-[9px] font-sans transition ${rightPanelTab === tab.id ? 'text-white border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
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
              <PreflightPanel report={preflightReport} onSelectFrame={(id) => setSelectedFrameIds([id])} />
            </div>
          )}
          {rightPanelTab === 'layers' && (
            <LayersPanel
              frames={frames}
              selectedFrameIds={selectedFrameIds}
              pageCount={pageCount}
              onSelectFrame={(id) => setSelectedFrameIds([id])}
              onUpdateFrame={handleUpdateFrame}
              onDeleteFrame={(id) => handleDeleteFrame(id)}
            />
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

        <div className="px-3 py-2 border-t border-slate-700 text-[10px] font-sans text-slate-500">
          {frames.filter(f => !isImageFrame(f)).length}T · {frames.filter(f => isImageFrame(f)).length}I · {pageCount}pág
          {selectedFrameIds.length > 1 && <span className="ml-2 text-indigo-400">{selectedFrameIds.length} sel.</span>}
        </div>
      </div>

      {/* AI Design floating panel */}
      {showAIDesign && (
        <div style={{ position: 'absolute', top: 56, right: 232, zIndex: 500 }}>
          <AIDesignPanel
            selectedFrame={selectedFrame}
            onApply={(changes) => {
              if (selectedFrameId) {
                handleUpdateFrame(selectedFrameId, changes as Partial<AnyLayoutFrame>)
              }
            }}
            onClose={() => setShowAIDesign(false)}
          />
        </div>
      )}

      {/* Context menu */}
      {contextMenu && contextMenuItems.length > 0 && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
