import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { LayoutChartFrame, ChartSeries } from '../../lib/threadEngine'
import { DEFAULT_CHART_PALETTE } from '../../lib/threadEngine'

echarts.use([BarChart, LineChart, PieChart, ScatterChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, SVGRenderer])

// ─── Build ECharts option from frame data ────────────────────────────────────
function buildOption(frame: LayoutChartFrame): echarts.EChartsOption {
  const { chartType, data, title, palette, showLegend, showGrid } = frame
  const colors = palette?.length ? palette : DEFAULT_CHART_PALETTE

  if (chartType === 'pie') {
    const total = data.series[0]?.values.reduce((a, b) => a + b, 0) || 1
    return {
      color: colors,
      title: title ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontFamily: 'Figtree, sans-serif' } } : undefined,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: showLegend ? { bottom: 4, left: 'center', textStyle: { fontFamily: 'Figtree, sans-serif', fontSize: 11 } } : undefined,
      series: [{
        type: 'pie',
        radius: ['35%', '68%'],
        center: ['50%', title ? '52%' : '50%'],
        data: data.labels.map((label, i) => ({
          name: label,
          value: data.series[0]?.values[i] ?? 0,
        })),
        label: { fontFamily: 'Figtree, sans-serif', fontSize: 11 },
      }],
    }
  }

  const series = data.series.map((s: ChartSeries, idx: number) => ({
    name: s.name,
    type: chartType === 'area' ? 'line' : chartType,
    data: s.values,
    smooth: chartType === 'area' || chartType === 'line',
    areaStyle: chartType === 'area' ? { opacity: 0.3 } : undefined,
    itemStyle: { color: colors[idx % colors.length] },
    lineStyle: chartType !== 'bar' ? { width: 2.5 } : undefined,
    symbolSize: chartType === 'scatter' ? 8 : 4,
  }))

  return {
    color: colors,
    title: title ? { text: title, left: 'center', top: 4, textStyle: { fontSize: 13, fontFamily: 'Figtree, sans-serif' } } : undefined,
    tooltip: { trigger: 'axis' },
    legend: showLegend && data.series.length > 1
      ? { bottom: 4, left: 'center', textStyle: { fontFamily: 'Figtree, sans-serif', fontSize: 11 } } : undefined,
    grid: {
      top: title ? 40 : 16,
      bottom: showLegend && data.series.length > 1 ? 40 : 24,
      left: 44, right: 16,
      containLabel: true,
    },
    xAxis: { type: 'category', data: data.labels, axisLine: { show: showGrid }, axisTick: { show: showGrid }, splitLine: { show: false }, axisLabel: { fontFamily: 'Figtree, sans-serif', fontSize: 11 } },
    yAxis: { type: 'value', axisLine: { show: showGrid }, splitLine: { show: showGrid, lineStyle: { color: '#e2e8f0' } }, axisLabel: { fontFamily: 'Figtree, sans-serif', fontSize: 11 } },
    series,
  }
}

// ─── Chart Editor Modal ──────────────────────────────────────────────────────
const CHART_TYPES: { value: LayoutChartFrame['chartType']; label: string; icon: string }[] = [
  { value: 'bar', label: 'Barras', icon: '▊' },
  { value: 'line', label: 'Líneas', icon: '📈' },
  { value: 'area', label: 'Área', icon: '◼' },
  { value: 'pie', label: 'Torta', icon: '◑' },
  { value: 'scatter', label: 'Dispersión', icon: '⋯' },
]

