/**
 * React entry point.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

import './index.css'  // dogfood-fix 1 続編 4: グローバル reset (viewport 固定 + no page scroll)

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('root element not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
