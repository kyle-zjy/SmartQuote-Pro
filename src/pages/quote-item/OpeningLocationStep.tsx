import { useState } from 'react'
import { BATHROOM_LOCATIONS, BEDROOM_LOCATIONS, COMMON_LOCATIONS, normalizeLocationKey } from '../../lib/roomTypes'

function LocationTabs({
  label,
  locations,
  selectedKey,
  onSelect,
}: {
  label: string
  locations: string[]
  selectedKey: string
  onSelect: (location: string) => void
}) {
  if (locations.length === 0) return null
  return (
    <div className="location-picker__section">
      <p className="small location-picker__label">{label}</p>
      <div className="tabs">
        {locations.map((location) => (
          <button
            key={location}
            type="button"
            className={`tab${normalizeLocationKey(location) === selectedKey ? ' tab--active' : ''}`}
            onClick={() => onSelect(location)}
          >
            {location}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function OpeningLocationStep({
  value,
  existingLocations,
  originalLocation,
  onNext,
}: {
  value: string
  existingLocations: string[]
  /** When reusing an existing item, its original location -- shown so staff must confirm/change it. */
  originalLocation?: string
  onNext: (location: string) => void
}) {
  const [text, setText] = useState(value)

  function handleContinue() {
    if (!text.trim()) return
    onNext(text.trim())
  }

  const selectedKey = normalizeLocationKey(text)
  const existingKeys = new Set(existingLocations.map(normalizeLocationKey))
  const commonPresets = COMMON_LOCATIONS.filter((l) => !existingKeys.has(normalizeLocationKey(l)))
  const bedroomPresets = BEDROOM_LOCATIONS.filter((l) => !existingKeys.has(normalizeLocationKey(l)))
  const bathroomPresets = BATHROOM_LOCATIONS.filter((l) => !existingKeys.has(normalizeLocationKey(l)))

  return (
    <div className="calculator">
      <h2>Where is this opening?</h2>

      {originalLocation ? (
        <div className="reuse-location-banner">
          <p className="small">Reuse item</p>
          <p>
            Original location: <strong>{originalLocation}</strong>
          </p>
          <p className="small">Confirm this location again, or use at a different room below.</p>
        </div>
      ) : (
        <p className="muted small">
          Pick a location already used on this quote, choose a common room, or add your own.
        </p>
      )}

      <LocationTabs
        label="Existing locations"
        locations={existingLocations}
        selectedKey={selectedKey}
        onSelect={setText}
      />
      <LocationTabs label="Common locations" locations={commonPresets} selectedKey={selectedKey} onSelect={setText} />
      <LocationTabs label="Bedrooms" locations={bedroomPresets} selectedKey={selectedKey} onSelect={setText} />
      <LocationTabs label="Bathrooms" locations={bathroomPresets} selectedKey={selectedKey} onSelect={setText} />

      <label className="field-row__single">
        {originalLocation ? 'Use at' : 'Location'}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Master Bedroom, Study, Patio"
          autoFocus
        />
      </label>
      <p className="muted small">+ Add custom location by typing it above -- it will be reusable next time too.</p>

      <div className="wizard-actions">
        <button type="button" className="primary-button" onClick={handleContinue} disabled={!text.trim()}>
          Continue
        </button>
      </div>
    </div>
  )
}
