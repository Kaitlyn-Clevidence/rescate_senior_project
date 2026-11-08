// Author(s): Aidan Madonna, Kaitlyn Clevidence
// Start date: 2026-11-05
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: main entry point for the web app; 
// handles the UI and fetches data from the API

import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

type Record_ = Record<string, unknown>
type Language = 'en' | 'es'
type Lookup = 'patients' | 'charts'
type Theme = 'system' | 'light' | 'dark'

const THEME_KEY = 'rescate:theme'

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}
type CachedChart = {
  patient: Record_
  charts: Record_[]
  lookup: Lookup
  id: string
  savedAt: number
}

const CHART_CACHE_KEY = 'rescate:last-record'
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
    themeLabel: 'Theme',
    themeSystem: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
    lookupBy: 'Look up by',
    patientNumber: 'Patient number',
    chartNumber: 'Chart number',
    invalidId: 'Enter a whole number of 1 or more',
    notFound: 'No record found with that number',
    chartsHeading: 'Charts',
    noCharts: 'This patient has no charts yet.',
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
    themeLabel: 'Tema',
    themeSystem: 'Auto',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    lookupBy: 'Buscar por',
    patientNumber: 'Número de paciente',
    chartNumber: 'Número de expediente',
    invalidId: 'Ingrese un número entero de 1 o más',
    notFound: 'No se encontró ningún registro con ese número',
    chartsHeading: 'Expedientes',
    noCharts: 'Este paciente aún no tiene expedientes.',
  },
} as const

// fields that are a calendar date only (no time of day)
const DATE_ONLY_FIELDS = new Set(['encounter_date', 'birth_date'])
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function formatValue(field: string, value: unknown, language: Language): string {
  if (value === null || value === undefined) {
    return '—'
  }

  // dates arrive from the API as ISO text; show them in a readable form
  if (typeof value === 'string' && ISO_DATE_TIME.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      const locale = language === 'es' ? 'es' : 'en-US'
      return DATE_ONLY_FIELDS.has(field)
        ? date.toLocaleDateString(locale, { dateStyle: 'long' })
        : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    }
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
      Date.now() - cached.savedAt >= CHART_CACHE_TTL ||
      !('charts' in cached) ||
      !Array.isArray(cached.charts) ||
      !('lookup' in cached) || !('id' in cached) ||
      (cached.lookup !== 'patients' && cached.lookup !== 'charts') ||
      typeof cached.id !== 'string' 
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

function saveCachedChart(
  patient: Record_,
  charts: Record_[],
  lookup: Lookup,
  id: string,
): CachedChart | null {
  const cached = { patient, charts, lookup, id, savedAt: Date.now() }
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
  const [patient, setPatient] = useState<Record_ | null>(
    initialCache?.patient ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRestored, setIsRestored] = useState(Boolean(initialCache))
  const [isCached, setIsCached] = useState(Boolean(initialCache))
  const cacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lookup, setLookup] = useState<Lookup>(initialCache?.lookup ?? 'patients')
  const [idInput, setIdInput] = useState(initialCache?.id ?? '1')
  const [charts, setCharts] = useState<Record_[]>(initialCache?.charts ?? [])
  // which lookup produced the results on screen (the dropdown can change before searching)
  const [shownLookup, setShownLookup] = useState<Lookup | null>(
    initialCache?.lookup ?? null,
  )
  const text = copy[language]
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)

    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch {
      // storage unavailable (private browsing); the choice just won't persist
    }
  }, [theme])

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

    async function loadRecord(event: React.FormEvent) {
    event.preventDefault()           // stops the form from reloading the page
    const id = idInput.trim()

    if (!/^[1-9]\d*$/.test(id)) {
      setError(text.invalidId)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let next: Record_
      let nextCharts: Record_[] = []

      if (lookup === 'patients') {
        const [patientRes, chartsRes] = await Promise.all([
          fetch(`/api/patients/${id}`),
          fetch(`/api/patients/${id}/charts`),
        ])
        if (patientRes.status === 404) throw new Error(text.notFound)
        if (!patientRes.ok) throw new Error(`Request failed (${patientRes.status})`)
        if (!chartsRes.ok) throw new Error(`Request failed (${chartsRes.status})`)

        const patientData: unknown = await patientRes.json()
        const chartsData: unknown = await chartsRes.json()

        if (
          !patientData ||
          typeof patientData !== 'object' ||
          Array.isArray(patientData) ||
          !Array.isArray(chartsData)
        ) {
          throw new Error(text.invalidResponse)
        }

        next = patientData as Record_
        nextCharts = chartsData as Record_[]
      } else {
        const response = await fetch(`/api/charts/${id}`)

        if (response.status === 404) throw new Error(text.notFound)
        if (!response.ok) throw new Error(`Request failed (${response.status})`)

        const data: unknown = await response.json()

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error(text.invalidResponse)
        }

        next = data as Record_
      }

      setPatient(next)
      setCharts(nextCharts)
      setShownLookup(lookup)
      setIsRestored(false)
      const cached = saveCachedChart(next, nextCharts, lookup, id)
      setIsCached(Boolean(cached))
      if (cached) scheduleCacheExpiry(cached.savedAt)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.unableToLoad)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app">
      <nav className="language-toggle" aria-label="Language">
        <button
          type="button"
          role="switch"
          aria-checked={language === 'es'}
          aria-label={`${text.english} / ${text.spanish}`}
          className="lang-switch"
          onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
        >
          <span className="lang-switch-thumb" aria-hidden="true" />
          <span className="lang-switch-option" aria-hidden="true">EN</span>
          <span className="lang-switch-option" aria-hidden="true">ES</span>
        </button>
        <span className="theme-toggle" role="group" aria-label={text.themeLabel}>
          {(['system', 'light', 'dark'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={theme === option ? 'language-button active' : 'language-button'}
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
            >
              {option === 'system'
                ? text.themeSystem
                : option === 'light'
                  ? text.themeLight
                  : text.themeDark}
            </button>
          ))}
        </span>
      </nav>
      <header className="header">
        <p className="eyebrow">Rescate de San Carlos</p>
        <h1>{text.chart}</h1>
        <p className="intro">{text.intro}</p>
      </header>

      <form className="lookup" onSubmit={loadRecord}>
        <label>
          {text.lookupBy}
          <select value={lookup} onChange={(e) => setLookup(e.target.value as Lookup)}>
            <option value="patients">{text.patientNumber}</option>
            <option value="charts">{text.chartNumber}</option>
          </select>
        </label>
        <label>
          #
          <input
            type="text"
            inputMode="numeric"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
          />
        </label>
        <button type="submit" disabled={isLoading}>
          {isLoading ? text.loading : text.seeChart}
        </button>
      </form>

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
                <dd>{formatValue(field, value, language)}</dd>
              </div>
            ))}
          </dl>
        )}
        {patient && shownLookup === 'patients' && (
          <>
            <h2 className="charts-heading">{text.chartsHeading}</h2>
            {charts.length === 0 && (
              <p className="empty-state">{text.noCharts}</p>
            )}
            {charts.map((chart) => (
              <dl className="patient-fields chart-card" key={String(chart.chart_id)}>
                {Object.entries(chart).map(([field, value]) => (
                  <div className="patient-field" key={field}>
                    <dt>{field.replaceAll('_', ' ')}</dt>
                    <dd>{formatValue(field, value, language)}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </>
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
