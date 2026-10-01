import { useMemo, useState } from 'react'
import {
  filterConfigs,
  type ConfigDirectionFilter,
  type ConfigOperationFilter,
  type ConfigPanelsFilter,
  type ConfigTypeFilter,
} from '../../lib/configurationFilters'
import { QUOTE_SHEET, configLabel } from '../../lib/quoteSheet'
import { sheetCodeImage } from '../../lib/sheetCodeImages'
import { usePricing } from '../../lib/pricingContext'
import { compatibleCategories } from './itemDraft'

export default function ConfigurationPicker({
  value,
  productKey,
  onNext,
  onBack,
}: {
  value: string
  productKey?: string
  onNext: (code: string) => void
  onBack: () => void
}) {
  const { data } = usePricing()
  const product = data.products.find((candidate) => candidate.key === productKey)
  const [type, setType] = useState<ConfigTypeFilter | undefined>(undefined)
  const [operation, setOperation] = useState<ConfigOperationFilter | undefined>(undefined)
  const [panels, setPanels] = useState<ConfigPanelsFilter | undefined>(undefined)
  const [direction, setDirection] = useState<ConfigDirectionFilter | undefined>(undefined)
  const [search, setSearch] = useState('')

  function handleTypeChange(nextType: ConfigTypeFilter | undefined) {
    setType(nextType)
    setOperation(undefined)
    if (nextType === 'window') {
      setPanels(undefined)
      setDirection(undefined)
    }
  }

  const configs = useMemo(
    () => filterConfigs(QUOTE_SHEET.configs, { type, operation, panels, direction, search })
      .filter((config) => !product || compatibleCategories(product, config.code).length > 0),
    [type, operation, panels, direction, search, product],
  )

  return (
    <div className="wizard-panel">
      <h2>Pick a configuration</h2>
      <p className="muted small">Filter by type, then pick the drawing that matches this opening.</p>

      <div className="tabs">
        <button type="button" className={`tab${type === undefined ? ' tab--active' : ''}`} onClick={() => handleTypeChange(undefined)}>
          All types
        </button>
        <button type="button" className={`tab${type === 'door' ? ' tab--active' : ''}`} onClick={() => handleTypeChange('door')}>
          Doors
        </button>
        <button type="button" className={`tab${type === 'window' ? ' tab--active' : ''}`} onClick={() => handleTypeChange('window')}>
          Windows
        </button>
      </div>

      {type === 'door' && (
        <div className="tabs">
          <button
            type="button"
            className={`tab${operation === undefined ? ' tab--active' : ''}`}
            onClick={() => setOperation(undefined)}
          >
            Any operation
          </button>
          <button
            type="button"
            className={`tab${operation === 'hinged' ? ' tab--active' : ''}`}
            onClick={() => setOperation('hinged')}
          >
            Hinged
          </button>
          <button
            type="button"
            className={`tab${operation === 'sliding' ? ' tab--active' : ''}`}
            onClick={() => setOperation('sliding')}
          >
            Sliding
          </button>
        </div>
      )}

      {type !== 'window' && (
        <>
          <div className="tabs">
            <button type="button" className={`tab${panels === undefined ? ' tab--active' : ''}`} onClick={() => setPanels(undefined)}>
              Any panels
            </button>
            {([1, 2, '3+'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`tab${panels === option ? ' tab--active' : ''}`}
                onClick={() => setPanels(option)}
              >
                {option} panel{option === 1 ? '' : 's'}
              </button>
            ))}
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab${direction === undefined ? ' tab--active' : ''}`}
              onClick={() => setDirection(undefined)}
            >
              Any direction
            </button>
            <button
              type="button"
              className={`tab${direction === 'LHS' ? ' tab--active' : ''}`}
              onClick={() => setDirection('LHS')}
            >
              LHS
            </button>
            <button
              type="button"
              className={`tab${direction === 'RHS' ? ' tab--active' : ''}`}
              onClick={() => setDirection('RHS')}
            >
              RHS
            </button>
          </div>
        </>
      )}

      <label className="field-row__single">
        Search
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. SDOX, hinged"
        />
      </label>

      <div className="card-grid">
        {configs.map((config) => {
          const src = sheetCodeImage(config.code)
          return (
            <button
              key={config.code}
              type="button"
              className={`card product-card sheet-config-card${value === config.code ? ' is-selected' : ''}`}
              onClick={() => onNext(config.code)}
            >
              {src ? <img src={src} alt="" /> : null}
              <h3>{config.code}</h3>
              <p className="muted">
                {configLabel(config.code)} · {config.panels} panel{config.panels === 1 ? '' : 's'}
              </p>
            </button>
          )
        })}
        {configs.length === 0 && <p className="muted">No configurations match these filters.</p>}
      </div>

      <div className="wizard-actions">
        <button type="button" className="link-button" onClick={onBack}>
          &larr; Back
        </button>
      </div>
    </div>
  )
}
