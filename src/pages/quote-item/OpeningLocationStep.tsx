import { useState } from 'react'
import { ROOM_TYPES } from '../../lib/roomTypes'

export default function OpeningLocationStep({
  value,
  existingLocations,
  onNext,
}: {
  value: string
  existingLocations: string[]
  onNext: (location: string) => void
}) {
  const [text, setText] = useState(value)

  function handleContinue() {
    if (!text.trim()) return
    onNext(text.trim())
  }

  return (
    <div className="calculator">
      <h2>Where is this opening?</h2>
      <p className="muted small">
        Pick a location already used on this quote, choose a common room, or type your own.
      </p>

      {existingLocations.length > 0 && (
        <>
          <p className="small">Used on this quote</p>
          <div className="tabs">
            {existingLocations.map((location) => (
              <button
                key={location}
                type="button"
                className={`tab${text === location ? ' tab--active' : ''}`}
                onClick={() => setText(location)}
              >
                {location}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="small">Common rooms</p>
      <div className="tabs">
        {ROOM_TYPES.map((room) => (
          <button
            key={room}
            type="button"
            className={`tab${text === room ? ' tab--active' : ''}`}
            onClick={() => setText(room)}
          >
            {room}
          </button>
        ))}
      </div>

      <label className="field-row__single">
        Location
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Living Room, Rear sliding door"
          autoFocus
        />
      </label>

      <div className="wizard-actions">
        <button type="button" className="primary-button" onClick={handleContinue} disabled={!text.trim()}>
          Continue
        </button>
      </div>
    </div>
  )
}
