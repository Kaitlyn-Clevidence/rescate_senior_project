import { useState } from 'react'
import './App.css'

type Patient = Record<string, unknown>

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
  const [patient, setPatient] = useState<Patient | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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
        throw new Error('The patient response was invalid')
      }

      setPatient(data as Patient)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load the patient chart',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="header">
        <p className="eyebrow">Rescate de San Carlos</p>
        <h1>Patient Chart</h1>
        <p className="intro">View the patient record for the next encounter.</p>
      </header>

      <button type="button" onClick={loadPatient} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'See Patient Chart'}
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
          <p className="empty-state">Patient details will appear here.</p>
        )}
      </section>
    </main>
  )
}

export default App
