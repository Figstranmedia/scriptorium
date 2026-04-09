import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import { Extension } from '@tiptap/core'
import type { LayoutFrame } from '../../lib/threadEngine'
import { resolveFontFamily } from '../../lib/fontUtils'

// ─── Custom FontSize extension ────────────────────────────────────────────────
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize?.replace('px', '') || null,
          renderHTML: (attrs: Record<string, unknown>) => {
            if (!attrs.fontSize) return {}
            return { style: `font-size: ${attrs.fontSize}px` }
          }
        }
      }
    }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  }
})

const COMMON_FONTS = [
  'serif', 'sans-serif', 'monospace',
  'Georgia', 'Garamond', 'Palatino', 'Times New Roman', 'Baskerville',
  'Helvetica', 'Arial', 'Futura', 'Gill Sans', 'Optima', 'Verdana',
  'Trebuchet MS', 'Tahoma', 'Franklin Gothic Medium',
  'Courier New', 'Courier', 'Consolas', 'Menlo',
]

const FONT_SIZES = [6,7,8,9,10,11,12,13,14,15,16,18,20,22,24,26,28,32,36,42,48,60,72,96]

interface FrameEditorProps {
  frame: LayoutFrame
  onSave: (html: string) => void
  onClose: () => void
  onAIAction?: (action: string, text: string) => void
}

