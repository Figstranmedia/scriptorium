import React, { useState } from 'react'
import type { AnyLayoutFrame, LayoutFrame } from '../../lib/threadEngine'
import { createDefaultFrame, isImageFrame } from '../../lib/threadEngine'

export interface MasterPage {
  id: string
  name: string
  frames: AnyLayoutFrame[]
  // Page number position
  pageNumber: 'none' | 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center'
  pageNumberStyle: 'arabic' | 'roman'
  headerText: string
  footerText: string
}

interface Props {
  masters: MasterPage[]
  pageAssignments: Record<number, string>  // pageIndex → masterId
  pageCount: number
  onCreateMaster: (name: string) => void
  onDeleteMaster: (id: string) => void
  onUpdateMaster: (id: string, updates: Partial<MasterPage>) => void
  onAssignMaster: (pageIndex: number, masterId: string | null) => void
}

export function createDefaultMaster(name: string = 'Master A'): MasterPage {
  return {
    id: `master_${Date.now()}`,
    name,
    frames: [],
    pageNumber: 'bottom-center',
    pageNumberStyle: 'arabic',
    headerText: '',
    footerText: '',
  }
}

export function MasterPagePanel({
  masters, pageAssignments, pageCount,
  onCreateMaster, onDeleteMaster, onUpdateMaster, onAssignMaster,
}: Props) {
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(
    masters.length > 0 ? masters[0].id : null
  )
  const selectedMaster = masters.find(m => m.id === selectedMasterId) || null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Master list */}
      <div className="p-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider">Páginas maestras</p>
          <button
            onClick={() => onCreateMaster(`Master ${String.fromCharCode(65 + masters.length)}`)}
            className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 font-sans transition"
          >+ Nueva</button>
        </div>

        {masters.length === 0 ? (
          <p className="text-[10px] text-slate-500 font-sans">Sin páginas maestras. Crea una para definir encabezados, pies de página y numeración.</p>
        ) : (
          <div className="space-y-1">
            {masters.map(m => (
              <div
                key={m.id}
                onClick={() => setSelectedMasterId(m.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition ${
                  selectedMasterId === m.id ? 'bg-indigo-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                <span className="text-[11px] font-sans">{m.name}</span>
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onDeleteMaster(m.id) }}
                  className="text-slate-500 hover:text-red-400 text-xs transition"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Master settings */}
      {selectedMaster && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-[10px] text-slate-400 font-sans block mb-1">Nombre</label>
            <input
              type="text"
              value={selectedMaster.name}
              onChange={e => onUpdateMaster(selectedMaster.id, { name: e.target.value })}
              className="w-full text-xs px-2 py-1 bg-slate-700 border border-slate-600 rounded outline-none focus:border-indigo-500 text-slate-200 font-sans"
            />
          </div>

          {/* Header / Footer */}
          <div>
            <label className="text-[10px] text-slate-400 font-sans block mb-1">Encabezado</label>
            <input
              type="text"
              value={selectedMaster.headerText}
              onChange={e => onUpdateMaster(selectedMaster.id, { headerText: e.target.value })}
              placeholder="Título del libro, capítulo..."
              className="w-full text-xs px-2 py-1 bg-slate-700 border border-slate-600 rounded outline-none focus:border-indigo-500 text-slate-200 font-sans"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-sans block mb-1">Pie de página</label>
            <input
              type="text"
              value={selectedMaster.footerText}
              onChange={e => onUpdateMaster(selectedMaster.id, { footerText: e.target.value })}
              placeholder="Autor, institución..."
              className="w-full text-xs px-2 py-1 bg-slate-700 border border-slate-600 rounded outline-none focus:border-indigo-500 text-slate-200 font-sans"
            />
          </div>

          {/* Page number */}
          <div>
            <label className="text-[10px] text-slate-400 font-sans block mb-1">Número de página</label>
            <select
              value={selectedMaster.pageNumber}
              onChange={e => onUpdateMaster(selectedMaster.id, { pageNumber: e.target.value as any })}
              className="w-full text-xs px-2 py-1 bg-slate-700 border border-slate-600 rounded outline-none text-slate-200 font-sans"
            >
              <option value="none">Sin número</option>
              <option value="bottom-center">Inferior centrado</option>
              <option value="bottom-left">Inferior izquierdo</option>
              <option value="bottom-right">Inferior derecho</option>
              <option value="top-center">Superior centrado</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-sans block mb-1">Estilo de numeración</label>
            <div className="flex gap-2">
              {(['arabic', 'roman'] as const).map(s => (
                <button key={s} onClick={() => onUpdateMaster(selectedMaster.id, { pageNumberStyle: s })}
                  className={`flex-1 py-1 rounded text-[10px] font-sans border transition ${
                    selectedMaster.pageNumberStyle === s ? 'border-indigo-500 bg-indigo-900 text-indigo-300' : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}>
                  {s === 'arabic' ? '1, 2, 3...' : 'i, ii, iii...'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Page assignment */}
      <div className="p-3 border-t border-slate-700 shrink-0">
        <p className="text-[10px] font-sans text-slate-400 uppercase tracking-wider mb-2">Asignar a páginas</p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {Array.from({ length: pageCount }, (_, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-sans">Página {i + 1}</span>
              <select
                value={pageAssignments[i] || 'none'}
                onChange={e => onAssignMaster(i, e.target.value === 'none' ? null : e.target.value)}
                className="text-[10px] px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded outline-none text-slate-300 font-sans"
              >
                <option value="none">Sin master</option>
                {masters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
