/// <reference types="vite/client" />

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CompanySettingsProvider } from './lib/companySettings'
import { QuoteProvider } from './lib/quoteContext'
import { PricingProvider } from './lib/pricingContext'
import './index.css'

const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <CompanySettingsProvider>
        <PricingProvider>
          <QuoteProvider>
            <App />
          </QuoteProvider>
        </PricingProvider>
      </CompanySettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
