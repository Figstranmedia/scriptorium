import React, { useState, useEffect } from 'react'

interface Props { store: any }

export function SettingsModal({ store }: Props) {
  const [provider, setProvider] = useState<'claude' | 'ollama'>('claude')
  const [apiKey, setApiKey] = useState('')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.getSettings().then((s: any) => {
      setProvider(s.aiProvider || 'claude')
      setApiKey(s.anthropicApiKey || '')
      setOllamaUrl(s.ollamaUrl || 'http://localhost:11434')
      setOllamaModel(s.ollamaModel || 'llama3')
    })
  }, [])

  const checkOllama = async () => {
    setOllamaStatus('checking')
    const res = await window.api.ollamaListModels()
    if (res.error) {
      setOllamaStatus('error')
    } else {
      setAvailableModels(res.models || [])
      setOllamaStatus('ok')
      if (res.models?.length > 0 && !res.models.includes(ollamaModel)) {
        setOllamaModel(res.models[0])
      }
    }
  }

  const handleSave = async () => {
    await window.api.setSettings({ anthropicApiKey: apiKey, aiProvider: provider, ollamaModel, ollamaUrl })
    store.setApiKeyState(apiKey)
    setSaved(true)
    setTimeout(() => { setSaved(false); store.setShowSettings(false) }, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="bg-ink-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-sans font-semibold">Ajustes — Motor de IA</h2>
          <button onClick={() => store.setShowSettings(false)} className="text-ink-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Provider toggle */}
          <div>
            <p className="text-sm font-sans font-semibold text-ink-700 mb-3">Motor de inteligencia artificial</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setProvider('claude')}
                className={`p-3 rounded-xl border-2 text-left transition ${provider === 'claude' ? 'border-accent-400 bg-accent-50' : 'border-ink-100 hover:border-ink-200'}`}
              >
                <p className="font-sans font-semibold text-sm text-ink-800">☁️ Claude (Anthropic)</p>
                <p className="text-xs text-ink-400 mt-0.5">Requiere API key. Más potente para investigación.</p>
              </button>
              <button
                onClick={() => { setProvider('ollama'); checkOllama() }}
                className={`p-3 rounded-xl border-2 text-left transition ${provider === 'ollama' ? 'border-accent-400 bg-accent-50' : 'border-ink-100 hover:border-ink-200'}`}
              >
                <p className="font-sans font-semibold text-sm text-ink-800">🖥 Ollama (local)</p>
                <p className="text-xs text-ink-400 mt-0.5">Sin costo, privado, funciona sin internet.</p>
              </button>
            </div>
          </div>

          {/* Claude config */}
          {provider === 'claude' && (
            <div>
              <label className="block text-sm font-sans font-semibold text-ink-700 mb-2">
                API Key de Anthropic
              </label>
              <p className="text-xs text-ink-400 font-sans mb-2">
                Obtén tu clave en <span className="text-accent-500">console.anthropic.com</span>
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full text-sm px-3 py-2 rounded-lg border border-ink-200 outline-none focus:border-accent-400 font-mono text-ink-700"
              />
            </div>
          )}

          {/* Ollama config */}
          {provider === 'ollama' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-sans font-semibold text-ink-600 mb-1">URL de Ollama</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-ink-200 outline-none focus:border-accent-400 font-mono"
                  />
                  <button
                    onClick={checkOllama}
                    className="px-3 py-2 rounded-lg bg-ink-100 hover:bg-ink-200 text-ink-600 text-xs font-sans transition"
                  >
                    Verificar
                  </button>
                </div>

                {/* Status */}
                {ollamaStatus === 'checking' && (
                  <p className="text-xs text-ink-400 mt-1 font-sans">Conectando...</p>
                )}
                {ollamaStatus === 'ok' && (
                  <p className="text-xs text-emerald-600 mt-1 font-sans">✓ Ollama disponible — {availableModels.length} modelo{availableModels.length !== 1 ? 's' : ''}</p>
                )}
                {ollamaStatus === 'error' && (
                  <p className="text-xs text-red-500 mt-1 font-sans">✗ No se pudo conectar. ¿Está Ollama corriendo? Ejecuta: <code className="bg-red-50 px-1">ollama serve</code></p>
                )}
              </div>

              <div>
                <label className="block text-xs font-sans font-semibold text-ink-600 mb-1">Modelo</label>
                {availableModels.length > 0 ? (
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-ink-200 outline-none focus:border-accent-400 font-sans"
                  >
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="llama3, mistral, gemma3..."
                    className="w-full text-sm px-3 py-2 rounded-lg border border-ink-200 outline-none focus:border-accent-400 font-sans"
                  />
                )}
                <p className="text-[10px] text-ink-400 mt-1 font-sans">
                  Recomendados: <strong>llama3</strong>, <strong>mistral</strong>, <strong>gemma3</strong>, <strong>qwen2.5</strong>
                </p>
              </div>
            </div>
          )}

          {/* How to use */}
          <div className="bg-ink-50 rounded-lg p-4 text-xs font-sans text-ink-500 space-y-1">
            <p className="font-semibold text-ink-700">Atajos rápidos</p>
            <p>• Selecciona texto → menú flotante → acción de IA</p>
            <p>• <strong>🔬 Investigar</strong> — verifica y sugiere fuentes reales</p>
            <p>• <strong>✍️ Redactar</strong> — 3 opciones de reescritura</p>
            <p>• <strong>🗂 Estructurar</strong> — reorganiza según tipo de documento</p>
            <p>• <strong>⚡ Mejorar</strong> — edita y reemplaza directamente</p>
            <p>• Barra de herramientas → 🖼 para insertar imágenes</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-ink-100 flex justify-end gap-3">
          <button onClick={() => store.setShowSettings(false)} className="px-4 py-2 rounded-lg text-sm font-sans text-ink-500 hover:bg-ink-50 transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className={`px-5 py-2 rounded-lg text-sm font-sans text-white transition ${saved ? 'bg-emerald-500' : 'bg-accent-500 hover:bg-accent-600'}`}
          >
            {saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
