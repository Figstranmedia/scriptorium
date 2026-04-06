import React, { useState } from 'react'
import type { Editor as TipTapEditor } from '@tiptap/react'
import type { Document, LayoutStyle } from '../../store/useStore'

interface Props {
  editor: TipTapEditor | null
  document: Document
  store: any
  onSave: () => void
  onAddTextFrame: () => void
  onInsertTOC: () => void
  onExport: () => void
  mode: 'write' | 'layout'
  onToggleMode: () => void
}

const LAYOUTS: { value: LayoutStyle; label: string }[] = [
  { value: 'default', label: 'Estándar' },
  { value: 'book', label: 'Libro' },
  { value: 'thesis', label: 'Tesis' },
  { value: 'paper', label: 'Paper' },
]

function Btn({ onClick, active, disabled = false, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title?: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 rounded text-xs transition font-sans select-none ${
        active ? 'bg-ink-200 text-ink-800' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

function Sep() { return <div className="w-px h-5 bg-ink-200 mx-1" /> }

export function Toolbar({ editor, document, store, onSave, onAddTextFrame, onInsertTOC, onExport, mode, onToggleMode }: Props) {
  const [saved, setSaved] = useState(false)

  const handleSave = () => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const handleInsertImage = async () => {
    const dataUrl = await window.api.pickImage()
    if (dataUrl && editor) {
      editor.chain().focus().setImage({ src: dataUrl }).run()
    }
  }

  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-ink-100 bg-ink-50 flex-wrap shrink-0 min-h-[40px]">
      {/* Headings */}
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1">H1</Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">H2</Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3">H3</Btn>

      <Sep />

      {/* Text format */}
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita"><b>B</b></Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálica"><i>I</i></Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado"><u>U</u></Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado"><s>S</s></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Resaltar">▮</Btn>
      <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Código">{`<>`}</Btn>

      <Sep />

      {/* Alignment */}
      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Izquierda">⇤</Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrar">⇔</Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Derecha">⇥</Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar">≡</Btn>

      <Sep />

      {/* Lists & blocks */}
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista viñetas">• Lista</Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">1. Lista</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Cita">" "</Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Separador">──</Btn>

      <Sep />

      {/* Table */}
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insertar tabla">⊞ Tabla</Btn>

      <Sep />

      {/* Image */}
      <Btn onClick={handleInsertImage} title="Insertar imagen desde archivo">🖼 Imagen</Btn>

      {/* Text frame */}
      <Btn onClick={onAddTextFrame} title="Añadir marco de texto flotante (arrastrable)">⊡ Marco</Btn>

      <Sep />

      {/* TOC */}
      <Btn onClick={onInsertTOC} title="Insertar Tabla de Contenido al inicio">≣ TOC</Btn>

      {/* Export */}
      <button
        onClick={onExport}
        className="px-2.5 py-1 rounded text-xs font-sans text-white bg-ink-600 hover:bg-ink-700 transition"
        title="Exportar a PDF"
      >
        ⬇ PDF
      </button>

      <Sep />

      {/* Layout */}
      <select
        value={document.layout}
        onChange={(e) => store.updateDocument(document.id, { layout: e.target.value as LayoutStyle })}
        className="text-xs bg-transparent text-ink-500 border border-ink-200 rounded px-2 py-1 cursor-pointer hover:border-ink-300 transition font-sans"
        title="Estilo de maquetación"
      >
        {LAYOUTS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>

      <div className="flex-1" />

      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer">↩</Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer">↪</Btn>

      <Sep />

      <button
        onClick={handleSave}
        className={`px-3 py-1 rounded text-xs font-sans transition ${saved ? 'bg-emerald-500 text-white' : 'bg-ink-200 hover:bg-ink-300 text-ink-600'}`}
      >
        {saved ? '✓ Guardado' : '💾 Guardar'}
      </button>

      <Sep />

      {/* Mode toggle */}
      <button
        onClick={onToggleMode}
        className={`px-3 py-1 rounded text-xs font-sans font-semibold transition ${
          mode === 'layout'
            ? 'bg-slate-700 text-white hover:bg-slate-600'
            : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
        }`}
        title={mode === 'layout' ? 'Volver al editor de texto' : 'Modo Maquetación — canvas de páginas con text threading'}
      >
        {mode === 'layout' ? '✍️ Escritura' : '📐 Maquetación'}
      </button>
    </div>
  )
}
