import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/signika/latin-400.css'
import '@fontsource/signika/latin-600.css'
import './styles/globals.css'
import App from './app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
