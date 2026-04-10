/**
 * BLOQUE TABLE — LayoutTableFrame component.
 * Renders a table frame on the layout canvas.
 * Double-click a cell to edit it inline.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { LayoutTableFrame } from '../../lib/threadEngine'

interface Props {
  frame: LayoutTableFrame
  isSelected: boolean
  scale: number
  onSelect: (e: React.MouseEvent) => void
  onUpdate: (updates: Partial<LayoutTableFrame>) => void
  onContextMenu: (e: React.MouseEvent) => void
}

interface DragState {
  type: 'move' | 'resize'
  handle?: string
  startX: number; startY: number
  origX: number; origY: number
  origW: number; origH: number
}

const HANDLE_SIZE = 8

export function LayoutTableFrameComp({
  frame, isSelected, scale, onSelect, onUpdate, onContextMenu,
}: Props) {
  const [editCell, setEditCell] = useState<{ r: number; c: number } | null>(null)
  const [editText, setEditText] = useState('')
  const dragRef = useRef<DragState | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input when entering edit mode
  useEffect(() => {
    if (editCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editCell])

  // ── Drag to move ───────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (frame.locked) return
    e.stopPropagation()
    onSelect(e)
    dragRef.current = {
      type: 'move',
      startX: e.clientX, startY: e.clientY,
      origX: frame.x, origY: frame.y,
      origW: frame.width, origH: frame.height,
    }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current || dragRef.current.type !== 'move') return
      const dx = (ev.clientX - dragRef.current.startX) / scale
      const dy = (ev.clientY - dragRef.current.startY) / scale
      onUpdate({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy } as any)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [frame, scale, onSelect, onUpdate])

  // ── Resize handles ─────────────────────────────────────────────────────────
  const handleResizeDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.stopPropagation()
    dragRef.current = {
      type: 'resize', handle,
      startX: e.clientX, startY: e.clientY,
      origX: frame.x, origY: frame.y,
      origW: frame.width, origH: frame.height,
    }
    const onMove = (ev: MouseEvent) => {
      const ds = dragRef.current
      if (!ds || ds.type !== 'resize') return
      const dx = (ev.clientX - ds.startX) / scale
      const dy = (ev.clientY - ds.startY) / scale
      let { origX: x, origY: y, origW: w, origH: h } = ds
      if (ds.handle!.includes('e')) w = Math.max(60, w + dx)
      if (ds.handle!.includes('s')) h = Math.max(40, h + dy)
      if (ds.handle!.includes('w')) { x += dx; w = Math.max(60, w - dx) }
      if (ds.handle!.includes('n')) { y += dy; h = Math.max(40, h - dy) }
      onUpdate({ x, y, width: w, height: h } as any)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [frame, scale, onUpdate])

  // ── Cell edit ──────────────────────────────────────────────────────────────
  const startEdit = useCallback((r: number, c: number) => {
    setEditCell({ r, c })
    setEditText(frame.cells[r]?.[c]?.text || '')
  }, [frame.cells])

  const commitEdit = useCallback(() => {
    if (!editCell) return
    const { r, c } = editCell
    const newCells = frame.cells.map(row => row.map(cell => ({ ...cell })))
    if (newCells[r]?.[c] !== undefined) newCells[r][c].text = editText
    onUpdate({ cells: newCells } as any)
    setEditCell(null)
  }, [editCell, editText, frame.cells, onUpdate])

  const colW = frame.width / frame.cols
  const rowH = frame.height / frame.rows

  const fontFamily =
    frame.fontFamily === 'serif' ? 'Georgia, serif'
    : frame.fontFamily === 'mono' ? '"Courier New", monospace'
    : 'system-ui, Figtree, sans-serif'

  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x, top: frame.y,
        width: frame.width, height: frame.height,
        opacity: frame.opacity,
        zIndex: frame.zIndex,
        outline: isSelected ? '2px solid #6366f1' : '1px solid transparent',
        cursor: frame.locked ? 'default' : 'move',
        userSelect: 'none',
        overflow: 'hidden',
        borderRadius: 2,
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
    >
      {/* Table */}
      <table style={{
        width: '100%', height: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: frame.fontSize,
        fontFamily,
        color: frame.textColor,
      }}>
        <tbody>
          {Array.from({ length: frame.rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: frame.cols }, (_, c) => {
                const cell = frame.cells[r]?.[c] || { text: '' }
                const isHeader = frame.headerRow && r === 0
                const isEven = !isHeader && r % 2 === 0
                const isEditing = editCell?.r === r && editCell?.c === c

                return (
                  <td
                    key={c}
                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(r, c) }}
                    style={{
                      width: colW, height: rowH,
                      padding: frame.cellPadding,
                      border: `${frame.borderWidth}px solid ${frame.borderColor}`,
                      background: cell.bg || (isHeader ? frame.headerBg : isEven ? frame.evenRowBg : 'transparent'),
                      fontWeight: cell.bold || isHeader ? 'bold' : 'normal',
                      fontStyle: cell.italic ? 'italic' : 'normal',
                      textAlign: cell.align || 'left',
                      color: cell.textColor || frame.textColor,
                      verticalAlign: 'middle',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      cursor: 'default',
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commitEdit() }
                          if (e.key === 'Tab') {
                            e.preventDefault()
                            commitEdit()
                            // Move to next cell
                            const nc = c + 1 < frame.cols ? c + 1 : 0
                            const nr = nc === 0 ? (r + 1) % frame.rows : r
                            setTimeout(() => startEdit(nr, nc), 0)
                          }
                        }}
                        style={{
                          position: 'absolute', inset: 0,
                          padding: frame.cellPadding,
                          border: '2px solid #6366f1',
                          background: 'rgba(99,102,241,0.08)',
                          fontSize: frame.fontSize,
                          fontFamily,
                          fontWeight: cell.bold || isHeader ? 'bold' : 'normal',
                          color: frame.textColor,
                          outline: 'none',
                          width: '100%', height: '100%',
                          boxSizing: 'border-box',
                        }}
                      />
                    ) : (
                      cell.text || (isHeader ? `Col ${c + 1}` : '')
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Resize handles */}
      {isSelected && !frame.locked && (
        <>
          {[
            { h: 'se', s: { bottom: -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: 'se-resize' } },
            { h: 'sw', s: { bottom: -HANDLE_SIZE/2, left:  -HANDLE_SIZE/2, cursor: 'sw-resize' } },
            { h: 'ne', s: { top:    -HANDLE_SIZE/2, right: -HANDLE_SIZE/2, cursor: 'ne-resize' } },
            { h: 'nw', s: { top:    -HANDLE_SIZE/2, left:  -HANDLE_SIZE/2, cursor: 'nw-resize' } },
            { h: 'e',  s: { top: '50%', right: -HANDLE_SIZE/2, transform: 'translateY(-50%)', cursor: 'e-resize' } },
            { h: 'w',  s: { top: '50%', left:  -HANDLE_SIZE/2, transform: 'translateY(-50%)', cursor: 'w-resize' } },
            { h: 's',  s: { left: '50%', bottom: -HANDLE_SIZE/2, transform: 'translateX(-50%)', cursor: 's-resize' } },
            { h: 'n',  s: { left: '50%', top:    -HANDLE_SIZE/2, transform: 'translateX(-50%)', cursor: 'n-resize' } },
          ].map(({ h, s }) => (
            <div
              key={h}
              onMouseDown={e => { e.stopPropagation(); handleResizeDown(e, h) }}
              style={{
                position: 'absolute',
                width: HANDLE_SIZE, height: HANDLE_SIZE,
                background: '#fff',
                border: '1.5px solid #6366f1',
                borderRadius: 2,
                zIndex: 999,
                ...s as any,
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}
