import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

type Patient = Record<string, unknown>
type Language = 'en' | 'es'
type CachedChart = {
  patient: Patient
  savedAt: number
}

const CHART_CACHE_KEY = 'rescate:patient-chart:1'
const CHART_CACHE_TTL = 30 * 60 * 1000

const copy = {
  en: {
    chart: 'Patient Chart',
    intro: 'View the patient record for the next encounter.',
    loading: 'Loading...',
    seeChart: 'See Patient Chart',
    empty: 'Patient details will appear here.',
    invalidResponse: 'The patient response was invalid',
    unableToLoad: 'Unable to load the patient chart',
    restored: 'Showing the saved chart while you reconnect.',
    saved: 'Chart saved on this device. It will be discarded after 30 minutes away.',
    english: 'English',
    spanish: 'Español',
  },
  es: {
    chart: 'Expediente del paciente',
    intro: 'Consulte el expediente del paciente para el próximo encuentro.',
    loading: 'Cargando...',
    seeChart: 'Ver expediente del paciente',
    empty: 'Los datos del paciente aparecerán aquí.',
    invalidResponse: 'La respuesta del paciente no es válida',
    unableToLoad: 'No se pudo cargar el expediente del paciente',
    restored: 'Se muestra el expediente guardado mientras se reconecta.',
    saved: 'Expediente guardado en este dispositivo. Se eliminará después de 30 minutos de ausencia.',
    english: 'English',
    spanish: 'Español',
  },
} as const

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function readCachedChart(): CachedChart | null {
  try {
    const stored = localStorage.getItem(CHART_CACHE_KEY)
    if (!stored) return null

    const cached: unknown = JSON.parse(stored)
    if (
      !cached ||
      typeof cached !== 'object' ||
      !('patient' in cached) ||
      !('savedAt' in cached) ||
      typeof cached.savedAt !== 'number' ||
      typeof cached.patient !== 'object' ||
      cached.patient === null ||
      Array.isArray(cached.patient) ||
      Date.now() - cached.savedAt >= CHART_CACHE_TTL
    ) {
      localStorage.removeItem(CHART_CACHE_KEY)
      return null
    }

    return cached as CachedChart
  } catch {
    localStorage.removeItem(CHART_CACHE_KEY)
    return null
  }
}

function saveCachedChart(patient: Patient): CachedChart | null {
  const cached = { patient, savedAt: Date.now() }
  try {
    localStorage.setItem(CHART_CACHE_KEY, JSON.stringify(cached))
    return cached
  } catch {
    return null
  }
}

function discardCachedChart() {
  try {
    localStorage.removeItem(CHART_CACHE_KEY)
  } catch {
    // Storage may be unavailable in private browsing contexts.
  }
}

function App() {
  const [initialCache] = useState<CachedChart | null>(readCachedChart)
  const [language, setLanguage] = useState<Language>('en')
  const [patient, setPatient] = useState<Patient | null>(
    initialCache?.patient ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRestored, setIsRestored] = useState(Boolean(initialCache))
  const [isCached, setIsCached] = useState(Boolean(initialCache))
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const text = copy[language]

  useEffect(() => {
    document.documentElement.lang = language
    document.title = text.chart
  }, [language, text.chart])

  const scheduleCacheExpiry = useCallback((savedAt: number) => {
    if (cacheTimer.current) clearTimeout(cacheTimer.current)

    const remaining = CHART_CACHE_TTL - (Date.now() - savedAt)
    if (remaining <= 0) {
      discardCachedChart()
      return
    }

    cacheTimer.current = setTimeout(() => {
      discardCachedChart()
      setIsCached(false)
    }, remaining)
  }, [])

  useEffect(() => {
    if (initialCache) scheduleCacheExpiry(initialCache.savedAt)

    return () => {
      if (cacheTimer.current) clearTimeout(cacheTimer.current)
    }
  }, [initialCache, scheduleCacheExpiry])

  async function loadPatient() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/patients/1')

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }

      const data: unknown = await response.json()

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(text.invalidResponse)
      }

      const nextPatient = data as Patient
      setPatient(nextPatient)
      setIsRestored(false)
      const cached = saveCachedChart(nextPatient)
      setIsCached(Boolean(cached))
      if (cached) scheduleCacheExpiry(cached.savedAt)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : text.unableToLoad,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app">
      <nav className="language-toggle" aria-label="Language">
        <button
          type="button"
          className={language === 'en' ? 'language-button active' : 'language-button'}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
        >
          {text.english}
        </button>
        <button
          type="button"
          className={language === 'es' ? 'language-button active' : 'language-button'}
          aria-pressed={language === 'es'}
          onClick={() => setLanguage('es')}
        >
          {text.spanish}
        </button>
      </nav>
      <header className="header">
        <p className="eyebrow">Rescate de San Carlos</p>
        <h1>{text.chart}</h1>
        <p className="intro">{text.intro}</p>
      </header>

      <button type="button" onClick={loadPatient} disabled={isLoading}>
        {isLoading ? text.loading : text.seeChart}
      </button>

      <section
        className="display"
        aria-busy={isLoading}
        aria-live="polite"
        aria-label={text.chart}
      >
        {isRestored && <p className="cache-notice" role="status">{text.restored}</p>}
        {error && <p className="error">{error}</p>}
        {patient && (
          <dl className="patient-fields">
            {Object.entries(patient).map(([field, value]) => (
              <div className="patient-field" key={field}>
                <dt>{field.replaceAll('_', ' ')}</dt>
                <dd>{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        {!patient && !error && !isLoading && (
          <p className="empty-state">{text.empty}</p>
        )}
        {isCached && <p className="cache-status" role="status">{text.saved}</p>}
      </section>
    </main>
  )
}

export default App
