import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { AnyLayoutFrame, LayoutFrame, LayoutImageFrame, LayoutShapeFrame } from '../../lib/threadEngine'
import {
  createDefaultFrame, createDefaultImageFrame, createDefaultShapeFrame, createDefaultChartFrame,
  createDefaultTableFrame,
  distributeContent, isImageFrame, isShapeFrame, isChartFrame, isTableFrame
} from '../../lib/threadEngine'
import { LayoutPage, PAGE_SIZES, mmToPx, type PageSize, type DrawMode } from './LayoutPage'
import { PreflightBadge, PreflightPanel } from './PreflightPanel'
import { MasterPagePanel, createDefaultMaster, type MasterPage } from './MasterPagePanel'
import { PageStrip } from './PageStrip'
import { ContextMenu } from './ContextMenu'
import { AIDesignPanel } from './AIDesignPanel'
import { AILayoutBar } from './AILayoutBar'
import type { LayoutOp } from './AILayoutBar'
import { runPreflight } from '../../lib/preflight'
import { parsePDF, renderPDFToImages } from '../../lib/pdfImport'
import { parseDocxHTML } from '../../lib/docxImport'
import { snapPosition } from '../../lib/snap'
import type { Document, Guide, ParagraphStyle } from '../../store/useStore'
import { DEFAULT_PARAGRAPH_STYLES } from '../../store/useStore'
import { CoverCanvas } from './CoverCanvas'
import { StudioSidebar } from './StudioSidebar'
import { ToolSidebar } from './ToolSidebar'

interface Props {
  document: Document
  onSave: (id: string, data: object) => void
  onAIAction?: (action: string, text: string) => void
}

const MAX_HISTORY = 50

