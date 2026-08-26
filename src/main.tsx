/// <reference types="vite/client" />

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CompanySettingsProvider } from './lib/companySettings'
import { QuoteProvider } from './lib/quoteContext'
import { PricingProvider } from './lib/pricingContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
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
