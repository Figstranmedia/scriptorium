import React, { useState } from 'react'
import type { PreflightReport } from '../../lib/preflight'

interface Props {
  report: PreflightReport
  onSelectFrame: (id: string) => void
}

export function PreflightBadge({ report }: { report: PreflightReport }) {
  const { status, errorCount, warningCount } = report
  if (status === 'ok') {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-800 text-emerald-300 text-[11px] font-sans">
        <span>✓</span> <span>Preflight OK</span>
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-sans ${status === 'error' ? 'bg-red-900 text-red-300' : 'bg-amber-900 text-amber-300'}`}>
      <span>{status === 'error' ? '✗' : '⚠'}</span>
      {errorCount > 0 && <span>{errorCount} error{errorCount !== 1 ? 'es' : ''}</span>}
      {warningCount > 0 && <span>{warningCount} aviso{warningCount !== 1 ? 's' : ''}</span>}
    </div>
  )
}

export function PreflightPanel({ report, onSelectFrame }: Props) {
  const [expanded, setExpanded] = useState(true)

  if (report.status === 'ok') {
    return (
      <div className="p-3 bg-emerald-900/30 border border-emerald-800 rounded-lg text-[11px] font-sans text-emerald-400 text-center">
        ✓ Sin errores ni advertencias
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {report.issues.map(issue => (
        <div
          key={issue.id}
          className={`p-2 rounded border text-[10px] font-sans cursor-pointer transition ${
            issue.severity === 'error'
              ? 'bg-red-900/30 border-red-800 text-red-300 hover:bg-red-900/50'
              : 'bg-amber-900/30 border-amber-800 text-amber-300 hover:bg-amber-900/50'
          }`}
          onClick={() => issue.frameId && onSelectFrame(issue.frameId)}
        >
          <div className="flex items-start gap-1.5">
            <span className="shrink-0">{issue.severity === 'error' ? '✗' : '⚠'}</span>
            <div>
              <p className="font-semibold">{issue.message}</p>
              {issue.detail && <p className="opacity-75 mt-0.5">{issue.detail}</p>}
              {issue.frameId && <p className="opacity-50 mt-0.5">→ clic para seleccionar marco</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
