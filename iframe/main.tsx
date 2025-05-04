import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/App.css'
import React from 'react'
import ScoreViewerWrapper from './ScoreViewerWrapper'


// Use a wrapper class to fetch the configuration
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScoreViewerWrapper />
  </StrictMode>,
)