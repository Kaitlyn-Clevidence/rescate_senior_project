import { useEffect, useState } from 'react'
import './App.css'

type Patient = Record<string, unknown>
type Language = 'en' | 'es'

const copy = {
  en: {
    chart: 'Patient Chart',
    intro: 'View the patient record for the next encounter.',
    loading: 'Loading...',
    seeChart: 'See Patient Chart',
    empty: 'Patient details will appear here.',
    invalidResponse: 'The patient response was invalid',
    unableToLoad: 'Unable to load the patient chart',
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

function App() {
  const [language, setLanguage] = useState<Language>('en')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const text = copy[language]

  useEffect(() => {
    document.documentElement.lang = language
    document.title = text.chart
  }, [language, text.chart])

  async function loadPatient() {
    setIsLoading(true)
    setError(null)
    setPatient(null)

    try {
      const response = await fetch('/api/patients/1')

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`)
      }

      const data: unknown = await response.json()

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(text.invalidResponse)
      }

      setPatient(data as Patient)
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

      <section className="display" aria-live="polite">
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
      </section>
    </main>
  )
}

export default App
