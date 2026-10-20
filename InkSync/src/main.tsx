import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted, so there is no third-party font request. Shantell Sans is the
// hand: `full` carries its informality and bounce axes, which the stylesheet
// turns up for headings. Courier Prime is the typewriter for codes and labels.
import '@fontsource-variable/shantell-sans/full.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import './index.css'
import App from './App.tsx'
import { installSound } from './lib/sound'

installSound()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
