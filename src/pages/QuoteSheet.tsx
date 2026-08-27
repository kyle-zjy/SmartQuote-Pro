import { Link } from 'react-router-dom'
import {
  QUOTE_SHEET,
  configFamily,
  configLabel,
} from '../lib/quoteSheet'
import { sheetCodeImage } from '../lib/sheetCodeImages'

const FAMILIES: Array<{ key: ReturnType<typeof configFamily>; title: string }> = [
  { key: 'hinged', title: 'Hinged doors' },
  { key: 'sliding', title: 'Sliding doors' },
  { key: 'window', title: 'Windows' },
]

export default function QuoteSheet() {
  return (
    <div>
      <h1>Quote sheet</h1>
      <p className="muted">
        Pick a configuration drawing. Next you will mark the measure points on the picture and type the sizes.
      </p>
      {FAMILIES.map((family) => {
        const configs = QUOTE_SHEET.configs.filter((config) => configFamily(config.code) === family.key)
        if (configs.length === 0) return null
        return (
          <section key={family.key} className="sheet-family">
            <h2>{family.title}</h2>
            <div className="card-grid">
              {configs.map((config) => {
                const src = sheetCodeImage(config.code)
                return (
                  <Link key={config.code} to={`/sheet/${encodeURIComponent(config.code)}`} className="card product-card sheet-config-card">
                    {src ? <img src={src} alt="" /> : null}
                    <h3>{config.code}</h3>
                    <p className="muted">
                      {configLabel(config.code)} · {config.panels} panel{config.panels === 1 ? '' : 's'}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