const PALETTES = [
  { name: 'Scriptorium', colors: ['#d4522b', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777'] },
  { name: 'Pastel', colors: ['#93c5fd', '#86efac', '#fca5a5', '#fcd34d', '#c4b5fd', '#f9a8d4'] },
  { name: 'Dark', colors: ['#1e40af', '#15803d', '#b91c1c', '#b45309', '#6d28d9', '#be185d'] },
  { name: 'Mono', colors: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'] },
]

interface EditorProps {
  frame: LayoutChartFrame
  onUpdate: (updates: Partial<LayoutChartFrame>) => void
  onClose: () => void
}

function ChartEditorModal({ frame, onUpdate, onClose }: EditorProps) {
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(frame.data)))
  const [chartType, setChartType] = useState(frame.chartType)
  const [title, setTitle] = useState(frame.title)
  const [palette, setPalette] = useState(frame.palette)
  const [showLegend, setShowLegend] = useState(frame.showLegend)
  const [showGrid, setShowGrid] = useState(frame.showGrid)

  const setLabel = (i: number, v: string) => setData((d: typeof data) => {
    const next = JSON.parse(JSON.stringify(d))
    next.labels[i] = v
    return next
  })

  const setValue = (seriesIdx: number, labelIdx: number, v: string) => setData((d: typeof data) => {
    const next = JSON.parse(JSON.stringify(d))
    next.series[seriesIdx].values[labelIdx] = parseFloat(v) || 0
    return next
  })

  const setSeriesName = (i: number, v: string) => setData((d: typeof data) => {
    const next = JSON.parse(JSON.stringify(d))
    next.series[i].name = v
    return next
  })

  const addLabel = () => setData((d: typeof data) => {
    const next = JSON.parse(JSON.stringify(d))
    next.labels.push(`Cat ${next.labels.length + 1}`)
    next.series.forEach((s: ChartSeries) => s.values.push(0))
    return next
  })

  const removeLabel = (i: number) => setData((d: typeof data) => {
    const next = JSON.parse(JSON.stringify(d))
    next.labels.splice(i, 1)
    next.series.forEach((s: ChartSeries) => s.values.splice(i, 1))
    return next
  })

  const addSeries = () => setData((d: typeof data) => {
    const next = JSON.parse(JSON.stringify(d))
    next.series.push({ name: `Serie ${next.series.length + 1}`, values: next.labels.map(() => 0) })
    return next
  })

  const removeSeries = (i: number) => setData((d: typeof data) => {
    const next = JSON.parse(JSON.stringify(d))
    next.series.splice(i, 1)
    return next
  })

  const handleApply = () => {
    onUpdate({ data, chartType, title, palette, showLegend, showGrid })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={e => e.stopPropagation()}>
      <div style={{ background: '#1e1f22', borderRadius: 14, width: 620, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', fontFamily: 'Figtree, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2d2f36' }}>
          <span style={{ color: '#f1f0ee', fontSize: 15, fontWeight: 600 }}>📊 Editor de Gráfico</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chart type */}
          <div>
            <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo de gráfico</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {CHART_TYPES.map(ct => (
                <button key={ct.value} onClick={() => setChartType(ct.value)}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${chartType === ct.value ? '#d4522b' : '#2d2f36'}`, background: chartType === ct.value ? 'rgba(212,82,43,0.15)' : 'transparent', color: chartType === ct.value ? '#d4522b' : '#9ca3af', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 16 }}>{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title + toggles */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Título</p>
              <input value={title} onChange={e => setTitle(e.target.value)}
                style={{ width: '100%', background: '#2d2f36', border: '1px solid #3d3f46', borderRadius: 8, padding: '6px 10px', color: '#f1f0ee', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 12, cursor: 'pointer', paddingBottom: 4 }}>
              <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} /> Leyenda
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 12, cursor: 'pointer', paddingBottom: 4 }}>
              <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Cuadrícula
            </label>
          </div>

          {/* Palette */}
          <div>
            <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paleta de colores</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {PALETTES.map(p => (
                <button key={p.name} onClick={() => setPalette(p.colors)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: `2px solid ${JSON.stringify(palette) === JSON.stringify(p.colors) ? '#d4522b' : 'transparent'}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {p.colors.slice(0, 4).map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />)}
                  </div>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data table */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Datos</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addSeries} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#2d2f36', border: '1px solid #3d3f46', color: '#9ca3af', cursor: 'pointer' }}>+ Serie</button>
                <button onClick={addLabel} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#2d2f36', border: '1px solid #3d3f46', color: '#9ca3af', cursor: 'pointer' }}>+ Categoría</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #2d2f36', minWidth: 80 }}>Categoría</th>
                    {data.series.map((s: ChartSeries, si: number) => (
                      <th key={si} style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid #2d2f36', minWidth: 80 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: palette[si % palette.length] ?? '#d4522b', flexShrink: 0 }} />
                          <input value={s.name} onChange={e => setSeriesName(si, e.target.value)}
                            style={{ width: '100%', background: 'transparent', border: 'none', color: '#f1f0ee', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                          {data.series.length > 1 && (
                            <button onClick={() => removeSeries(si)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.labels.map((label: string, li: number) => (
                    <tr key={li} style={{ borderBottom: '1px solid #1a1b1e' }}>
                      <td style={{ padding: '2px 4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input value={label} onChange={e => setLabel(li, e.target.value)}
                            style={{ flex: 1, background: '#2d2f36', border: '1px solid #3d3f46', borderRadius: 4, padding: '3px 6px', color: '#f1f0ee', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                          <button onClick={() => removeLabel(li)} style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                        </div>
                      </td>
                      {data.series.map((s: ChartSeries, si: number) => (
                        <td key={si} style={{ padding: '2px 4px' }}>
                          <input type="number" value={s.values[li] ?? 0} onChange={e => setValue(si, li, e.target.value)}
                            style={{ width: '100%', background: '#2d2f36', border: '1px solid #3d3f46', borderRadius: 4, padding: '3px 6px', color: '#f1f0ee', fontSize: 12, outline: 'none', textAlign: 'right', fontFamily: 'inherit' }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #2d2f36' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, background: 'transparent', border: '1px solid #3d3f46', color: '#9ca3af', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleApply} style={{ padding: '7px 18px', borderRadius: 8, background: '#d4522b', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Aplicar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main chart frame component ──────────────────────────────────────────────
interface Props {
  frame: LayoutChartFrame
  isSelected: boolean
  scale: number
  onSelect: () => void
  onUpdate: (updates: Partial<LayoutChartFrame>) => void
  onDelete: () => void
}

export function LayoutChartFrameComp({ frame, isSelected, scale, onSelect, onUpdate, onDelete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, fx: 0, fy: 0 })
  const resizing = useRef(false)
  const resizeStart = useRef({ mx: 0, my: 0, fw: 0, fh: 0 })

  // Init / update chart
  useEffect(() => {
    if (!containerRef.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, undefined, { renderer: 'svg' })
    }
    chartRef.current.resize({ width: frame.width, height: frame.height })
    chartRef.current.setOption(buildOption(frame), true)

    // Store SVG cache for export
    const svgEl = containerRef.current.querySelector('svg')
    if (svgEl) {
      const svgStr = svgEl.outerHTML
      if (svgStr !== frame.svgCache) {
        onUpdate({ svgCache: svgStr })
      }
    }
  }, [frame.chartType, frame.data, frame.title, frame.palette, frame.showLegend, frame.showGrid, frame.width, frame.height])

  // Cleanup
  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onSelect()
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y }
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return
      const dx = (ev.clientX - dragStart.current.mx) / scale
      const dy = (ev.clientY - dragStart.current.my) / scale
      onUpdate({ x: Math.round(dragStart.current.fx + dx), y: Math.round(dragStart.current.fy + dy) })
    }
    const up = () => { dragging.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [frame, scale, onSelect, onUpdate])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    resizing.current = true
    resizeStart.current = { mx: e.clientX, my: e.clientY, fw: frame.width, fh: frame.height }
    const move = (ev: MouseEvent) => {
      if (!resizing.current) return
      const dw = (ev.clientX - resizeStart.current.mx) / scale
      const dh = (ev.clientY - resizeStart.current.my) / scale
      onUpdate({ width: Math.max(120, Math.round(resizeStart.current.fw + dw)), height: Math.max(80, Math.round(resizeStart.current.fh + dh)) })
    }
    const up = () => { resizing.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [frame, scale, onUpdate])

  return (
    <>
      <div
        style={{
          position: 'absolute', left: frame.x, top: frame.y,
          width: frame.width, height: frame.height,
          opacity: frame.opacity, zIndex: frame.zIndex,
          background: frame.backgroundColor !== 'transparent' ? frame.backgroundColor : undefined,
          cursor: 'move',
          outline: isSelected ? '2px solid #d4522b' : '1px solid #e2e8f0',
          boxSizing: 'border-box',
          borderRadius: 4,
          overflow: 'hidden',
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={e => { e.stopPropagation(); setShowEditor(true) }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {isSelected && (
          <>
            {/* Delete button */}
            <button
              onMouseDown={e => { e.stopPropagation(); onDelete() }}
              style={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, zIndex: 10 }}
            >×</button>
            {/* Edit button */}
            <button
              onMouseDown={e => { e.stopPropagation(); setShowEditor(true) }}
              style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#d4522b', border: 'none', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap', fontFamily: 'Figtree, sans-serif', zIndex: 10 }}
            >✏ Editar datos</button>
            {/* Resize handle SE */}
            <div
              onMouseDown={handleResizeMouseDown}
              style={{ position: 'absolute', right: -4, bottom: -4, width: 12, height: 12, background: '#d4522b', borderRadius: 2, cursor: 'se-resize', zIndex: 10 }}
            />
          </>
        )}
      </div>

      {showEditor && (
        <ChartEditorModal
          frame={{ ...frame, data: JSON.parse(JSON.stringify(frame.data)) }}
          onUpdate={onUpdate}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
