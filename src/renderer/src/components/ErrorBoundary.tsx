import React from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Scriptorium] Error no capturado:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh',
          background: '#1a1714', color: '#e5e0d8',
          fontFamily: 'system-ui, Figtree, sans-serif', gap: 12,
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Algo salió mal</h1>
          <p style={{
            fontSize: 12, color: '#9ca3af', margin: 0,
            maxWidth: 420, textAlign: 'center', lineHeight: 1.5,
          }}>
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '7px 18px', background: '#d4522b', color: 'white',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              }}
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '7px 18px', background: 'transparent', color: '#9ca3af',
                border: '1px solid #374151', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
