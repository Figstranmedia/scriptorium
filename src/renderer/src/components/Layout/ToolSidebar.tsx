/**
 * ToolSidebar — Affinity-style vertical tool palette on the left of the layout canvas.
 */
import React from 'react'
import type { DrawMode } from './LayoutPage'

// ─── Tool definitions ─────────────────────────────────────────────────────────

type ToolId = DrawMode | '__sep__' | '__disabled__'

interface ToolDef {
  id: ToolId
  icon: React.ReactNode
  label: string
  key?: string
  activeColor?: string
  disabled?: boolean
  separator?: boolean
}

const TOOLS: ToolDef[] = [
  // Selection
  {
    id: 'pointer',
    icon: <PointerIcon />,
    label: 'Seleccionar / Mover (Esc)',
    key: 'Esc',
    activeColor: '#e2e8f0',
  },
  // Space between pointer and create tools
  { id: '__sep__', icon: null, label: '', separator: true },

  // Create
  {
    id: 'draw-text',
    icon: <TextIcon />,
    label: 'Marco de texto (T)',
    key: 'T',
    activeColor: '#60a5fa',
  },
  {
    id: 'draw-image',
    icon: <ImageIcon />,
    label: 'Marco de imagen (I)',
    key: 'I',
    activeColor: '#a78bfa',
  },

  // Shapes
  {
    id: 'draw-rect',
    icon: <RectIcon />,
    label: 'Rectángulo (R)',
    key: 'R',
    activeColor: '#34d399',
  },
  {
    id: 'draw-ellipse',
    icon: <EllipseIcon />,
    label: 'Elipse (E)',
    key: 'E',
    activeColor: '#34d399',
  },
  {
    id: 'draw-line',
    icon: <LineIcon />,
    label: 'Línea (L)',
    key: 'L',
    activeColor: '#34d399',
  },

  // Data
  {
    id: 'draw-chart',
    icon: <ChartIcon />,
    label: 'Gráfico (C)',
    key: 'C',
    activeColor: '#fbbf24',
  },

  // Divider before utility tools
  { id: '__sep__', icon: null, label: '', separator: true },

  // Table
  {
    id: 'draw-table',
    icon: <TableIcon />,
    label: 'Tabla (B)',
    key: 'B',
    activeColor: '#fb923c',
  },

  // Divider before utility tools
  { id: '__sep__', icon: null, label: '', separator: true },

  // Utility (future / disabled)
  {
    id: '__disabled__',
    icon: <EyedropperIcon />,
    label: 'Cuentagotas (próximamente)',
    disabled: true,
  },
  {
    id: '__disabled__',
    icon: <HandIcon />,
    label: 'Mover vista (próximamente)',
    disabled: true,
  },
  {
    id: '__disabled__',
    icon: <ZoomIcon />,
    label: 'Zoom (próximamente)',
    disabled: true,
  },
]

// ─── SVG icons ────────────────────────────────────────────────────────────────

function PointerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2 L3 12 L6.5 9 L9 14 L10.5 13.3 L8 8.2 L12.5 8.2 Z" fill="currentColor" />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <text x="2" y="13" fontSize="13" fontWeight="700" fontFamily="system-ui" fill="currentColor">T</text>
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <line x1="2" y1="2" x2="14" y2="14" />
      <line x1="14" y1="2" x2="2" y2="14" />
    </svg>
  )
}

function RectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="2.5" y="4" width="11" height="8" rx="1" />
    </svg>
  )
}

function EllipseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <ellipse cx="8" cy="8" rx="5.5" ry="4" />
    </svg>
  )
}

function LineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2.5" y1="13.5" x2="13.5" y2="2.5" strokeLinecap="round" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="8" width="3" height="6" rx="0.5" fill="currentColor" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.5" fill="currentColor" />
      <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <line x1="2" y1="7" x2="14" y2="7" />
      <line x1="8" y1="3" x2="8" y2="13" />
    </svg>
  )
}

function EyedropperIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M10 3 L13 6 L7 12 L4 13 L5 10 Z" strokeLinejoin="round" />
      <line x1="8.5" y1="7.5" x2="11" y2="5" />
    </svg>
  )
}

function HandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M6 7V4a1 1 0 012 0v3M8 7V3.5a1 1 0 012 0V7M10 7V5a1 1 0 012 0v5c0 2-1 3.5-4 3.5S4 12 4 10V8a1 1 0 012 0v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ZoomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="7" cy="7" r="4" />
      <line x1="10" y1="10" x2="13.5" y2="13.5" strokeLinecap="round" />
      <line x1="5" y1="7" x2="9" y2="7" />
      <line x1="7" y1="5" x2="7" y2="9" />
    </svg>
  )
}

// ─── ToolSidebar component ────────────────────────────────────────────────────

interface Props {
  drawMode: DrawMode
  onSetDrawMode: (mode: DrawMode) => void
}

const BG   = '#1a1b1e'
const ITEM = '#2d2f36'

export function ToolSidebar({ drawMode, onSetDrawMode }: Props) {
  return (
    <div style={{
      width: 44,
      flexShrink: 0,
      background: BG,
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 6,
      paddingBottom: 6,
      gap: 2,
      overflowY: 'auto',
      overflowX: 'hidden',
      userSelect: 'none',
      scrollbarWidth: 'none',
    }}>
      {TOOLS.map((tool, i) => {
        // Separator
        if (tool.separator) {
          return (
            <div key={i} style={{
              width: 28, height: 1,
              background: 'rgba(255,255,255,0.08)',
              margin: '4px 0',
              flexShrink: 0,
            }} />
          )
        }

        const isActive = !tool.disabled && tool.id !== '__disabled__' && drawMode === (tool.id as DrawMode)
        const color = isActive ? (tool.activeColor || '#e2e8f0') : tool.disabled ? '#3a3c44' : '#6b7280'

        return (
          <button
            key={i}
            onClick={() => {
              if (tool.disabled || tool.id === '__disabled__') return
              if (tool.id === 'pointer') {
                onSetDrawMode('pointer')
              } else {
                onSetDrawMode(drawMode === tool.id ? 'pointer' : tool.id as DrawMode)
              }
            }}
            title={tool.label}
            style={{
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7,
              background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: isActive ? `1px solid rgba(255,255,255,0.15)` : '1px solid transparent',
              color,
              cursor: tool.disabled ? 'default' : 'pointer',
              transition: 'background 0.12s, color 0.12s',
              flexShrink: 0,
              outline: 'none',
              padding: 0,
              opacity: tool.disabled ? 0.35 : 1,
            }}
            onMouseEnter={e => {
              if (tool.disabled) return
              if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {tool.icon}
          </button>
        )
      })}
    </div>
  )
}
