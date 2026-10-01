import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_PANELS_FILTER,
  MAX_PANELS_FILTER_HINGED,
  MIN_PANELS_FILTER,
  filterConfigs,
  type ConfigDirectionFilter,
  type ConfigOperationFilter,
  type ConfigPanelsFilter,
  type ConfigTypeFilter,
} from '../../lib/configurationFilters'
import { QUOTE_SHEET, configLabel } from '../../lib/quoteSheet'
import { sheetCodeImage } from '../../lib/sheetCodeImages'

export default function ConfigurationPicker({
  value,
  onNext,
  onBack,
}: {
  value: string
  onNext: (code: string) => void
  onBack: () => void
}) {
  const [type, setType] = useState<ConfigTypeFilter | undefined>(undefined)
  const [operation, setOperation] = useState<ConfigOperationFilter | undefined>(undefined)
  const [panels, setPanels] = useState<ConfigPanelsFilter | undefined>(undefined)
  const [direction, setDirection] = useState<ConfigDirectionFilter | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  const isWindow = type === 'window'
  const maxPanels = operation === 'hinged' ? MAX_PANELS_FILTER_HINGED : MAX_PANELS_FILTER

  function toggleWindows() {
    if (isWindow) {
      setType(undefined)
      return
    }
    setType('window')
    setOperation(undefined)
    setPanels(undefined)
    setDirection(undefined)
  }

  function chooseOperation(next: ConfigOperationFilter) {
    const nextOperation = operation === next ? undefined : next
    setOperation(nextOperation)
    if (nextOperation === 'hinged' && panels !== undefined && panels > MAX_PANELS_FILTER_HINGED) {
      setPanels(MAX_PANELS_FILTER_HINGED)
    }
  }

  function chooseDirection(next: ConfigDirectionFilter) {
    setDirection(direction === next ? undefined : next)
  }

  const activeFilterCount = [type, operation, panels, direction].filter((v) => v !== undefined).length

  useEffect(() => {
    if (!filterOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFilterOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [filterOpen])

  const configs = useMemo(
    () => filterConfigs(QUOTE_SHEET.configs, { type, operation, panels, direction, search }),
    [type, operation, panels, direction, search],
  )

  return (
    <div className="wizard-panel">
      <h2>Pick a configuration</h2>
      <p className="muted small">Filter by type, then pick the drawing that matches this opening.</p>

      <div className="search-filter-row" ref={filterRef}>
        <input
          type="text"
          className="search-filter-row__input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search e.g. SDOX, hinged"
          aria-label="Search configurations"
        />
        <button
          type="button"
          className="filter-trigger"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((open) => !open)}
        >
          Filter
          {activeFilterCount > 0 && <span className="filter-trigger__badge">{activeFilterCount}</span>}
        </button>

        {filterOpen && (
          <div className="filter-popover" role="dialog" aria-label="Configuration filters">
            <div className="filter-popover__row">
              <button type="button" className={`tab${isWindow ? ' tab--active' : ''}`} onClick={toggleWindows}>
                Windows
              </button>
            </div>

            <div className="filter-popover__row">
              <button
                type="button"
                className={`tab${operation === 'hinged' ? ' tab--active' : ''}`}
                disabled={isWindow}
                onClick={() => chooseOperation('hinged')}
              >
                Hinged
              </button>
              <button
                type="button"
                className={`tab${operation === 'sliding' ? ' tab--active' : ''}`}
                disabled={isWindow}
                onClick={() => chooseOperation('sliding')}
              >
                Slide
              </button>
            </div>

            <div className="filter-popover__section">
              <div className="filter-popover__label">
                <span>Panel count</span>
                <span className="muted small">{panels ?? 'Any'}</span>
              </div>
              <input
                type="range"
                min={MIN_PANELS_FILTER}
                max={maxPanels}
                step={1}
                value={panels ?? MIN_PANELS_FILTER}
                disabled={isWindow}
                onChange={(e) => setPanels(Number(e.target.value))}
                aria-label="Panel count"
              />
            </div>

            <div className="filter-popover__row">
              <button
                type="button"
                className={`tab${direction === 'LHS' ? ' tab--active' : ''}`}
                disabled={isWindow}
                onClick={() => chooseDirection('LHS')}
              >
                LHS
              </button>
              <button
                type="button"
                className={`tab${direction === 'RHS' ? ' tab--active' : ''}`}
                disabled={isWindow}
                onClick={() => chooseDirection('RHS')}
              >
                RHS
              </button>
            </div>

            <div className="filter-popover__footer">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setType(undefined)
                  setOperation(undefined)
                  setPanels(undefined)
                  setDirection(undefined)
                }}
              >
                Clear filters
              </button>
              <button type="button" className="secondary-button" onClick={() => setFilterOpen(false)}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>

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
