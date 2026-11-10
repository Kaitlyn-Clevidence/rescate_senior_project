// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-07
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: tests the web app using a fake API and localStorage; 
// uses Vitest and React Testing Library

import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'

const patient = {
  patient_id: 3,
  first_name: 'Aidan',
  last_name: 'Madonna',
  birth_date: '1985-08-20T12:00:00.000Z',
  gender: 'M',
}
const chart = {
  chart_id: 2,
  encounter_date: '2024-02-20T12:00:00.000Z',
  nature_of_call: 'Vehicle Accident',
  patient_name: 'Aidan Madonna',
}

const CACHE_KEY = 'rescate:last-record'
const THIRTY_MIN = 30 * 60 * 1000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Replace fetch with a fake that answers from a table of routes.
const fetchMock = vi.fn()
function mockRoutes(routes: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (url: string) =>
    routes[url] ? routes[url]() : json({ error: 'not found' }, 404),
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function search(user: ReturnType<typeof userEvent.setup>, id: string) {
  const input = screen.getByRole('textbox')
  await user.clear(input)
  if (id) await user.type(input, id)
  await user.click(screen.getByRole('button', { name: 'See Patient Chart' }))
}

async function searchByChart(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.selectOptions(screen.getByRole('combobox'), 'charts')
  await search(user, id)
}

describe('initial page', () => {
  it('shows the title, defaults to a patient lookup, and an empty-state message', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Patient Chart' })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('patients')
    expect(screen.getByRole('textbox')).toHaveValue('1')
    expect(screen.getByText('Patient details will appear here.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('searching by patient number', () => {
  beforeEach(() => {
    mockRoutes({
      '/api/patients/3': () => json(patient),
      '/api/patients/3/charts': () => json([chart]),
    })
  })

  it('fetches the patient and their charts, and shows both', async () => {
    const user = userEvent.setup()
    render(<App />)

    await search(user, '3')

    expect(await screen.findByText('Aidan')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/patients/3')
    expect(fetchMock).toHaveBeenCalledWith('/api/patients/3/charts')
    expect(screen.getByRole('heading', { level: 2, name: 'Charts' })).toBeInTheDocument()
    expect(screen.getByText('Vehicle Accident')).toBeInTheDocument()
  })

  it('submits when Enter is pressed in the number box', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), '3{Enter}')

    expect(await screen.findByText('Aidan')).toBeInTheDocument()
  })

  it('says so when the patient has no charts', async () => {
    mockRoutes({
      '/api/patients/3': () => json(patient),
      '/api/patients/3/charts': () => json([]),
    })
    const user = userEvent.setup()
    render(<App />)

    await search(user, '3')

    expect(await screen.findByText('This patient has no charts yet.')).toBeInTheDocument()
  })

  it('disables the button and shows Loading... while waiting', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    fetchMock.mockImplementation(async (url: string) => {
      await gate
      return url.endsWith('/charts') ? json([]) : json(patient)
    })
    const user = userEvent.setup()
    render(<App />)

    await search(user, '3')

    const button = screen.getByRole('button', { name: 'Loading...' })
    expect(button).toBeDisabled()

    await act(async () => release())
    expect(await screen.findByText('Aidan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See Patient Chart' })).toBeEnabled()
  })
})

