import React, { useState } from 'react'
import type { ParagraphStyle } from '../../store/useStore'
import { resolveFontFamily } from '../../lib/fontUtils'

interface Props {
  styles: ParagraphStyle[]
  onUpdate: (styles: ParagraphStyle[]) => void
}

const EMPTY_STYLE: Omit<ParagraphStyle, 'id' | 'name'> = {
  fontFamily: 'serif',
  fontSize: 12,
  lineHeight: 1.6,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  textColor: '#1a1714',
  letterSpacing: 0,
}

function StyleForm({
  style,
  onSave,
  onCancel,
}: {
  style: Partial<ParagraphStyle> & { name: string }
  onSave: (s: Partial<ParagraphStyle> & { name: string }) => void
  onCancel: () => void
}) {
  const [s, setS] = useState(style)
  const set = (k: keyof ParagraphStyle, v: any) => setS(prev => ({ ...prev, [k]: v }))

  const btnCls = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-[10px] border transition ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`

  return (
    <div className="bg-slate-700 rounded p-2 space-y-2 text-[10px] font-sans">
      {/* Name */}
      <input
        value={s.name}
        onChange={e => setS(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Nombre del estilo"
        className="w-full text-xs px-2 py-1 rounded border border-slate-500 bg-slate-600 text-white placeholder-slate-400 outline-none focus:border-indigo-400"
      />

      {/* Font family */}
      <div className="flex items-center gap-2">
        <label className="text-slate-400 shrink-0">Fuente</label>
        <select
          value={s.fontFamily || 'serif'}
          onChange={e => set('fontFamily', e.target.value)}
          className="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-500 bg-slate-600 text-white outline-none"
        >
          <option value="serif">Serif</option>
          <option value="sans">Sans-serif</option>
          <option value="mono">Monospace</option>
        </select>
      </div>

      {/* Size + Line height */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <label className="text-slate-400 shrink-0">pt</label>
          <input type="number" min={6} max={120} step={0.5}
            value={s.fontSize || 12}
            onChange={e => set('fontSize', Number(e.target.value))}
            className="w-full text-[10px] px-1.5 py-0.5 rounded border border-slate-500 bg-slate-600 text-white outline-none" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-slate-400 shrink-0">lh</label>
          <input type="number" min={0.8} max={4} step={0.05}
            value={s.lineHeight || 1.6}
            onChange={e => set('lineHeight', Number(e.target.value))}
            className="w-full text-[10px] px-1.5 py-0.5 rounded border border-slate-500 bg-slate-600 text-white outline-none" />
        </div>
      </div>

      {/* Letter spacing */}
      <div className="flex items-center gap-2">
        <label className="text-slate-400 shrink-0">Esp. letras</label>
        <input type="number" min={-3} max={20} step={0.5}
          value={s.letterSpacing || 0}
          onChange={e => set('letterSpacing', Number(e.target.value))}
          className="w-16 text-[10px] px-1.5 py-0.5 rounded border border-slate-500 bg-slate-600 text-white outline-none" />
      </div>

      {/* Bold / italic */}
      <div className="flex gap-1">
        <button onClick={() => set('fontWeight', s.fontWeight === 'bold' ? 'normal' : 'bold')}
          className={btnCls(s.fontWeight === 'bold')}><b>B</b></button>
        <button onClick={() => set('fontStyle', s.fontStyle === 'italic' ? 'normal' : 'italic')}
          className={btnCls(s.fontStyle === 'italic')}><i>I</i></button>
        <div className="flex-1" />
        {(['left', 'center', 'right', 'justify'] as const).map(a => (
          <button key={a} onClick={() => set('textAlign', a)}
            className={btnCls(s.textAlign === a)}>
            {a === 'left' ? '⇤' : a === 'center' ? '⇔' : a === 'right' ? '⇥' : '≡'}
          </button>
        ))}
      </div>

      {/* Color */}
      <div className="flex items-center gap-2">
        <label className="text-slate-400 shrink-0">Color</label>
        <input type="color" value={s.textColor || '#1a1714'}
          onChange={e => set('textColor', e.target.value)}
          className="w-7 h-5 cursor-pointer rounded border border-slate-500" />
        <input type="text" value={s.textColor || '#1a1714'}
          onChange={e => set('textColor', e.target.value)}
          className="flex-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-500 bg-slate-600 text-white outline-none font-mono" />
      </div>

      {/* Actions */}
      <div className="flex gap-1 pt-1">
        <button
          onClick={() => onSave(s)}
          className="flex-1 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] transition"
        >✓ Guardar</button>
        <button
          onClick={onCancel}
          className="flex-1 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 text-[10px] transition"
        >Cancelar</button>
      </div>
    </div>
  )
}

export function StylesPanel({ styles, onUpdate }: Props) {
  const [editing, setEditing] = useState<string | null>(null)   // style id being edited
  const [creating, setCreating] = useState(false)

  const handleSaveEdit = (id: string, updated: Partial<ParagraphStyle> & { name: string }) => {
    onUpdate(styles.map(s => s.id === id ? { ...s, ...updated } : s))
    setEditing(null)
  }

  const handleCreate = (data: Partial<ParagraphStyle> & { name: string }) => {
    if (!data.name.trim()) return
    const newStyle: ParagraphStyle = {
      id: `ps-${Date.now()}`,
      name: data.name,
      ...EMPTY_STYLE,
      ...data,
    }
    onUpdate([...styles, newStyle])
    setCreating(false)
  }

  const handleDelete = (id: string) => {
    onUpdate(styles.filter(s => s.id !== id))
  }

  return (
    <div className="p-2 space-y-1.5 overflow-y-auto">
      <p className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Aa Estilos de párrafo
      </p>

      {styles.map(style => {
        const ff = resolveFontFamily(style.fontFamily)
        const isEditingThis = editing === style.id

        return (
          <div key={style.id}>
            {isEditingThis ? (
              <StyleForm
                style={style}
                onSave={(data) => handleSaveEdit(style.id, data)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="group flex items-center gap-1.5 p-1.5 rounded hover:bg-slate-700 transition">
                {/* Preview */}
                <div className="flex-1 min-w-0">
                  <p
                    style={{
                      fontFamily: ff,
                      fontSize: Math.min(style.fontSize, 13),
                      fontWeight: style.fontWeight,
                      fontStyle: style.fontStyle,
                      color: style.textColor,
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {style.name}
                  </p>
                  <p className="text-[9px] text-slate-500 font-sans">
                    {style.fontFamily} · {style.fontSize}pt · {style.lineHeight}lh
                  </p>
                </div>

                {/* Controls */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button
                    onClick={() => setEditing(style.id)}
                    className="p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition"
                    title="Editar estilo"
                  >✏</button>
                  <button
                    onClick={() => handleDelete(style.id)}
                    className="p-1 rounded hover:bg-red-900 text-slate-400 hover:text-red-300 transition"
                    title="Eliminar estilo"
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* New style form */}
      {creating ? (
        <StyleForm
          style={{ name: '', ...EMPTY_STYLE }}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full py-1.5 rounded border border-dashed border-slate-600 text-[10px] text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition font-sans mt-2"
        >
          + Nuevo estilo
        </button>
      )}
    </div>
  )
}