// ─── Affinity-style text toolbar ─────────────────────────────────────────────
function FrameEditor({ frame, onSave, onClose, onAIAction }: FrameEditorProps) {
  const [fontInput, setFontInput] = useState(frame.fontFamily || 'serif')
  const [sizeInput, setSizeInput] = useState(String(frame.fontSize || 12))
  const [showFontList, setShowFontList] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [currentColor, setCurrentColor] = useState(frame.textColor || '#1a1714')
  const fontListRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
    ],
    content: frame.ownContent || '',
    autofocus: 'end',
    onUpdate: ({ editor: ed }) => {
      onSave(ed.getHTML())
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const attrs = ed.getAttributes('textStyle') as Record<string, string>
      if (attrs.fontFamily) setFontInput(attrs.fontFamily)
      if (attrs.fontSize) setSizeInput(attrs.fontSize)
      if (attrs.color) setCurrentColor(attrs.color)
    },
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  const applyFont = useCallback((font: string) => {
    setFontInput(font)
    setShowFontList(false)
    editor?.chain().focus().setFontFamily(font).run()
  }, [editor])

  const applySize = useCallback((size: string) => {
    const n = parseFloat(size)
    if (!n || n < 1 || n > 999) return
    setSizeInput(size)
    editor?.chain().focus().setFontSize(size).run()
  }, [editor])

  const applyColor = useCallback((color: string) => {
    setCurrentColor(color)
    editor?.chain().focus().setColor(color).run()
  }, [editor])

  const getSelectedText = useCallback(() => {
    if (!editor) return ''
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, ' ')
  }, [editor])

  if (!editor) return null

  const isBold      = editor.isActive('bold')
  const isItalic    = editor.isActive('italic')
  const isUnderline = editor.isActive('underline')
  const isStrike    = editor.isActive('strike')
  const isAlignL    = editor.isActive({ textAlign: 'left' })
  const isAlignC    = editor.isActive({ textAlign: 'center' })
  const isAlignR    = editor.isActive({ textAlign: 'right' })
  const isAlignJ    = editor.isActive({ textAlign: 'justify' })
  const isBullet    = editor.isActive('bulletList')
  const isOrdered   = editor.isActive('orderedList')

  // Toolbar styles
  const tb: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 1,
    background: '#1e1f21',
    borderRadius: '5px 5px 0 0',
    padding: '3px 6px',
    boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
    userSelect: 'none', whiteSpace: 'nowrap',
    border: '1px solid rgba(255,255,255,0.08)',
    borderBottom: 'none',
    position: 'absolute', top: -35, left: 0, zIndex: 100,
    minWidth: 480,
  }

  const btnBase: React.CSSProperties = {
    border: 'none', cursor: 'pointer', borderRadius: 3,
    fontSize: 11, fontFamily: 'system-ui, sans-serif',
    lineHeight: 1, padding: '3px 6px', transition: 'background 0.1s',
  }
  const btnOff: React.CSSProperties = { ...btnBase, background: 'transparent', color: '#b8b8bc' }
  const btnOn:  React.CSSProperties = { ...btnBase, background: 'rgba(255,255,255,0.18)', color: '#ffffff' }
  const sep = () => <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />

  const B = (onClick: () => void, active: boolean, title: string, content: React.ReactNode) => (
    <button
      key={title}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      style={active ? btnOn : btnOff}
    >{content}</button>
  )

  return (
    <>
      {/* ── Affinity-style toolbar ── */}
      <div
        style={tb}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {/* Font family */}
        <div style={{ position: 'relative' }} ref={fontListRef}>
          <input
            value={fontInput}
            onChange={e => setFontInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyFont(fontInput) }}
            onFocus={() => setShowFontList(true)}
            onBlur={() => setTimeout(() => setShowFontList(false), 150)}
            style={{
              width: 128, height: 22, padding: '0 6px',
              background: '#2a2b2d', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e0e0e4', borderRadius: 3, fontSize: 11,
              fontFamily: resolveFontFamily(fontInput),
              outline: 'none',
            }}
            title="Fuente (Enter para aplicar)"
          />
          {showFontList && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 200,
              background: '#2a2b2d', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '0 0 4px 4px', maxHeight: 200, overflowY: 'auto',
              width: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {COMMON_FONTS.filter(f => f.toLowerCase().includes(fontInput.toLowerCase())).map(f => (
                <div
                  key={f}
                  onMouseDown={() => applyFont(f)}
                  style={{
                    padding: '4px 8px', cursor: 'pointer', fontSize: 11,
                    color: '#d0d0d4', fontFamily: resolveFontFamily(f),
                    background: fontInput === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = fontInput === f ? 'rgba(255,255,255,0.1)' : 'transparent')}
                >{f}</div>
              ))}
            </div>
          )}
        </div>

        {sep()}

        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => applySize(String(Math.max(1, parseFloat(sizeInput) - 1)))}
            style={{ ...btnOff, padding: '3px 5px', fontSize: 10 }}
            title="Reducir tamaño">A<sup style={{ fontSize: 7 }}>−</sup></button>
          <select
            value={FONT_SIZES.includes(parseInt(sizeInput)) ? sizeInput : ''}
            onChange={e => applySize(e.target.value)}
            style={{
              width: 46, height: 22, padding: '0 2px',
              background: '#2a2b2d', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e0e0e4', borderRadius: 3, fontSize: 11,
              outline: 'none',
            }}
            title="Tamaño de texto"
          >
            <option value={sizeInput}>{sizeInput}</option>
            {FONT_SIZES.filter(s => String(s) !== sizeInput).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => applySize(String(parseFloat(sizeInput) + 1))}
            style={{ ...btnOff, padding: '3px 5px', fontSize: 10 }}
            title="Aumentar tamaño">A<sup style={{ fontSize: 7 }}>+</sup></button>
        </div>

        {sep()}

        {/* Weight/Style */}
        {B(() => editor.chain().focus().toggleBold().run(),     isBold,      'Negrita (⌘B)',   <b style={{ fontFamily: 'system-ui' }}>B</b>)}
        {B(() => editor.chain().focus().toggleItalic().run(),   isItalic,    'Cursiva (⌘I)',   <i style={{ fontFamily: 'Georgia' }}>I</i>)}
        {B(() => editor.chain().focus().toggleUnderline().run(),isUnderline, 'Subrayado (⌘U)', <u>U</u>)}
        {B(() => editor.chain().focus().toggleStrike().run(),   isStrike,    'Tachado',        <s>S</s>)}

        {sep()}

        {/* Text color */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={e => { e.stopPropagation(); setShowColorPicker(v => !v) }}
            title="Color de texto"
            style={{ ...btnOff, padding: '2px 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
          >
            <span style={{ fontSize: 11, lineHeight: 1 }}>A</span>
            <span style={{ width: 16, height: 3, background: currentColor, borderRadius: 1, display: 'block' }} />
          </button>
          {showColorPicker && (
            <div
              style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 300,
                background: '#2a2b2d', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              <ColorSwatches current={currentColor} onChange={color => { applyColor(color); setShowColorPicker(false) }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <input
                  type="color"
                  value={currentColor}
                  onChange={e => applyColor(e.target.value)}
                  style={{ width: 28, height: 22, padding: 1, border: 'none', background: 'none', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={currentColor}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) applyColor(e.target.value) }}
                  style={{
                    width: 70, height: 22, background: '#1e1f21', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e0e0e4', borderRadius: 3, fontSize: 10, padding: '0 6px', outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {sep()}

        {/* Alignment */}
        {B(() => editor.chain().focus().setTextAlign('left').run(),    isAlignL, 'Alinear izquierda', '⇤')}
        {B(() => editor.chain().focus().setTextAlign('center').run(),  isAlignC, 'Centrar',           '⇔')}
        {B(() => editor.chain().focus().setTextAlign('right').run(),   isAlignR, 'Alinear derecha',   '⇥')}
        {B(() => editor.chain().focus().setTextAlign('justify').run(), isAlignJ, 'Justificar',        '≡')}

        {sep()}

        {/* Lists */}
        {B(() => editor.chain().focus().toggleBulletList().run(),  isBullet,  'Lista con viñetas', '• ')}
        {B(() => editor.chain().focus().toggleOrderedList().run(), isOrdered, 'Lista numerada',    '1.')}
        {B(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), 'Cita', '"')}

        {/* AI actions */}
        {onAIAction && <>
          {sep()}
          {B(() => { const t = getSelectedText(); if (t.trim()) onAIAction('research', t) },    false, 'Investigar (IA)', '🔬')}
          {B(() => { const t = getSelectedText(); if (t.trim()) onAIAction('suggest', t) },     false, 'Redactar (IA)',   '✍️')}
          {B(() => { const t = getSelectedText(); if (t.trim()) onAIAction('restructure', t) }, false, 'Estructurar (IA)','🗂')}
        </>}

        <div style={{ flex: 1 }} />

        {/* Done */}
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); onClose() }}
          style={{ ...btnOff, background: 'rgba(41,151,255,0.25)', color: '#60a5fa', padding: '3px 10px', fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}
          title="Salir de edición (Esc)"
        >✓ Listo</button>
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
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </div>
    </>
  )
}

// ─── Color swatches palette ───────────────────────────────────────────────────
function ColorSwatches({ current, onChange }: { current: string; onChange: (c: string) => void }) {
  const swatches = [
    '#1a1714','#2a2520','#3e3630','#5c5043','#7d6e5a','#9a8c76','#c8bfad','#ffffff',
    '#1e3a5f','#1d4ed8','#2997ff','#60a5fa','#7c3aed','#a855f7','#ec4899','#f43f5e',
    '#b91c1c','#dc2626','#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
    '#14b8a6','#06b6d4','#0ea5e9','#64748b','#94a3b8','#cbd5e1',
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 20px)', gap: 3 }}>
      {swatches.map(c => (
        <button
          key={c}
          onMouseDown={() => onChange(c)}
          style={{
            width: 20, height: 20, borderRadius: 3, cursor: 'pointer',
            background: c, border: current === c ? '2px solid white' : '1px solid rgba(255,255,255,0.15)',
            padding: 0,
          }}
          title={c}
        />
      ))}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
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
    e.preventDefault(); e.stopPropagation()
    onSelect()
    setIsEditing(true)
  }, [frame.locked, onSelect])

  const exitEdit = useCallback(() => setIsEditing(false), [])

  const handleSaveContent = useCallback((html: string) => {
    onUpdate({ ownContent: html })
  }, [onUpdate])

  const onMouseDownDrag = useCallback((e: React.MouseEvent) => {
    if (isEditing) return
    e.preventDefault(); e.stopPropagation()
    onSelect()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
  }, [frame.x, frame.y, onSelect, isEditing])

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

  const borderColor = isLinkingFrom ? '#6366f1' : isLinkTarget ? '#10b981'
    : isEditing ? '#2997ff' : isSelected ? '#2997ff' : 'rgba(148,163,184,0.4)'
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
          ? '1.5px solid #2997ff'
          : (frame.borderWidth || 0) > 0
            ? `${frame.borderWidth}px ${frame.borderStyle || 'solid'} ${frame.borderColor || 'transparent'}`
            : `1px solid ${borderColor}`,
        boxSizing: 'border-box',
        cursor: frame.locked ? 'default' : isEditing ? 'text' : dragging ? 'grabbing' : 'grab',
        zIndex: isEditing ? 30 : isSelected ? 20 : (frame.zIndex || 10),
        background: isEditing ? 'rgba(255,255,255,0.98)' : (frame.backgroundColor || 'transparent'),
        boxShadow: isEditing ? '0 4px 24px rgba(0,0,0,0.22)' : undefined,
        borderRadius: frame.cornerRadius || 0,
        opacity: frame.opacity !== undefined ? frame.opacity : 1,
      }}
      onClick={e => { e.stopPropagation(); if (!isEditing) onSelect(e.shiftKey || e.metaKey) }}
      onDoubleClick={enterEdit}
      onContextMenu={e => { e.stopPropagation(); onContextMenu?.(e) }}
    >
      {/* Display mode */}
      {!isEditing && (
        <div ref={displayRef} style={textStyle} dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      )}

      {/* Edit mode — TipTap */}
      {isEditing && (
        <FrameEditor frame={frame} onSave={handleSaveContent} onClose={exitEdit} onAIAction={onAIAction} />
      )}

      {/* Overflow */}
      {!isEditing && isOverflowing && !frame.threadNextId && (
        <div style={{ position: 'absolute', bottom: -1, right: -1, background: '#ef4444', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '2px 0 0 0' }} title="Texto desbordado">⊠ overflow</div>
      )}

      {/* Thread indicators */}
      {frame.threadNextId && (
        <div style={{ position: 'absolute', bottom: -1, right: -1, background: '#6366f1', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '2px 0 0 0' }}>→ cont.</div>
      )}
      {frame.threadPrevId && (
        <div style={{ position: 'absolute', top: -1, left: -1, background: '#6366f1', color: 'white', fontSize: 9, padding: '1px 4px', fontFamily: 'sans-serif', borderRadius: '0 0 2px 0' }}>← cont.</div>
      )}

      {/* Selected controls */}
      {isSelected && !isEditing && (
        <>
          <div
            onMouseDown={onMouseDownDrag}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 20,
              cursor: 'grab', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4,
              background: 'rgba(41,151,255,0.08)',
            }}
          >
            <span style={{ fontSize: 9, fontFamily: 'system-ui', color: '#2997ff', userSelect: 'none' }}>
              ⠿ {Math.round(frame.width)}×{Math.round(frame.height)}
            </span>
            <div style={{ display: 'flex', gap: 3 }}>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onStartLink() }}
                style={{ fontSize: 9, background: '#3b3fe8', color: 'white', border: 'none', borderRadius: 2, padding: '1px 4px', cursor: 'pointer', fontFamily: 'system-ui' }}
                title="Vincular flujo de texto"
              >⛓</button>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onDelete() }}
                style={{ fontSize: 9, background: '#ef4444', color: 'white', border: 'none', borderRadius: 2, padding: '1px 4px', cursor: 'pointer', fontFamily: 'system-ui' }}
              >✕</button>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={onMouseDownResize}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 10, height: 10, background: '#2997ff', cursor: 'se-resize', borderRadius: 2 }}
          />

          {/* Column controls */}
          <div style={{ position: 'absolute', top: 22, right: -70, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onUpdate({ columns: Math.max(1, frame.columns - 1) }) }} style={colBtnStyle} title="Quitar columna">-col</button>
            <span style={{ fontSize: 8, color: '#94a3b8', textAlign: 'center', fontFamily: 'system-ui' }}>{frame.columns}col</span>
            <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onUpdate({ columns: Math.min(4, frame.columns + 1) }) }} style={colBtnStyle} title="Agregar columna">+col</button>
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
  fontSize: 8, background: 'rgba(241,245,249,0.9)', color: '#64748b',
  border: '1px solid #e2e8f0', borderRadius: 2, padding: '1px 4px',
  cursor: 'pointer', fontFamily: 'system-ui',
}