describe('searching by chart number', () => {
  it('fetches only that chart and does not show a charts list', async () => {
    mockRoutes({ '/api/charts/2': () => json(chart) })
    const user = userEvent.setup()
    render(<App />)

    await searchByChart(user, '2')

    expect(await screen.findByText('Vehicle Accident')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/charts/2')
    expect(screen.queryByRole('heading', { name: 'Charts' })).not.toBeInTheDocument()
  })

  it('does not rearrange the results just by changing the dropdown', async () => {
    mockRoutes({
      '/api/patients/3': () => json(patient),
      '/api/patients/3/charts': () => json([chart]),
    })
    const user = userEvent.setup()
    render(<App />)
    await search(user, '3')
    await screen.findByText('Aidan')

    await user.selectOptions(screen.getByRole('combobox'), 'charts')

    expect(screen.getByRole('heading', { name: 'Charts' })).toBeInTheDocument()
  })
})

describe('input validation and errors', () => {
  it.each(['0', 'abc', '-3', '1.5', '', '1; DROP TABLE'])(
    'rejects %j without calling the API',
    async (bad) => {
      const user = userEvent.setup()
      render(<App />)

      await search(user, bad)

      expect(screen.getByText('Enter a whole number of 1 or more')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('shows "No record found" when the API returns 404', async () => {
    mockRoutes({})
    const user = userEvent.setup()
    render(<App />)

    await search(user, '999')

    expect(await screen.findByText('No record found with that number')).toBeInTheDocument()
  })

  it('shows the status code for other server errors', async () => {
    mockRoutes({ '/api/charts/2': () => json({ error: 'boom' }, 500) })
    const user = userEvent.setup()
    render(<App />)

    await searchByChart(user, '2')

    expect(await screen.findByText('Request failed (500)')).toBeInTheDocument()
  })

  it('rejects a response that is not an object', async () => {
    mockRoutes({ '/api/charts/2': () => json(['not', 'an', 'object']) })
    const user = userEvent.setup()
    render(<App />)

    await searchByChart(user, '2')

    expect(await screen.findByText('The patient response was invalid')).toBeInTheDocument()
  })

  it('rejects a patient whose charts response is not a list', async () => {
    mockRoutes({
      '/api/patients/3': () => json(patient),
      '/api/patients/3/charts': () => json({ not: 'a list' }),
    })
    const user = userEvent.setup()
    render(<App />)

    await search(user, '3')

    expect(await screen.findByText('The patient response was invalid')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Charts' })).not.toBeInTheDocument()
  })

  it('shows an error when the network is down', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'))
    const user = userEvent.setup()
    render(<App />)

    await searchByChart(user, '2')

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
  })
})

describe('date display', () => {
  it('shows encounter and birth dates as a date only, with no time', async () => {
    mockRoutes({
      '/api/patients/3': () => json(patient),
      '/api/patients/3/charts': () => json([chart]),
    })
    const user = userEvent.setup()
    render(<App />)

    await search(user, '3')

    expect(await screen.findByText('August 20, 1985')).toBeInTheDocument()
    expect(screen.getByText('February 20, 2024')).toBeInTheDocument()
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument()
    expect(screen.queryByText(/T12:00/)).not.toBeInTheDocument()
  })

  it('shows other timestamps with a time', async () => {
    mockRoutes({
      '/api/charts/2': () => json({ ...chart, created_at: '2024-01-15T18:00:00.000Z' }),
    })
    const user = userEvent.setup()
    render(<App />)

    await searchByChart(user, '2')

    expect(await screen.findByText(/Jan 1[56], 2024, \d{1,2}:00\s?[AP]M/)).toBeInTheDocument()
  })

  it('shows a dash for empty values and leaves ordinary text alone', async () => {
    mockRoutes({
      '/api/charts/2': () => json({ ...chart, notes: null }),
    })
    const user = userEvent.setup()
    render(<App />)

    await searchByChart(user, '2')

    expect(await screen.findByText('—')).toBeInTheDocument()
    expect(screen.getByText('Aidan Madonna')).toBeInTheDocument()
  })
})

describe('language switch', () => {
  it('is one switch, off for English', () => {
    render(<App />)

    const toggle = screen.getByRole('switch', { name: 'English / Español' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryAllByRole('switch')).toHaveLength(1)
  })

  it('switches the page to Spanish and back', async () => {
    const user = userEvent.setup()
    render(<App />)
    const toggle = screen.getByRole('switch')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('heading', { level: 1, name: 'Expediente del paciente' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
    expect(document.title).toBe('Expediente del paciente')

    await user.click(toggle)

    expect(screen.getByRole('heading', { level: 1, name: 'Patient Chart' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
  })

  it('shows Spanish dates and messages', async () => {
    mockRoutes({ '/api/charts/2': () => json(chart) })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('switch'))
    await user.selectOptions(screen.getByRole('combobox'), 'charts')
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), '2')
    await user.click(screen.getByRole('button', { name: 'Ver expediente del paciente' }))

    expect(await screen.findByText('20 de febrero de 2024')).toBeInTheDocument()

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), '0')
    await user.click(screen.getByRole('button', { name: 'Ver expediente del paciente' }))

    expect(screen.getByText('Ingrese un número entero de 1 o más')).toBeInTheDocument()
  })
})

describe('theme toggle', () => {
  it('starts on Auto with no forced theme', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('forces dark, then light, then back to auto, and remembers the choice', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('rescate:theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('rescate:theme')).toBe('light')

    await user.click(screen.getByRole('button', { name: 'Auto' }))
    expect(document.documentElement).not.toHaveAttribute('data-theme')
    expect(localStorage.getItem('rescate:theme')).toBeNull()
  })

  it('restores a saved theme on load', () => {
    localStorage.setItem('rescate:theme', 'dark')

    render(<App />)

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ignores a garbage saved theme', () => {
    localStorage.setItem('rescate:theme', 'purple')

    render(<App />)

    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('labels the group in Spanish', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('switch'))

    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Tema' })).getByRole('button', { name: 'Oscuro' })).toBeInTheDocument()
  })
})

describe('30-minute cache', () => {
  function seedCache(overrides: Record<string, unknown> = {}) {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        patient: chart,
        charts: [],
        lookup: 'charts',
        id: '2',
        savedAt: Date.now(),
        ...overrides,
      }),
    )
  }

  it('saves the result after a successful search', async () => {
    mockRoutes({ '/api/charts/2': () => json(chart) })
    const user = userEvent.setup()
    render(<App />)

    await searchByChart(user, '2')
    await screen.findByText('Vehicle Accident')

    const saved = JSON.parse(localStorage.getItem(CACHE_KEY)!)
    expect(saved).toMatchObject({ lookup: 'charts', id: '2', patient: chart })
    expect(screen.getByText(/Chart saved on this device/)).toBeInTheDocument()
  })

  it('restores the last result, and the search box, without calling the API', () => {
    seedCache()

    render(<App />)

    expect(screen.getByText('Vehicle Accident')).toBeInTheDocument()
    expect(screen.getByText('Showing the saved chart while you reconnect.')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('charts')
    expect(screen.getByRole('textbox')).toHaveValue('2')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('restores a patient result with its charts', () => {
    seedCache({ patient, charts: [chart], lookup: 'patients', id: '3' })

    render(<App />)

    expect(screen.getByText('Aidan')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Charts' })).toBeInTheDocument()
    expect(screen.getByText('Vehicle Accident')).toBeInTheDocument()
  })

  it('discards a cache older than 30 minutes', () => {
    seedCache({ savedAt: Date.now() - THIRTY_MIN - 1000 })

    render(<App />)

    expect(screen.getByText('Patient details will appear here.')).toBeInTheDocument()
    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
  })

  it.each([
    ['not JSON', '{oops'],
    ['wrong shape', JSON.stringify({ hello: 'world' })],
    ['bad lookup value', JSON.stringify({ patient: chart, charts: [], lookup: 'users', id: '2', savedAt: Date.now() })],
    ['charts not an array', JSON.stringify({ patient: chart, charts: 'x', lookup: 'charts', id: '2', savedAt: Date.now() })],
  ])('discards a corrupt cache (%s) instead of crashing', (_name, raw) => {
    localStorage.setItem(CACHE_KEY, raw)

    render(<App />)

    expect(screen.getByText('Patient details will appear here.')).toBeInTheDocument()
    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
  })

  it('clears the cache when the 30 minutes pass while the page is open', async () => {
    vi.useFakeTimers()
    seedCache()

    render(<App />)
    expect(screen.getByText(/Chart saved on this device/)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(THIRTY_MIN + 1000)
    })

    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
    expect(screen.queryByText(/Chart saved on this device/)).not.toBeInTheDocument()
  })
})