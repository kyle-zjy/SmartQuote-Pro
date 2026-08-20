import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { QuoteProvider } from './lib/quoteContext'
import { PricingProvider } from './lib/pricingContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PricingProvider>
        <QuoteProvider>
          <App />
        </QuoteProvider>
      </PricingProvider>
    </BrowserRouter>
  </StrictMode>,
)
