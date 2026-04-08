import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import type { LayoutFrame } from '../../lib/threadEngine'
import { resolveFontFamily } from '../../lib/fontUtils'

interface Props {
  frame: LayoutFrame
  threadedContent: string
  isSelected: boolean
  isLinkingFrom: boolean
  isLinkTarget: boolean
  onSelect: (addToSelection?: boolean) => void
  onUpdate: (updates: Partial<LayoutFrame>) => void
  onDelete: () => void
  onStartLink: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onAIAction?: (action: string, text: string) => void
  scale: number
}

// ─── TipTap editor mounted only when editing ─────────────────────────────────
function FrameEditor({
  frame, onSave, onClose, onAIAction,
}: {
  frame: LayoutFrame
  onSave: (html: string) => void
  onClose: () => void
  onAIAction?: (action: string, text: string) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Highlight.configure({ multicolor: false }),
    ],
    content: frame.ownContent || '',
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      onSave(editor.getHTML())
    },
  })

  // Escape closes editor
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  const getSelectedText = useCallback(() => {
    if (!editor) return ''
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, ' ')
  }, [editor])

  const btn = (onClick: () => void, active: boolean, title: string, content: React.ReactNode) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      style={{
        background: active ? 'rgba(255,255,255,0.25)' : 'transparent',
        border: 'none', color: 'white', cursor: 'pointer',
        padding: '2px 6px', borderRadius: 3, fontSize: 11,
        fontFamily: 'sans-serif', lineHeight: 1.4,
      }}
    >{content}</button>
  )

  const sep = () => (
    <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)', margin: '0 3px' }} />
  )

  if (!editor) return null

  return (
    <>
      {/* ── Formatting toolbar above frame ── */}
      <div
        style={{
          position: 'absolute', top: -36, left: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 1,
          background: '#1e293b', borderRadius: '6px 6px 0 0',
          padding: '4px 6px', boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
          userSelect: 'none', whiteSpace: 'nowrap',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), 'Título 1', 'H1')}
        {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Título 2', 'H2')}
        {btn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), 'Título 3', 'H3')}
        {sep()}
        {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Negrita', <b>B</b>)}
        {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Cursiva', <i>I</i>)}
        {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), 'Subrayado', <u>U</u>)}
        {btn(() => editor.chain().focus().toggleHighlight().run(), editor.isActive('highlight'), 'Resaltar', '▮')}
        {sep()}
        {btn(() => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }), 'Alinear izq', '⇤')}
        {btn(() => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }), 'Centrar', '⇔')}
        {btn(() => editor.chain().focus().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }), 'Alinear der', '⇥')}
        {btn(() => editor.chain().focus().setTextAlign('justify').run(), editor.isActive({ textAlign: 'justify' }), 'Justificar', '≡')}
        {sep()}
        {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Lista viñetas', '• Lista')}
        {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Lista núm.', '1.')}
        {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), 'Cita', '"')}

        {/* AI actions — only show when there's a text selection */}
        {onAIAction && <>
          {sep()}
          {btn(() => { const t = getSelectedText(); if (t.trim()) onAIAction('research', t) }, false, 'Investigar selección (IA)', '🔬')}
          {btn(() => { const t = getSelectedText(); if (t.trim()) onAIAction('suggest', t) }, false, 'Redactar alternativas (IA)', '✍️')}
          {btn(() => { const t = getSelectedText(); if (t.trim()) onAIAction('restructure', t) }, false, 'Estructurar (IA)', '🗂')}
        </>}

        {sep()}
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation(); onClose() }}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: 'white', cursor: 'pointer', padding: '2px 8px',
            borderRadius: 3, fontSize: 10, fontFamily: 'sans-serif',
          }}
        >
          ✓ Listo
        </button>
      </div>

      {/* ── TipTap editor content ── */}
      <div
        className="frame-editor"
        style={{
          position: 'absolute',
          top: frame.paddingTop ?? 8,
          left: frame.paddingLeft ?? 8,
          right: frame.paddingRight ?? 8,
          bottom: frame.paddingBottom ?? 8,
          overflow: 'auto',
          fontFamily: resolveFontFamily(frame.fontFamily),
          fontSize: frame.fontSize,
          lineHeight: frame.lineHeight,
          color: frame.textColor || '#1a1714',
          letterSpacing: frame.letterSpacing ? `${frame.letterSpacing}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </div>
    </>
  )
}

// ─── Main frame component ─────────────────────────────────────────────────────
export function LayoutTextFrameComp({
  frame, threadedContent, isSelected, isLinkingFrom, isLinkTarget,
  onSelect, onUpdate, onDelete, onStartLink, onContextMenu, onAIAction, scale,
}: Props) {
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, fw: 0, fh: 0 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const displayRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  // Render raw HTML for display (handles both old plain text and new TipTap HTML)
  const displayContent = frame.ownContent || threadedContent
  const renderedHtml = displayContent.includes('<')
    ? displayContent
    : displayContent.replace(/\n/g, '<br>')

  useEffect(() => {
    if (displayRef.current && !isEditing) {
      setIsOverflowing(displayRef.current.scrollHeight > displayRef.current.clientHeight)
    }
  }, [displayContent, frame.width, frame.height, isEditing])

  const enterEdit = useCallback((e: React.MouseEvent) => {
    if (frame.locked) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    setIsEditing(true)
  }, [frame.locked, onSelect])

  const exitEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleSaveContent = useCallback((html: string) => {
    onUpdate({ ownContent: html })
  }, [onUpdate])

  // Drag
  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.preventDefault(); e.stopPropagation()
    onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
  }, [frame.x, frame.y, onSelect, isEditing])

  // Resize
  const onMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setResizing(true)
    resizeStart.current = { mx: e.clientX, my: e.clientY, fw: frame.width, fh: frame.height }
  }, [frame.width, frame.height])

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
        onUpdate({ width: Math.max(80, resizeStart.current.fw + dx), height: Math.max(60, resizeStart.current.fh + dy) })
      }
    }
    const up = () => { setDragging(false); setResizing(false) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, resizing, scale, onUpdate])

  const borderColor = isLinkingFrom ? '#6366f1' : isLinkTarget ? '#10b981' : isEditing ? '#2563eb' : isSelected ? '#e3703f' : '#cbd5e1'
  const ff = resolveFontFamily(frame.fontFamily)

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    top: frame.paddingTop ?? 8, left: frame.paddingLeft ?? 8,
    right: frame.paddingRight ?? 8, bottom: frame.paddingBottom ?? 8,
    fontSize: frame.fontSize, lineHeight: frame.lineHeight,
    fontFamily: ff, fontWeight: frame.fontWeight || 'normal',
    fontStyle: frame.fontStyle || 'normal',
    color: frame.textColor || '#1a1714',
    textAlign: frame.textAlign || 'left',
    letterSpacing: frame.letterSpacing ? `${frame.letterSpacing}px` : undefined,
    columnCount: frame.columns > 1 ? frame.columns : undefined,
    columnGap: frame.columns > 1 ? frame.columnGutter : undefined,
    overflow: 'hidden', userSelect: 'none',
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x, top: frame.y,
        width: frame.width, height: frame.height,
        border: isEditing
          ? '1.5px solid #2563eb'
          : (frame.borderWidth || 0) > 0
            ? `${frame.borderWidth}px ${frame.borderStyle || 'solid'} ${frame.borderColor || 'transparent'}`
            : `1.5px solid ${borderColor}`,
        boxSizing: 'border-box',
        cursor: frame.locked ? 'default' : isEditing ? 'text' : dragging ? 'grabbing' : 'grab',
        zIndex: isEditing ? 30 : isSelected ? 20 : (frame.zIndex || 10),
        background: isEditing ? 'rgba(255,255,255,0.98)' : (frame.backgroundColor || 'transparent'),
        boxShadow: isEditing ? '0 4px 24px rgba(0,0,0,0.18)' : undefined,
        borderRadius: frame.cornerRadius || 0,
        opacity: frame.opacity !== undefined ? frame.opacity : 1,
      }}
      onClick={(e) => { e.stopPropagation(); if (!isEditing) onSelect(e.shiftKey || e.metaKey) }}
      onDoubleClick={enterEdit}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu?.(e) }}
    >
      {/* ── Display mode ── */}
      {!isEditing && (
        <div
          ref={displayRef}
          style={textStyle}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}

      {/* ── Edit mode — TipTap ── */}
      {isEditing && (
        <FrameEditor
          frame={frame}
          onSave={handleSaveContent}
          onClose={exitEdit}
          onAIAction={onAIAction}
        />
      )}

      {/* ── Overflow indicator ── */}
      {!isEditing && isOverflowing && !frame.threadNextId && (
        <div style={{ position: 'absolute', bottom: -1, right: -1, background: '#ef4444', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '2px 0 0 0' }} title="Texto desbordado">
          ⊠ overflow
        </div>
      )}

      {/* ── Thread indicators ── */}
      {frame.threadNextId && (
        <div style={{ position: 'absolute', bottom: -1, right: -1, background: '#6366f1', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '2px 0 0 0' }}>→ cont.</div>
      )}
      {frame.threadPrevId && (
        <div style={{ position: 'absolute', top: -1, left: -1, background: '#6366f1', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '0 0 2px 0' }}>← cont.</div>
      )}

      {/* ── Selected controls ── */}
      {isSelected && !isEditing && (
        <>
          <div
            onMouseDown={onMouseDownDrag}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 20,
              cursor: 'grab', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4,
              background: 'rgba(227, 112, 63, 0.08)',
            }}
          >
            <span style={{ fontSize: 9, fontFamily: 'sans-serif', color: '#e3703f', userSelect: 'none' }}>
              ⠿ {Math.round(frame.width)}×{Math.round(frame.height)}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onStartLink() }}
                style={{ fontSize: 9, background: '#6366f1', color: 'white', border: 'none', borderRadius: 2, padding: '1px 4px', cursor: 'pointer', fontFamily: 'sans-serif' }}
                title="Vincular flujo de texto"
              >⛓ Vincular</button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                style={{ fontSize: 9, background: '#ef4444', color: 'white', border: 'none', borderRadius: 2, padding: '1px 4px', cursor: 'pointer', fontFamily: 'sans-serif' }}
              >✕</button>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onMouseDownResize}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 12, height: 12, background: '#e3703f', cursor: 'se-resize', borderRadius: 2 }}
          />

          {/* Column controls */}
          <div style={{ position: 'absolute', top: 22, right: -70, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onUpdate({ columns: Math.max(1, frame.columns - 1) }) }} style={colBtnStyle} title="Quitar columna">-col</button>
            <span style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', fontFamily: 'sans-serif' }}>{frame.columns}col</span>
            <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onUpdate({ columns: Math.min(4, frame.columns + 1) }) }} style={colBtnStyle} title="Agregar columna">+col</button>
          </div>
        </>
      )}

      {frame.locked && (
        <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 10, opacity: 0.4 }}>🔒</div>
      )}
    </div>
  )
}

const colBtnStyle: React.CSSProperties = {
  fontSize: 8, background: '#f1f5f9', color: '#64748b',
  border: '1px solid #e2e8f0', borderRadius: 2, padding: '1px 4px',
  cursor: 'pointer', fontFamily: 'sans-serif',
}
