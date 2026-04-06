import React from 'react'
import type { LayoutFrame, LayoutImageFrame, AnyLayoutFrame } from '../../lib/threadEngine'
import { isImageFrame } from '../../lib/threadEngine'
import { FontPicker } from './FontPicker'

interface Props {
  frame: AnyLayoutFrame | null
  onUpdate: (id: string, updates: Partial<AnyLayoutFrame>) => void
  onUnlink: (id: string) => void
}

function NumField({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[10px] text-slate-400 font-sans shrink-0">{label}</label>
      <input
        type="number" min={min} max={max} step={step} value={Math.round(value * 10) / 10}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 text-xs text-right px-1.5 py-0.5 border border-slate-200 rounded outline-none focus:border-indigo-400 font-sans bg-white"
      />
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[10px] text-slate-400 font-sans shrink-0">{label}</label>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value || '#1a1714'} onChange={e => onChange(e.target.value)}
          className="w-7 h-6 cursor-pointer border border-slate-200 rounded" />
        <input type="text" value={value || '#1a1714'} onChange={e => onChange(e.target.value)}
          className="w-20 text-xs px-1.5 py-0.5 border border-slate-200 rounded outline-none focus:border-indigo-400 font-sans bg-white" />
      </div>
    </div>
  )
}

export function LayoutPropertiesPanel({ frame, onUpdate, onUnlink }: Props) {
  if (!frame) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <p className="text-xs text-slate-400 font-sans">Selecciona un marco para ver sus propiedades</p>
      </div>
    )
  }

  const upd = (updates: Partial<AnyLayoutFrame>) => onUpdate(frame.id, updates)

  if (isImageFrame(frame)) {
    const imgF = frame as LayoutImageFrame
    return (
      <div className="p-3 space-y-3 overflow-y-auto">
        <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-wider">🖼 Marco de imagen</p>
        <NumField label="X" value={imgF.x} min={0} max={2000} onChange={v => upd({ x: v })} />
        <NumField label="Y" value={imgF.y} min={0} max={3000} onChange={v => upd({ y: v })} />
        <NumField label="Ancho" value={imgF.width} min={40} max={2000} onChange={v => upd({ width: v })} />
        <NumField label="Alto" value={imgF.height} min={30} max={3000} onChange={v => upd({ height: v })} />
        <div>
          <label className="text-[10px] text-slate-400 font-sans block mb-1">Ajuste</label>
          <div className="flex gap-1">
            {(['fit', 'fill', 'crop'] as const).map(f => (
              <button key={f} onClick={() => upd({ fit: f })}
                className={`flex-1 py-1 rounded text-[10px] font-sans border transition ${imgF.fit === f ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-400'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-sans block mb-1">Leyenda</label>
          <input type="text" value={imgF.caption}
            onChange={e => upd({ caption: e.target.value })}
            className="w-full text-xs px-2 py-1 border border-slate-200 rounded outline-none focus:border-indigo-400 font-sans"
            placeholder="Descripción de la imagen..." />
        </div>
      </div>
    )
  }

  const tf = frame as LayoutFrame
  return (
    <div className="p-3 space-y-3 overflow-y-auto text-slate-700">
      <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-wider">Marco de texto</p>

      {/* Position & size */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Posición y tamaño</p>
        <NumField label="X" value={tf.x} min={0} max={2000} onChange={v => upd({ x: v })} />
        <NumField label="Y" value={tf.y} min={0} max={3000} onChange={v => upd({ y: v })} />
        <NumField label="Ancho" value={tf.width} min={40} max={2000} onChange={v => upd({ width: v })} />
        <NumField label="Alto" value={tf.height} min={30} max={3000} onChange={v => upd({ height: v })} />
      </div>

      {/* Paragraph style */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Estilo de párrafo</p>

        {/* Font family */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] text-slate-400 font-sans shrink-0">Fuente</label>
          <FontPicker value={tf.fontFamily} onChange={v => upd({ fontFamily: v })} />
        </div>

        <NumField label="Tamaño (pt)" value={tf.fontSize} min={6} max={72} onChange={v => upd({ fontSize: v })} />
        <NumField label="Interlineado" value={tf.lineHeight} min={1} max={3} step={0.05} onChange={v => upd({ lineHeight: v })} />
        <NumField label="Esp. letras (px)" value={tf.letterSpacing || 0} min={-3} max={20} step={0.5} onChange={v => upd({ letterSpacing: v } as Partial<LayoutFrame>)} />

        {/* Weight & style */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-400 font-sans shrink-0">Estilo</label>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => upd({ fontWeight: tf.fontWeight === 'bold' ? 'normal' : 'bold' } as Partial<LayoutFrame>)}
              className={`w-7 h-6 rounded text-xs font-bold border transition ${tf.fontWeight === 'bold' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-400'}`}
              title="Negrita"
            >B</button>
            <button
              onClick={() => upd({ fontStyle: tf.fontStyle === 'italic' ? 'normal' : 'italic' } as Partial<LayoutFrame>)}
              className={`w-7 h-6 rounded text-xs italic border transition ${tf.fontStyle === 'italic' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-400'}`}
              title="Cursiva"
            >I</button>
          </div>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-400 font-sans shrink-0">Alineación</label>
          <div className="flex gap-1 ml-auto">
            {([
              { v: 'left', icon: '≡', title: 'Izquierda' },
              { v: 'center', icon: '≡', title: 'Centro' },
              { v: 'right', icon: '≡', title: 'Derecha' },
              { v: 'justify', icon: '≡', title: 'Justificado' },
            ] as const).map(({ v, icon, title }) => (
              <button
                key={v}
                onClick={() => upd({ textAlign: v } as Partial<LayoutFrame>)}
                title={title}
                className={`w-7 h-6 rounded text-xs border transition ${tf.textAlign === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-400'}`}
              >
                {v === 'left' ? '⬛' : v === 'center' ? '⬜' : v === 'right' ? '⬛' : '▬'}
              </button>
            ))}
          </div>
        </div>

        {/* Text color */}
        <ColorField
          label="Color texto"
          value={tf.textColor || '#1a1714'}
          onChange={v => upd({ textColor: v } as Partial<LayoutFrame>)}
        />
      </div>

      {/* Padding */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Relleno interno</p>
        <NumField label="Superior" value={tf.paddingTop} min={0} max={80} onChange={v => upd({ paddingTop: v })} />
        <NumField label="Derecho" value={tf.paddingRight} min={0} max={80} onChange={v => upd({ paddingRight: v })} />
        <NumField label="Inferior" value={tf.paddingBottom} min={0} max={80} onChange={v => upd({ paddingBottom: v })} />
        <NumField label="Izquierdo" value={tf.paddingLeft} min={0} max={80} onChange={v => upd({ paddingLeft: v })} />
      </div>

      {/* Columns */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Columnas</p>
        <NumField label="Columnas" value={tf.columns} min={1} max={4} onChange={v => upd({ columns: v })} />
        {tf.columns > 1 && <NumField label="Medianil (px)" value={tf.columnGutter} min={8} max={60} onChange={v => upd({ columnGutter: v })} />}
      </div>

      {/* Threading */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Encadenado de texto</p>
        {tf.threadNextId ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded p-2 text-[10px] font-sans text-indigo-700">
            <p>→ Vinculado al marco siguiente</p>
            <button onClick={() => onUnlink(tf.id)} className="mt-1 text-red-500 hover:text-red-700 transition">Desvincular</button>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400 font-sans">Sin enlace. Usa el botón <strong>⛓ Vincular</strong> para encadenar.</p>
        )}
        {tf.threadPrevId && (
          <div className="bg-indigo-50 border border-indigo-200 rounded p-2 text-[10px] font-sans text-indigo-700">
            ← Recibe texto del marco anterior
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Apariencia</p>
        <ColorField label="Fondo" value={tf.backgroundColor || 'transparent'} onChange={v => upd({ backgroundColor: v } as Partial<LayoutFrame>)} />
        <ColorField label="Borde color" value={tf.borderColor || 'transparent'} onChange={v => upd({ borderColor: v } as Partial<LayoutFrame>)} />
        <NumField label="Borde grosor" value={tf.borderWidth || 0} min={0} max={20} onChange={v => upd({ borderWidth: v } as Partial<LayoutFrame>)} />
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] text-slate-400 font-sans">Borde estilo</label>
          <select value={tf.borderStyle || 'solid'} onChange={e => upd({ borderStyle: e.target.value as LayoutFrame['borderStyle'] })}
            className="text-xs border border-slate-200 rounded px-1.5 py-0.5 outline-none font-sans">
            <option value="solid">Sólido</option>
            <option value="dashed">Rayado</option>
            <option value="dotted">Punteado</option>
          </select>
        </div>
        <NumField label="Radio esquinas" value={tf.cornerRadius || 0} min={0} max={100} onChange={v => upd({ cornerRadius: v } as Partial<LayoutFrame>)} />
        <NumField label="Opacidad (0-1)" value={tf.opacity !== undefined ? tf.opacity : 1} min={0} max={1} step={0.05} onChange={v => upd({ opacity: v } as Partial<LayoutFrame>)} />
      </div>

      {/* Layer */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Capa</p>
        <NumField label="Z-order" value={tf.zIndex || 10} min={1} max={100} onChange={v => upd({ zIndex: v } as Partial<LayoutFrame>)} />
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-400 font-sans">Bloqueado</label>
          <button
            onClick={() => upd({ locked: !tf.locked } as Partial<LayoutFrame>)}
            className={`px-2 py-0.5 rounded text-[10px] border transition ${tf.locked ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-200 text-slate-400'}`}
          >{tf.locked ? '🔒 Sí' : '🔓 No'}</button>
        </div>
      </div>
    </div>
  )
}
