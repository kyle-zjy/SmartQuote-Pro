import { useState } from 'react'
import { composeRoomLocation, CUSTOM_ROOM_TYPE, ROOM_TYPE_OPTIONS, splitRoomLocation } from '../../lib/roomTypes'

export default function OpeningLocationStep({
  value,
  originalLocation,
  onNext,
}: {
  value: string
  /** When reusing an existing item, its original location -- shown so staff must confirm/change it. */
  originalLocation?: string
  onNext: (location: string) => void
}) {
  const initial = splitRoomLocation(value)
  const [roomType, setRoomType] = useState(initial.roomType)
  const [detail, setDetail] = useState(initial.detail)

  const location = composeRoomLocation(roomType, detail)
  const detailRequired = roomType === CUSTOM_ROOM_TYPE

  function handleContinue() {
    if (!location) return
    onNext(location)
  }

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
        <p className="muted small">Choose a room type for this opening.</p>
      )}

      <div className="field-row">
        <label>
          Room type
          <select value={roomType} onChange={(e) => setRoomType(e.target.value)} autoFocus>
            <option value="" disabled>
              Select room type
            </option>
            {ROOM_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={CUSTOM_ROOM_TYPE}>{CUSTOM_ROOM_TYPE}</option>
          </select>
        </label>
        {roomType ? (
          <label>
            {detailRequired ? 'Location name' : 'Number or name (optional)'}
            <input
              type="text"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={detailRequired ? 'e.g. Study, Patio' : 'e.g. 1, Main'}
              autoFocus={detailRequired}
            />
          </label>
        ) : null}
      </div>

      <div className="wizard-actions">
        <button type="button" className="primary-button" onClick={handleContinue} disabled={!location}>
          Continue
        </button>
      </div>
    </div>
  )
}