export function LayoutCanvas({ document, onSave, onAIAction }: Props) {
  // Cover documents get their own specialized canvas
  if (document.docType === 'cover' && document.coverConfig) {
    return <CoverCanvas document={document} onSave={onSave} onAIAction={onAIAction} />
  }

  const [frames, setFrames] = useState<AnyLayoutFrame[]>(document.layoutFrames || [])
  const [pageCount, setPageCount] = useState<number>(Math.max(1, document.layoutPageCount || 1))
  const [pageSizeKey, setPageSizeKey] = useState<string>(document.layoutPageSize || 'A4')
  const [selectedFrameIds, setSelectedFrameIds] = useState<string[]>([])
  const [showBaselineGrid, setShowBaselineGrid] = useState(false)
  const [masters, setMasters] = useState<MasterPage[]>(document.layoutMasters || [])
  const [pageAssignments, setPageAssignments] = useState<Record<number, string>>(document.layoutPageAssignments || {})
  const [guides, setGuides] = useState<Guide[]>(document.layoutGuides || [])
  const [historyRevision, setHistoryRevision] = useState(0)
  const [paragraphStyles, setParagraphStyles] = useState<ParagraphStyle[]>(
    document.paragraphStyles && document.paragraphStyles.length > 0
      ? document.paragraphStyles
      : DEFAULT_PARAGRAPH_STYLES
  )
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
  const [showAILayout, setShowAILayout] = useState(false)
  const [spreadPages, setSpreadPages] = useState<number[]>((document as any).layoutSpreadPages || [])
  const [leftPanelWidth, setLeftPanelWidth] = useState(96)
  const [rightPanelWidth, setRightPanelWidth] = useState(224)
  const [autoEditFrameId, setAutoEditFrameId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const leftDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const rightDragRef = useRef<{ startX: number; startW: number } | null>(null)
  // Spacebar panning
  const spaceHeld = useRef(false)
  const panOrigin = useRef<{ mx: number; my: number; sl: number; st: number } | null>(null)
  const [panning, setPanning] = useState(false)

  // Sync page size and count from document when changed externally (e.g. DocumentSetupModal)
  useEffect(() => {
    const key = document.layoutPageSize
    if (key && key !== pageSizeKey) setPageSizeKey(key)
  }, [document.layoutPageSize])

  useEffect(() => {
    const count = document.layoutPageCount
    if (count && count > 0 && count !== pageCount) setPageCount(count)
  }, [document.layoutPageCount])

  // Undo/Redo history
  const history = useRef<AnyLayoutFrame[][]>([JSON.parse(JSON.stringify(document.layoutFrames || []))])
  const historyIndex = useRef(0)
  const historyLabels = useRef<string[]>(['Estado inicial'])

  // Resolve page size — supports 'custom' with explicit dimensions from document
  const pageSize: PageSize = pageSizeKey === 'custom' && (document as any).layoutCustomWidthMM && (document as any).layoutCustomHeightMM
    ? { name: 'custom', widthMM: (document as any).layoutCustomWidthMM, heightMM: (document as any).layoutCustomHeightMM }
    : PAGE_SIZES[pageSizeKey] || PAGE_SIZES.A4

  const selectedFrameId = selectedFrameIds[selectedFrameIds.length - 1] ?? null

  // Content distribution for threaded frames
  const contentMap = useMemo(() => {
    const textFrames = frames.filter(
      f => !isImageFrame(f) && !isShapeFrame(f) && !isChartFrame(f) && !isTableFrame(f)
    ) as LayoutFrame[]

    const result = new Map<string, string>()
    const frameMap = new Map(textFrames.map(f => [f.id, f]))

    // ── Layout-mode chains: head frame has ownContent + threadNextId ──────────
    // Find each chain head (has content, has a next frame, no valid previous)
    textFrames.forEach(frame => {
      if (!frame.ownContent || !frame.threadNextId) return
      const hasPrev = frame.threadPrevId && frameMap.has(frame.threadPrevId)
      if (hasPrev) return // not the head, skip

      // Build the full chain from this head
      const chain: LayoutFrame[] = []
      const visited = new Set<string>()
      let cur: LayoutFrame | undefined = frame
      while (cur && !visited.has(cur.id)) {
        chain.push(cur)
        visited.add(cur.id)
        cur = cur.threadNextId ? frameMap.get(cur.threadNextId) : undefined
      }
      if (chain.length <= 1) return

      // Distribute the head's ownContent across all frames in the chain
      const distributed = distributeContent(frame.ownContent, chain)
      // The head keeps its ownContent for editing; following frames get distributed slices
      distributed.forEach((html, id) => {
        if (id !== frame.id) result.set(id, html)
      })
    })

    // ── Write-mode import: distribute document.content across empty threaded frames ──
    const emptyThreadFrames = textFrames.filter(
      f => !f.ownContent && (f.threadNextId || f.threadPrevId)
    )
    if (emptyThreadFrames.length > 0 && document.content) {
      const docDist = distributeContent(document.content, emptyThreadFrames)
      docDist.forEach((html, id) => result.set(id, html))
    }

    return result
  }, [document.content, frames])

  const preflightReport = useMemo(() => runPreflight(frames, contentMap, pageCount), [frames, contentMap, pageCount])

  // ── Undo/Redo ────────────────────────────────────────────────────────────────
  const pushHistory = useCallback((newFrames: AnyLayoutFrame[], label = 'Editar') => {
    const snapshot = JSON.parse(JSON.stringify(newFrames))
    history.current = history.current.slice(0, historyIndex.current + 1)
    historyLabels.current = historyLabels.current.slice(0, historyIndex.current + 1)
    history.current.push(snapshot)
    historyLabels.current.push(label)
    if (history.current.length > MAX_HISTORY) {
      history.current.shift()
      historyLabels.current.shift()
    }
    historyIndex.current = history.current.length - 1
    setHistoryRevision(r => r + 1)
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

  const saveCheckpoint = useCallback(() => {
    const label = window.prompt('Nombre del punto de control:', `Checkpoint ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`)
    if (!label) return
    pushHistory(frames, `⊙ ${label}`)
  }, [frames, pushHistory])

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
      paragraphStyles,
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
      pushHistory(next, 'Eliminar')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds(prev => prev.filter(i => !idsToDelete.includes(i)))
  }, [selectedFrameIds, saveLayout, pushHistory])

  const handleAddTextFrame = useCallback((pageIndex: number, x: number, y: number, w?: number, h?: number) => {
    const frame = createDefaultFrame(pageIndex, x, y, { width: w ?? 400, height: h ?? 500 })
    setFrames(prev => {
      const next = [...prev, frame]
      pushHistory(next, 'Añadir texto')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
    setAutoEditFrameId(frame.id)
    setDrawMode('pointer')
  }, [saveLayout, pushHistory])

  const handleAddImageFrame = useCallback((pageIndex: number, x: number, y: number, w?: number, h?: number) => {
    const frame = createDefaultImageFrame(pageIndex, x ?? 60, y ?? 60)
    if (w) frame.width = w
    if (h) frame.height = h
    setFrames(prev => {
      const next = [...prev, frame]
      pushHistory(next, 'Añadir imagen')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
    setDrawMode('pointer')
  }, [saveLayout, pushHistory])

  // Insert AI-generated image into the current page as an image frame
  const handleInsertGeneratedImage = useCallback((dataUrl: string) => {
    const frame = createDefaultImageFrame(activePageIndex, 60, 60)
    frame.src = dataUrl
    frame.width = 300
    frame.height = 300
    setFrames(prev => {
      const next = [...prev, frame]
      pushHistory(next, 'Insertar imagen IA')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
  }, [activePageIndex, saveLayout, pushHistory])

  const handleAddShapeFrame = useCallback((
    pageIndex: number, x: number, y: number,
    shapeType: 'rect' | 'ellipse' | 'line', w?: number, h?: number
  ) => {
    const frame = createDefaultShapeFrame(pageIndex, x, y, shapeType, {
      width: w ?? 200,
      height: h ?? (shapeType === 'line' ? 2 : 150),
    })
    setFrames(prev => {
      const next = [...prev, frame]
      const label = shapeType === 'rect' ? 'Añadir rect.' : shapeType === 'ellipse' ? 'Añadir elipse' : 'Añadir línea'
      pushHistory(next, label)
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
    setDrawMode('pointer')
  }, [saveLayout, pushHistory])

  const handleAddChartFrame = useCallback((
    pageIndex: number, x: number, y: number, w?: number, h?: number
  ) => {
    const frame = createDefaultChartFrame(pageIndex, x, y, {
      width: w ?? 320,
      height: h ?? 240,
    })
    setFrames(prev => {
      const next = [...prev, frame]
      pushHistory(next, 'Añadir gráfico')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
    setDrawMode('pointer')
  }, [saveLayout, pushHistory])

  const handleAddTableFrame = useCallback((
    pageIndex: number, x: number, y: number, w?: number, h?: number
  ) => {
    const frame = createDefaultTableFrame(pageIndex, x, y, {
      width: w ?? 320,
      height: h ?? 160,
    })
    setFrames(prev => {
      const next = [...prev, frame]
      pushHistory(next, 'Añadir tabla')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([frame.id])
    setDrawMode('pointer')
  }, [saveLayout, pushHistory])

  // ── Resizable panel drag handlers ────────────────────────────────────────────
  const handleLeftDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    leftDragRef.current = { startX: e.clientX, startW: leftPanelWidth }
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - leftDragRef.current!.startX
      setLeftPanelWidth(Math.max(60, Math.min(200, leftDragRef.current!.startW + delta)))
    }
    const onUp = () => {
      leftDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [leftPanelWidth])

  const handleRightDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    rightDragRef.current = { startX: e.clientX, startW: rightPanelWidth }
    const onMove = (ev: MouseEvent) => {
      const delta = rightDragRef.current!.startX - ev.clientX
      setRightPanelWidth(Math.max(160, Math.min(420, rightDragRef.current!.startW + delta)))
    }
    const onUp = () => {
      rightDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rightPanelWidth])

  // ── Selection ────────────────────────────────────────────────────────────────
  const handleSelectFrame = useCallback((id: string | null, addToSelection?: boolean) => {
    if (id === null) { setSelectedFrameIds([]); return }
    if (addToSelection) {
      setSelectedFrameIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    } else {
      setSelectedFrameIds([id])
    }
    // Auto-sync active page to the selected frame's page
    const frame = frames.find(f => f.id === id)
    if (frame) setActivePageIndex(frame.pageIndex)
  }, [frames])

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
      pushHistory(next, 'Alinear')
      saveLayout(next)
      return next
    })
  }, [frames, selectedFrameIds, saveLayout, pushHistory])

  // ── Jump to history state ─────────────────────────────────────────────────────
  const handleJumpToHistory = useCallback((idx: number) => {
    if (idx < 0 || idx >= history.current.length) return
    historyIndex.current = idx
    const snapshot = JSON.parse(JSON.stringify(history.current[idx]))
    setFrames(snapshot)
    saveLayout(snapshot)
    setHistoryRevision(r => r + 1)
  }, [saveLayout])

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
      pushHistory(next, 'Pegar')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds(newFrames.map(f => f.id))
  }, [clipboard, saveLayout, pushHistory])

  const duplicateFrames = useCallback(() => {
    copyFrames()
    const sel = frames.filter(f => selectedFrameIds.includes(f.id))
    const newFrames = sel.map(f => ({
      ...JSON.parse(JSON.stringify(f)),
      id: `${f.id}_dup_${Date.now()}_${Math.random()}`,
      x: f.x + 10,
      y: f.y + 10,
    }))
    setFrames(prev => {
      const next = [...prev, ...newFrames]
      pushHistory(next, 'Duplicar')
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

  // Called from LayoutPage when user drags on empty page background while in link mode.
  // Creates a new text frame and immediately threads it to the current linkingFrom frame.
  const handleLinkToNewFrame = useCallback((pageIndex: number, x: number, y: number, w: number, h: number) => {
    if (!linkingFrom) return
    const sourceId = linkingFrom
    const newFrame = createDefaultFrame(pageIndex, x, y, { width: w, height: h })
    const linked = { ...newFrame, threadPrevId: sourceId }
    setFrames(prev => {
      const next = prev.map(f => {
        if (!isImageFrame(f)) {
          const tf = f as LayoutFrame
          if (tf.id === sourceId) return { ...tf, threadNextId: newFrame.id }
        }
        return f
      })
      next.push(linked)
      pushHistory(next, 'Vincular nuevo marco')
      saveLayout(next)
      return next
    })
    setSelectedFrameIds([newFrame.id])
    setLinkingFrom(null)
    setAutoEditFrameId(null) // new linked frame: don't auto-edit, let user decide
  }, [linkingFrom, saveLayout, pushHistory])

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

  // ── Paragraph styles ─────────────────────────────────────────────────────────
  const handleUpdateStyles = useCallback((newStyles: ParagraphStyle[]) => {
    setParagraphStyles(newStyles)
    // Cascade: update all frames that reference a changed style
    setFrames(prev => {
      const updated = prev.map(f => {
        if (isImageFrame(f)) return f
        const tf = f as LayoutFrame
        if (!tf.paragraphStyleId) return f
        const style = newStyles.find(s => s.id === tf.paragraphStyleId)
        if (!style) return f
        return {
          ...tf,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textAlign: style.textAlign,
          textColor: style.textColor,
          letterSpacing: style.letterSpacing,
        }
      })
      saveLayout(updated)
      return updated
    })
  }, [saveLayout])

  const handleApplyStyle = useCallback((frameId: string, style: ParagraphStyle) => {
    setFrames(prev => {
      const updated = prev.map(f => {
        if (f.id !== frameId || isImageFrame(f)) return f
        return {
          ...f,
          paragraphStyleId: style.id,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          textAlign: style.textAlign,
          textColor: style.textColor,
          letterSpacing: style.letterSpacing,
        }
      })
      saveLayout(updated)
      return updated
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

  // ── AI Layout — full-canvas multi-frame operations ───────────────────────────
  const handleAILayout = useCallback(async (instruction: string) => {
    const PX_PER_MM = 96 / 25.4
    const pxToMM = (px: number) => px / PX_PER_MM

    // Build compact frame descriptors
    const frameData = frames.map(f => {
      const isImg = 'src' in f
      const isShape = 'shapeType' in f
      const ff = f as any
      const contentSnippet = !isImg && !isShape
        ? (ff.ownContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
        : undefined
      const props: Record<string, any> = {}
      if (!isImg && !isShape) {
        if (ff.fontSize) props.fontSize = ff.fontSize
        if (ff.fontFamily) props.fontFamily = ff.fontFamily
        if (ff.fontWeight && ff.fontWeight !== 'normal') props.fontWeight = ff.fontWeight
        if (ff.textColor) props.textColor = ff.textColor
        if (ff.textAlign) props.textAlign = ff.textAlign
        if (ff.backgroundColor && ff.backgroundColor !== 'transparent') props.backgroundColor = ff.backgroundColor
        if (ff.lineHeight) props.lineHeight = ff.lineHeight
      }
      if (isShape) { props.shapeType = ff.shapeType; props.fill = ff.fill }
      return {
        id: f.id, type: isImg ? 'image' : isShape ? (ff.shapeType || 'rect') : 'text',
        page: f.pageIndex,
        xMM: Math.round(pxToMM(f.x) * 10) / 10,
        yMM: Math.round(pxToMM(f.y) * 10) / 10,
        wMM: Math.round(pxToMM(f.width) * 10) / 10,
        hMM: Math.round(pxToMM(f.height) * 10) / 10,
        contentSnippet, props,
      }
    })

    const res = await window.api.aiDesignLayout({
      instruction,
      frames: frameData,
      pageWidthMM: pageSize.widthMM,
      pageHeightMM: pageSize.heightMM,
      pageCount,
      selectedFrameId: selectedFrameId || undefined,
    })

    if (res.error || !res.ops?.length) {
      return { ops: [], summary: res.summary || '', error: res.error }
    }

    // Apply all operations against current snapshot
    let next = [...frames]
    for (const op of res.ops!) {
      if (op.op === 'update') {
        next = next.map(f => f.id === op.frameId ? { ...f, ...op.props } : f)
      } else if (op.op === 'move') {
        next = next.map(f => {
          if (f.id !== op.frameId) return f
          return {
            ...f,
            x: Math.round(op.xMM * PX_PER_MM),
            y: Math.round(op.yMM * PX_PER_MM),
            ...(op.wMM !== undefined ? { width: Math.round(op.wMM * PX_PER_MM) } : {}),
            ...(op.hMM !== undefined ? { height: Math.round(op.hMM * PX_PER_MM) } : {}),
          }
        })
      } else if (op.op === 'delete') {
        next = next.filter(f => f.id !== op.frameId)
      } else if (op.op === 'create') {
        const page = Math.min(op.page ?? 0, pageCount - 1)
        const x = Math.round((op.xMM ?? 20) * PX_PER_MM)
        const y = Math.round((op.yMM ?? 20) * PX_PER_MM)
        const w = Math.round((op.wMM ?? 100) * PX_PER_MM)
        const h = Math.round((op.hMM ?? 40) * PX_PER_MM)
        let newFrame: AnyLayoutFrame
        if (op.type === 'image') {
          newFrame = { ...createDefaultImageFrame(page, x, y), width: w, height: h }
        } else if (op.type === 'rect' || op.type === 'ellipse' || op.type === 'line') {
          newFrame = createDefaultShapeFrame(page, x, y, op.type as any, { width: w, height: h })
          if (op.props) Object.assign(newFrame, op.props)
        } else {
          newFrame = { ...createDefaultFrame(page, x, y, { width: w, height: h }), ...(op.props || {}) }
        }
        next = [...next, newFrame]
      }
    }
    pushHistory(next, `IA: ${instruction.slice(0, 40)}`)
    setFrames(next)
    saveLayout(next)

    return { ops: res.ops, summary: res.summary || '', error: undefined }
  }, [frames, pageSize, pageCount, selectedFrameId, saveLayout, pushHistory])

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
  const applyPDFImport = useCallback(async (data: string, name: string) => {
    setImporting(true)
    try {
      const parsed = await parsePDF(data)
      const newPageSizeKey = parsed.pageSizeName
      const newPageSize = PAGE_SIZES[newPageSizeKey] || PAGE_SIZES.A4
      const ptToPx = 96 / 72

      const textFrames: LayoutFrame[] = parsed.blocks.map(block =>
        createDefaultFrame(block.pageIndex, Math.max(0, block.x * ptToPx), Math.max(0, block.y * ptToPx), {
          width: Math.min(block.width * ptToPx, mmToPx(newPageSize.widthMM) - block.x * ptToPx),
          height: Math.max(20, block.height * ptToPx + 8),
          fontSize: Math.max(8, Math.min(72, block.fontSize)),
          fontWeight: block.isBold ? 'bold' : 'normal',
          ownContent: block.text,
          paddingTop: 4, paddingRight: 6, paddingBottom: 4, paddingLeft: 6,
        })
      )

      const imageFrames: LayoutImageFrame[] = (parsed.graphicRegions ?? []).map(region => ({
        ...createDefaultImageFrame(region.pageIndex, region.x * ptToPx, region.y * ptToPx),
        width: region.width * ptToPx,
        height: region.height * ptToPx,
        src: region.dataUrl,
        fit: 'fit' as const,
      }))

      const newFrames = [...textFrames, ...imageFrames]
      const newPageCount = Math.max(pageCount, parsed.pageCount)
      setFrames(prev => {
        const next = [...prev, ...newFrames]
        pushHistory(next)
        saveLayout(next, newPageCount, newPageSizeKey)
        return next
      })
      setPageCount(newPageCount)
      setPageSizeKey(newPageSizeKey)
      const imgMsg = imageFrames.length > 0 ? `\n${imageFrames.length} gráfica(s) detectada(s)` : ''
      alert(`PDF importado: ${name}\n${textFrames.length} bloques de texto en ${parsed.pageCount} páginas.${imgMsg}`)
    } catch (err) {
      alert('Error al importar PDF: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
    }
  }, [pageCount, saveLayout, pushHistory])

  const handleImportPDF = useCallback(async () => {
    const result = await window.api.importPDF()
    if (!result) return
    await applyPDFImport(result.data, result.name)
  }, [applyPDFImport])

  // Expose PDF data import for drag-and-drop from DocSidebar
  useEffect(() => {
    (window as any).__triggerPDFImportWithData = applyPDFImport
    return () => { delete (window as any).__triggerPDFImportWithData }
  }, [applyPDFImport])

  // ── DOCX Import ───────────────────────────────────────────────────────────────
  const handleImportDOCX = useCallback(async () => {
    const result = await window.api.importDOCX()
    if (!result) return
    if (result.error) { alert('Error al importar DOCX: ' + result.error); return }
    setImporting(true)
    try {
      const blocks = parseDocxHTML(result.html)
      const ps = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.A4
      const pageW = mmToPx(ps.widthMM)
      const marginPx = 57
      const frameW = pageW - marginPx * 2
      let currentPage = pageCount - 1
      let currentY = marginPx
      const maxH = mmToPx(ps.heightMM) - marginPx * 2
      const newFrames: AnyLayoutFrame[] = []
      for (const block of blocks) {
        const h = block.isHeading ? (block.fontSize * 2.5 + 16) : Math.min(maxH, block.html.length * 0.6 + 60)
        if (currentY + h > mmToPx(ps.heightMM) - marginPx) {
          currentPage++
          currentY = marginPx
        }
        const frame = createDefaultFrame(currentPage, marginPx, currentY, {
          width: frameW,
          height: Math.min(h, maxH),
          fontSize: block.fontSize,
          fontWeight: block.fontWeight,
          fontStyle: block.fontStyle,
          textAlign: block.textAlign,
          ownContent: block.html,
          paddingTop: 4, paddingRight: 8, paddingBottom: 4, paddingLeft: 8,
        })
        newFrames.push(frame)
        currentY += frame.height + 8
      }
      const newPageCount = Math.max(pageCount, currentPage + 1)
      setFrames(prev => {
        const next = [...prev, ...newFrames]
        pushHistory(next, 'Importar DOCX')
        saveLayout(next, newPageCount)
        return next
      })
      setPageCount(newPageCount)
      alert(`DOCX importado: ${result.name}\n${newFrames.length} bloques en ${currentPage + 1} páginas.`)
    } finally {
      setImporting(false)
    }
  }, [pageCount, pageSizeKey, saveLayout, pushHistory])

  // ── PDF → Images Import ───────────────────────────────────────────────────────
  const handleImportPDFAsImages = useCallback(async () => {
    const result = await window.api.importPDF()
    if (!result) return
    setImporting(true)
    try {
      const pages = await renderPDFToImages(result.data, 1.5)
      const ps = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.A4
      const targetW = mmToPx(ps.widthMM)
      let needed = pageCount
      const newFrames: AnyLayoutFrame[] = pages.map(pg => {
        const ratio = pg.heightPx / pg.widthPx
        const w = targetW
        const h = w * ratio
        if (pg.pageIndex + 1 > needed) needed = pg.pageIndex + 1
        const frame = createDefaultImageFrame(pg.pageIndex, 0, 0)
        frame.width = w
        frame.height = h
        frame.src = pg.dataUrl
        frame.fit = 'fill'
        return frame
      })
      const newPageCount = Math.max(pageCount, needed)
      setFrames(prev => {
        const next = [...prev, ...newFrames]
        pushHistory(next, 'Importar PDF como imágenes')
        saveLayout(next, newPageCount)
        return next
      })
      setPageCount(newPageCount)
      alert(`PDF importado como imágenes: ${result.name}\n${pages.length} páginas.`)
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
    }
  }, [pageCount, pageSizeKey, saveLayout, pushHistory])

  // Expose global menu triggers — MUST be after all handlers are declared
  useEffect(() => {
    (window as any).__triggerPDFImport = handleImportPDF
    return () => { delete (window as any).__triggerPDFImport }
  }, [handleImportPDF])

  useEffect(() => {
    (window as any).__triggerPDFImportAsImages = handleImportPDFAsImages
    return () => { delete (window as any).__triggerPDFImportAsImages }
  }, [handleImportPDFAsImages])

  useEffect(() => {
    (window as any).__triggerDOCXImport = handleImportDOCX
    return () => { delete (window as any).__triggerDOCXImport }
  }, [handleImportDOCX])

  // Expose layout commands for AI chat actions
  useEffect(() => {
    (window as any).__layoutCreateTextFrame = (content: string, pageIndex = 0) => {
      const frame = createDefaultFrame(pageIndex, 60, 80)
      frame.width = 480
      frame.height = 200
      frame.ownContent = content
      setFrames(prev => {
        const next = [...prev, frame]
        pushHistory(next, 'IA: crear marco')
        saveLayout(next)
        return next
      })
      setSelectedFrameIds([frame.id])
    }
    return () => { delete (window as any).__layoutCreateTextFrame }
  }, [saveLayout, pushHistory])

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
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // TipTap uses a contenteditable div. Check target AND document.activeElement
      // because Electron sometimes reports a stale target when TipTap has focus.
      const active = document.activeElement as HTMLElement | null
      const inEditor =
        target.isContentEditable ||
        !!target.closest?.('[contenteditable="true"]') ||
        !!active?.isContentEditable ||
        !!active?.closest?.('[contenteditable="true"]')
      if (inEditor) return

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }

      // Copy/Paste/Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') { e.preventDefault(); copyFrames(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') { e.preventDefault(); pasteFrames(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicateFrames(); return }

      // Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); setSelectedFrameIds(frames.map(f => f.id)); return }

      // AI Layout (⌘K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowAILayout(v => !v); return }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFrameIds.length > 0) { e.preventDefault(); handleDeleteFrame(); return }
      }

      // Escape
      if (e.key === 'Escape') { setLinkingFrom(null); setSelectedFrameIds([]); setDrawMode('pointer'); setContextMenu(null); return }

      // Draw mode shortcuts
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-text' ? 'pointer' : 'draw-text'); return }
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-image' ? 'pointer' : 'draw-image'); return }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-rect' ? 'pointer' : 'draw-rect'); return }
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-ellipse' ? 'pointer' : 'draw-ellipse'); return }
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-line' ? 'pointer' : 'draw-line'); return }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-chart' ? 'pointer' : 'draw-chart'); return }
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey) { setDrawMode(m => m === 'draw-table' ? 'pointer' : 'draw-table'); return }
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

  // Spacebar panning — hold space + drag to pan freely
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t.isContentEditable ||
        !!t.closest?.('[contenteditable="true"]') ||
        !!(document.activeElement as HTMLElement | null)?.isContentEditable ||
        !!(document.activeElement as HTMLElement | null)?.closest?.('[contenteditable="true"]')
      ) return
      e.preventDefault()
      spaceHeld.current = true
      setPanning(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        panOrigin.current = null
        setPanning(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!spaceHeld.current || !scrollRef.current) return
    e.preventDefault()
    panOrigin.current = {
      mx: e.clientX, my: e.clientY,
      sl: scrollRef.current.scrollLeft,
      st: scrollRef.current.scrollTop,
    }
  }, [])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panOrigin.current || !scrollRef.current) return
    const dx = e.clientX - panOrigin.current.mx
    const dy = e.clientY - panOrigin.current.my
    scrollRef.current.scrollLeft = panOrigin.current.sl - dx
    scrollRef.current.scrollTop  = panOrigin.current.st - dy
  }, [])

  const handleCanvasMouseUp = useCallback(() => {
    panOrigin.current = null
  }, [])

  // Zoom with Ctrl/Cmd + scroll — keeps the point under the cursor fixed
  // Uses a native (non-passive) listener so e.preventDefault() actually works.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      e.preventDefault()

      // Capture mouse + scroll position BEFORE the state update re-renders the DOM
      const rect = el.getBoundingClientRect()
      const mouseY = e.clientY - rect.top
      const mouseX = e.clientX - rect.left
      const oldScrollTop  = el.scrollTop
      const oldScrollLeft = el.scrollLeft

      setScale(prev => {
        const newScale = Math.max(0.25, Math.min(4.0, prev - e.deltaY * 0.001))
        if (newScale === prev) return prev

        // After React re-renders with new scale, adjust scroll so the pixel under
        // the cursor stays at the same screen position.
        const ratio = newScale / prev
        requestAnimationFrame(() => {
          if (!scrollRef.current) return
          scrollRef.current.scrollTop  = (oldScrollTop  + mouseY) * ratio - mouseY
          scrollRef.current.scrollLeft = (oldScrollLeft + mouseX) * ratio - mouseX
        })

        return newScale
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, []) // setScale is stable; scrollRef.current assigned before this runs

  const selectedFrame = frames.find(f => f.id === selectedFrameId) || null

  return (
    <div className="flex flex-1 overflow-hidden" style={{ position: 'relative', background: '#3a3a3e' }}>

      {/* Tool sidebar (leftmost) */}
      <ToolSidebar drawMode={drawMode} onSetDrawMode={setDrawMode} />

      {/* Page strip (left) */}
      <PageStrip
        pageCount={pageCount}
        pageSize={pageSize}
        frames={frames}
        activePageIndex={activePageIndex}
        spreadPages={spreadPages}
        width={leftPanelWidth}
        onScrollToPage={scrollToPage}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
        onToggleSpread={(idx) => setSpreadPages(prev =>
          prev.includes(idx) ? prev.filter(p => p !== idx) : [...prev, idx].sort((a,b) => a-b)
        )}
      />

      {/* Left resize handle */}
      <div
        onMouseDown={handleLeftDragStart}
        style={{
          width: 4, cursor: 'col-resize', flexShrink: 0,
          background: 'transparent', transition: 'background 0.15s',
          zIndex: 20,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,82,43,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />

      {/* Main canvas area */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 border-b text-xs font-sans flex-wrap shrink-0"
          style={{ background: '#222226', borderColor: 'rgba(255,255,255,0.06)', zIndex: 30 }}>

          {/* Undo/Redo */}
          <button onClick={undo} className="px-2 py-1 rounded text-xs transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a0a0a8' }} title="Deshacer (⌘Z)">↩</button>
          <button onClick={redo} className="px-2 py-1 rounded text-xs transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a0a0a8' }} title="Rehacer (⌘⇧Z)">↪</button>
          <button onClick={saveCheckpoint} className="px-2 py-1 rounded text-xs transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a0a0a8' }} title="Guardar punto de control en el historial">⊙</button>

          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Snap toggle */}
          <button onClick={() => setSnapEnabled(v => !v)}
            className="px-2 py-1 rounded text-xs transition"
            style={{ background: snapEnabled ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)', color: snapEnabled ? '#4ade80' : '#6e6e78' }}
            title="Snap magnético (S)">⊞ Snap</button>

          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Page controls */}
          <select value={pageSizeKey}
            onChange={e => { setPageSizeKey(e.target.value); saveLayout(frames, pageCount, e.target.value) }}
            className="rounded px-2 py-1 text-xs outline-none"
            style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.1)', color: '#c8c8cc' }}>
            {Object.keys(PAGE_SIZES).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <span style={{ color: '#6e6e78', fontSize: 11 }}>{pageCount} pág.</span>

          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Import buttons */}
          <button onClick={handleImportPDF} disabled={importing}
            className="px-2 py-1 rounded text-xs transition disabled:opacity-40"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
            title="Importar PDF (texto)">
            {importing ? '⏳…' : '⬆ PDF'}
          </button>
          <button onClick={handleImportPDFAsImages} disabled={importing}
            className="px-2 py-1 rounded text-xs transition disabled:opacity-40"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.2)' }}
            title="Importar PDF como imágenes por página">
            ⬆ PDF img
          </button>
          <button onClick={handleImportDOCX} disabled={importing}
            className="px-2 py-1 rounded text-xs transition disabled:opacity-40"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
            title="Importar Word (.docx)">
            ⬆ DOCX
          </button>

          {/* AI Design — single frame */}
          <button
            onClick={() => setShowAIDesign(v => !v)}
            className="px-2 py-1 rounded text-xs transition"
            style={{ background: showAIDesign ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)', color: showAIDesign ? '#c4b5fd' : '#a0a0a8' }}
            title="IA Diseño — modifica el marco seleccionado (1 marco)"
          >✨ Marco</button>
          {/* AI Layout — full canvas */}
          <button
            onClick={() => setShowAILayout(v => !v)}
            className="px-2 py-1 rounded text-xs transition"
            style={{ background: showAILayout ? 'rgba(212,82,43,0.4)' : 'rgba(255,255,255,0.06)', color: showAILayout ? '#fb923c' : '#a0a0a8' }}
            title="IA Layout — modifica toda la maqueta con lenguaje natural (⌘K)"
          >✨ Layout</button>

          {/* Linking / Draw mode hints */}
          {linkingFrom && (
            <div className="px-3 py-1 rounded text-white animate-pulse text-xs" style={{ background: '#4f46e5' }}>
              Clic en marco existente · o arrastra para crear uno nuevo
              <button onClick={() => setLinkingFrom(null)} className="ml-2 underline">Esc</button>
            </div>
          )}
          {drawMode !== 'pointer' && !linkingFrom && (
            <div className="px-3 py-1 rounded text-white text-xs animate-pulse"
              style={{ background: drawMode === 'draw-text' ? '#2997ff' : drawMode === 'draw-image' ? '#7c3aed' : '#059669' }}>
              {drawMode === 'draw-text' ? 'Arrastra para crear marco de texto (T)'
                : drawMode === 'draw-image' ? 'Arrastra para crear marco de imagen (I)'
                : drawMode === 'draw-rect' ? 'Arrastra para dibujar un rectángulo (R)'
                : drawMode === 'draw-ellipse' ? 'Arrastra para dibujar una elipse (E)'
                : drawMode === 'draw-chart' ? 'Arrastra para insertar un gráfico (C)'
                : drawMode === 'draw-table' ? 'Arrastra para insertar una tabla (B)'
                : 'Arrastra para dibujar una línea (L)'}
              <button onClick={() => setDrawMode('pointer')} className="ml-2 underline">Cancelar</button>
            </div>
          )}

          {/* Alignment toolbar (multi-select) */}
          {selectedFrameIds.length >= 2 && (
            <>
              <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div className="flex gap-px rounded p-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
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
                    className="px-1.5 py-1 rounded text-xs transition"
                    style={{ color: '#a0a0a8' }}>{i}</button>
                ))}
              </div>
            </>
          )}

          <div className="flex-1" />

          <PreflightBadge report={preflightReport} />
          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Baseline grid */}
          <button onClick={() => setShowBaselineGrid(!showBaselineGrid)}
            className="px-2 py-1 rounded transition text-xs"
            style={{ background: showBaselineGrid ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', color: showBaselineGrid ? '#a5b4fc' : '#6e6e78' }}>
            ⊟ Grid
          </button>
          {showBaselineGrid && (
            <input type="number" min={8} max={40} value={baselineStep}
              onChange={e => setBaselineStep(Number(e.target.value))}
              className="w-14 text-center rounded px-1 py-0.5 text-xs outline-none"
              style={{ background: '#2c2c30', border: '1px solid rgba(255,255,255,0.1)', color: '#c8c8cc' }} />
          )}

          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Zoom */}
          <span style={{ color: '#6e6e78', fontSize: 11 }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.25, s - 0.1))} className="px-1.5 py-1 rounded text-xs transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a0a0a8' }}>−</button>
          <button onClick={() => setScale(s => Math.min(4, s + 0.1))} className="px-1.5 py-1 rounded text-xs transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#a0a0a8' }}>+</button>
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
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          style={{ paddingTop: 8, paddingBottom: 64, cursor: panning ? (panOrigin.current ? 'grabbing' : 'grab') : undefined }}
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
                onAddShapeFrame={handleAddShapeFrame}
                onAddChartFrame={handleAddChartFrame}
                onAddTableFrame={handleAddTableFrame}
                onStartLink={handleStartLink}
                onCompleteLink={handleCompleteLink}
                onLinkToNewFrame={handleLinkToNewFrame}
                onDoubleClickGuide={handleDeleteGuide}
                onContextMenu={handleContextMenu}
                onAIAction={onAIAction}
                scale={scale}
                autoEditFrameId={autoEditFrameId}
                onAutoEditDone={() => setAutoEditFrameId(null)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right resize handle */}
      <div
        onMouseDown={handleRightDragStart}
        style={{
          width: 4, cursor: 'col-resize', flexShrink: 0,
          background: 'transparent', transition: 'background 0.15s',
          zIndex: 20,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,82,43,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />

      {/* Right panel — Studio Sidebar */}
      <StudioSidebar
        width={rightPanelWidth}
        selectedFrame={selectedFrame}
        selectedFrameIds={selectedFrameIds}
        frames={frames}
        currentPageIndex={activePageIndex}
        pageCount={pageCount}
        paragraphStyles={paragraphStyles}
        onUpdateStyles={handleUpdateStyles}
        onApplyStyle={handleApplyStyle}
        onUpdateFrame={handleUpdateFrame}
        onDeleteFrame={(id) => handleDeleteFrame(id)}
        onSelectFrame={(id) => setSelectedFrameIds([id])}
        onUnlink={handleUnlink}
        onAlign={alignFrames}
        masters={masters}
        pageAssignments={pageAssignments}
        onCreateMaster={handleCreateMaster}
        onDeleteMaster={handleDeleteMaster}
        onUpdateMaster={handleUpdateMaster}
        onAssignMaster={handleAssignMaster}
        preflightReport={preflightReport}
        historyLabels={historyLabels.current}
        historyCurrentIndex={historyIndex.current}
        onJumpToHistory={handleJumpToHistory}
        onInsertImage={handleInsertGeneratedImage}
      />

      {/* AI Layout bar — full canvas natural language commands (⌘K) */}
      {showAILayout && (
        <AILayoutBar
          frameCount={frames.length}
          selectedFrameLabel={selectedFrame ? `"${((selectedFrame as any).ownContent || '').replace(/<[^>]+>/g,'').trim().slice(0,20) || selectedFrame.id}"` : undefined}
          onExecute={handleAILayout}
          onClose={() => setShowAILayout(false)}
        />
      )}

      {/* AI Design floating panel */}
      {showAIDesign && (
        <div style={{ position: 'absolute', top: 56, right: 228, zIndex: 500 }}>
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
