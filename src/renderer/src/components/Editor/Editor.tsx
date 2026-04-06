import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CharacterCount from '@tiptap/extension-character-count'
import Image from '@tiptap/extension-image'
import type { Document, LayoutStyle } from '../../store/useStore'
import { Toolbar } from './Toolbar'
import { TextFrame, type TextFrameData } from './TextFrame'
import { extractTOC, formatTOCAsHTML } from '../../lib/citations'
import { LayoutCanvas } from '../Layout/LayoutCanvas'

interface Props {
  document: Document
  store: any
  onAIAction: (action: string, text: string) => void
  onSave: (id: string, data: object) => void
  onInsertText?: (text: string) => void
}

const LAYOUT_LABELS: Record<LayoutStyle, string> = {
  default: 'Estándar',
  book: 'Libro',
  thesis: 'Tesis',
  paper: 'Paper',
}

export function Editor({ document, store, onAIAction, onSave, onInsertText }: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const editorAreaRef = useRef<HTMLDivElement>(null)
  const [frames, setFrames] = useState<TextFrameData[]>(document.frames || [])
  const [mode, setMode] = useState<'write' | 'layout'>('write')
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Empieza a escribir tu documento...' }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Link.configure({ openOnClick: false }),
      Typography,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CharacterCount,
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: document.content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      store.updateDocument(document.id, { content: html })
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        onSave(document.id, { ...document, content: html, frames, updatedAt: Date.now() })
      }, 1500)
    },
  })

  // Persist frames
  useEffect(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onSave(document.id, { ...document, frames, updatedAt: Date.now() })
    }, 800)
  }, [frames])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  // Image click handler for inline controls
  useEffect(() => {
    if (!editorAreaRef.current) return
    const handleImgClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement
        setSelectedImage(img)
        setImageSize({ width: img.width, height: img.height })
      } else {
        setSelectedImage(null)
      }
    }
    const area = editorAreaRef.current
    area.addEventListener('click', handleImgClick)
    return () => area.removeEventListener('click', handleImgClick)
  }, [])

  const getSelectedText = useCallback(() => {
    if (!editor) return ''
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, ' ')
  }, [editor])

  const handleAIAction = useCallback((action: string) => {
    const text = getSelectedText()
    if (text.trim()) onAIAction(action, text)
  }, [getSelectedText, onAIAction])

  const handleReplaceWithAI = useCallback(async (instruction: string) => {
    const text = getSelectedText()
    if (!text.trim()) return
    const docText = document.content.replace(/<[^>]+>/g, ' ').slice(0, 600)
    store.setAIResult({ type: 'replace', loading: true, content: '', error: '' })
    store.setSidebarOpen(true)
    store.setSidebarTab('replace')
    const res = await window.api.aiReplace(text, instruction, docText)
    if (res.result && editor) editor.chain().focus().insertContent(res.result).run()
    store.setAIResult({ type: 'replace', loading: false, content: res.result || '', error: res.error || '' })
  }, [getSelectedText, editor, document, store])

  // Expose insert method for citations/TOC
  useEffect(() => {
    if (onInsertText) {
      // Store the editor ref so parent can call insert
      (window as any).__editorInsert = (html: string) => {
        editor?.chain().focus().insertContent(html).run()
      }
    }
    return () => { delete (window as any).__editorInsert }
  }, [editor, onInsertText])

  const handleInsertTOC = useCallback(() => {
    if (!editor) return
    const entries = extractTOC(document.content)
    const tocHTML = formatTOCAsHTML(entries)
    editor.chain().focus().insertContentAt(0, tocHTML).run()
  }, [editor, document.content])

  const addTextFrame = useCallback(() => {
    const scrollTop = editorAreaRef.current?.scrollTop || 0
    const newFrame: TextFrameData = {
      id: `frame_${Date.now()}`,
      x: 40,
      y: scrollTop + 60,
      width: 260,
      height: 140,
      content: '',
      style: 'default',
    }
    setFrames(prev => [...prev, newFrame])
  }, [])

  const updateFrame = useCallback((id: string, updates: Partial<TextFrameData>) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  const deleteFrame = useCallback((id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id))
  }, [])

  // Apply image resize
  const applyImageSize = (w: number) => {
    if (!selectedImage) return
    const ratio = selectedImage.naturalHeight / selectedImage.naturalWidth
    selectedImage.style.width = `${w}px`
    selectedImage.style.height = `${Math.round(w * ratio)}px`
    setImageSize({ width: w, height: Math.round(w * ratio) })
  }

  const wordCount = editor ? editor.storage.characterCount?.words() ?? 0 : 0
  const charCount = editor ? editor.storage.characterCount?.characters() ?? 0 : 0

  return (
    <div className={`flex flex-col flex-1 overflow-hidden layout-${document.layout}`}>
      <Toolbar
        editor={editor}
        document={document}
        store={store}
        onSave={() => onSave(document.id, { ...document, content: editor?.getHTML() || '', frames })}
        onAddTextFrame={addTextFrame}
        onInsertTOC={handleInsertTOC}
        onExport={() => store.setShowExport(true)}
        mode={mode}
        onToggleMode={() => setMode(m => m === 'write' ? 'layout' : 'write')}
      />

      {mode === 'layout' && (
        <LayoutCanvas document={document} onSave={onSave} />
      )}

      {/* Editor scroll area */}
      <div ref={editorAreaRef} className={`flex-1 overflow-y-auto bg-white relative ${mode === 'layout' ? 'hidden' : ''}`}>
        <div className="min-h-full relative">
          {/* Title */}
          <div className={`px-16 pt-12 pb-2 max-w-4xl mx-auto ${document.layout === 'book' ? 'max-w-2xl' : ''}`}>
            <input
              className="w-full text-3xl font-serif font-bold text-ink-800 bg-transparent outline-none border-none placeholder-ink-300"
              value={document.title}
              placeholder="Título del documento"
              onChange={(e) => {
                store.updateDocument(document.id, { title: e.target.value })
                clearTimeout(saveTimer.current)
                saveTimer.current = setTimeout(() => {
                  onSave(document.id, { ...document, title: e.target.value, frames })
                }, 1000)
              }}
            />
          </div>

          <EditorContent editor={editor} className="min-h-screen" />

          {/* Floating text frames */}
          {frames.map(frame => (
            <TextFrame
              key={frame.id}
              frame={frame}
              onUpdate={updateFrame}
              onDelete={deleteFrame}
              containerRef={editorAreaRef as React.RefObject<HTMLDivElement>}
            />
          ))}
        </div>

        {/* AI Bubble Menu */}
        {editor && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 150, placement: 'top' }}
            shouldShow={({ state }) => {
              const { from, to } = state.selection
              return from !== to
            }}
          >
            <div className="flex items-center gap-1 bg-ink-800 rounded-lg shadow-xl border border-ink-700 px-2 py-1.5 text-xs font-sans">
              <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-1.5 py-0.5 rounded font-bold transition ${editor.isActive('bold') ? 'bg-ink-600 text-white' : 'text-ink-300 hover:text-white'}`}>B</button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-1.5 py-0.5 rounded italic transition ${editor.isActive('italic') ? 'bg-ink-600 text-white' : 'text-ink-300 hover:text-white'}`}>I</button>
              <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`px-1.5 py-0.5 rounded transition ${editor.isActive('highlight') ? 'bg-ink-600 text-white' : 'text-ink-300 hover:text-white'}`}>▮</button>
              <div className="w-px h-4 bg-ink-600 mx-1" />
              <button onClick={() => handleAIAction('research')} className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white transition" title="Investigar y contrastar con fuentes">🔬 Investigar</button>
              <button onClick={() => handleAIAction('suggest')} className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition" title="Sugerencias de redacción">✍️ Redactar</button>
              <button onClick={() => handleAIAction('restructure')} className="px-2 py-0.5 rounded bg-purple-700 hover:bg-purple-600 text-white transition" title="Reestructurar">🗂 Estructurar</button>
              <button onClick={() => handleReplaceWithAI('mejorar el estilo y claridad del texto')} className="px-2 py-0.5 rounded bg-accent-600 hover:bg-accent-500 text-white transition" title="Mejorar y reemplazar">⚡ Mejorar</button>
            </div>
          </BubbleMenu>
        )}
      </div>

      {/* Image controls (shown when image is selected, write mode only) */}
      {selectedImage && mode === 'write' && (
        <div className="shrink-0 border-t border-ink-200 bg-ink-50 px-4 py-2 flex items-center gap-4 text-xs font-sans">
          <span className="text-ink-500 font-semibold">🖼 Imagen seleccionada</span>
          <span className="text-ink-400">{selectedImage.naturalWidth}×{selectedImage.naturalHeight}px original</span>
          <div className="flex items-center gap-2">
            <span className="text-ink-500">Ancho:</span>
            <input
              type="range"
              min={60}
              max={900}
              value={imageSize.width}
              onChange={(e) => applyImageSize(Number(e.target.value))}
              className="w-28 accent-accent-500"
            />
            <span className="text-ink-600 w-16">{imageSize.width}px</span>
          </div>
          {/* Alignment */}
          <div className="flex gap-1">
            {[['left', '⇤'], ['center', '⇔'], ['right', '⇥'], ['none', '⊡']].map(([align, icon]) => (
              <button
                key={align}
                title={`Alinear ${align}`}
                onClick={() => {
                  if (selectedImage) {
                    selectedImage.style.display = align === 'center' ? 'block' : align === 'none' ? 'inline' : 'block'
                    selectedImage.style.marginLeft = align === 'center' ? 'auto' : align === 'right' ? 'auto' : '0'
                    selectedImage.style.marginRight = align === 'center' ? 'auto' : align === 'right' ? '0' : align === 'left' ? '1rem' : '0'
                    selectedImage.style.float = align === 'left' || align === 'right' ? align : 'none'
                  }
                }}
                className="px-2 py-1 rounded bg-ink-200 hover:bg-ink-300 text-ink-600 transition"
              >
                {icon}
              </button>
            ))}
          </div>
          <button onClick={() => setSelectedImage(null)} className="ml-auto text-ink-400 hover:text-ink-600">✕</button>
        </div>
      )}

      {/* Status bar */}
      <div className="h-7 border-t border-ink-100 bg-ink-50 flex items-center px-4 gap-4 text-ink-400 text-[11px] font-sans shrink-0">
        <span>{wordCount} palabras</span>
        <span>{charCount} caracteres</span>
        {frames.length > 0 && <span>{frames.length} marco{frames.length !== 1 ? 's' : ''}</span>}
        <span className="flex-1" />
        <span className="capitalize">{LAYOUT_LABELS[document.layout]}</span>
        <span>·</span>
        <span className="capitalize">{document.docType}</span>
      </div>
    </div>
  )
}
