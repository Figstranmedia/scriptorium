import React from 'react'
import type { LayoutFrame, LayoutImageFrame, AnyLayoutFrame } from '../../lib/threadEngine'
import { isImageFrame } from '../../lib/threadEngine'

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
    return (
      <div className="p-3 space-y-3 overflow-y-auto">
        <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-wider">🖼 Marco de imagen</p>
        <NumField label="X" value={frame.x} min={0} max={2000} onChange={v => upd({ x: v })} />
        <NumField label="Y" value={frame.y} min={0} max={3000} onChange={v => upd({ y: v })} />
        <NumField label="Ancho" value={frame.width} min={40} max={2000} onChange={v => upd({ width: v })} />
        <NumField label="Alto" value={frame.height} min={30} max={3000} onChange={v => upd({ height: v })} />
        <div>
          <label className="text-[10px] text-slate-400 font-sans block mb-1">Ajuste</label>
          <div className="flex gap-1">
            {(['fit', 'fill', 'crop'] as const).map(f => (
              <button key={f} onClick={() => upd({ fit: f })}
                className={`flex-1 py-1 rounded text-[10px] font-sans border transition ${frame.fit === f ? 'border-accent-400 bg-accent-50 text-accent-700' : 'border-slate-200 text-slate-400'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-sans block mb-1">Leyenda</label>
          <input type="text" value={frame.caption}
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

      {/* Typography */}
      <div className="space-y-1.5 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Tipografía</p>
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] text-slate-400 font-sans">Fuente</label>
          <select value={tf.fontFamily} onChange={e => upd({ fontFamily: e.target.value as any })}
            className="text-xs border border-slate-200 rounded px-1.5 py-0.5 outline-none font-sans">
            <option value="serif">Serif (Lora)</option>
            <option value="sans">Sans (Figtree)</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <NumField label="Tamaño (pt)" value={tf.fontSize} min={6} max={72} onChange={v => upd({ fontSize: v })} />
        <NumField label="Interlineado" value={tf.lineHeight} min={1} max={3} step={0.05} onChange={v => upd({ lineHeight: v })} />
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
          <p className="text-[10px] text-slate-400 font-sans">Sin enlace. Selecciona el marco y usa el botón <strong>⛓ Vincular</strong> para encadenar el flujo de texto.</p>
        )}
        {tf.threadPrevId && (
          <div className="bg-indigo-50 border border-indigo-200 rounded p-2 text-[10px] font-sans text-indigo-700">
            ← Recibe texto del marco anterior
          </div>
        )}
      </div>
    </div>
  )
}
