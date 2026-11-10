// Author(s): Aidan Madonna
// Start date: 2026-11-05
// Last updated: 2026-11-05
// P4: Prototype 
// Purpose: entry point for the web app; 
// renders the App component into the root div

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
