import { useMemo, useRef, useState } from 'react'
import { isNumberedRoomType, nextRoomNumber, normalizeLocationKey, ROOM_TYPE_OPTIONS } from '../../lib/roomTypes'

interface Suggestion {
  label: string
  group: 'Used on this quote' | 'Common rooms'
}

function buildSuggestions(text: string, existingLocations: string[]): Suggestion[] {
  const query = normalizeLocationKey(text)
  const seen = new Set<string>()
  const suggestions: Suggestion[] = []

  for (const location of existingLocations) {
    const trimmed = location.trim()
    const key = normalizeLocationKey(trimmed)
    if (!trimmed || seen.has(key)) continue
    if (query && !key.includes(query)) continue
    seen.add(key)
    suggestions.push({ label: trimmed, group: 'Used on this quote' })
  }

  for (const roomType of ROOM_TYPE_OPTIONS) {
    const key = normalizeLocationKey(roomType)
    if (seen.has(key)) continue
    if (query && !key.includes(query)) continue
    seen.add(key)
    suggestions.push({ label: roomType, group: 'Common rooms' })
  }

  return suggestions
}

export default function OpeningLocationStep({
  value,
  existingLocations,
  originalLocation,
  onNext,
}: {
  value: string
  existingLocations: string[]
  /** When reusing an existing item, its original location. Shown so staff must confirm/change it. */
  originalLocation?: string
  onNext: (location: string) => void
}) {
  const [text, setText] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => buildSuggestions(text, existingLocations), [text, existingLocations])

  function selectSuggestion(label: string) {
    const nextValue =
      ROOM_TYPE_OPTIONS.includes(label) && isNumberedRoomType(label)
        ? `${label} ${nextRoomNumber(label, existingLocations)}`
        : label
    setText(nextValue)
    setIsOpen(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setActiveIndex(0)
        return
      }
      setActiveIndex((i) => (suggestions.length === 0 ? -1 : (i + 1) % suggestions.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) return
      setActiveIndex((i) => (suggestions.length === 0 ? -1 : (i - 1 + suggestions.length) % suggestions.length))
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault()
        selectSuggestion(suggestions[activeIndex].label)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  function handleContinue() {
    if (!text.trim()) return
    onNext(text.trim())
  }

  let lastGroup: string | null = null

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
          Enter or pick a location.
        </p>
      )}

      <label className="field-row__single location-autocomplete">
        {originalLocation ? 'Use at' : 'Location'}
        <div className="location-autocomplete__control">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setIsOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Bedroom, Kitchen"
            autoFocus
            autoComplete="off"
          />
          {isOpen && suggestions.length > 0 ? (
            <ul className="location-autocomplete__list" role="listbox">
              {suggestions.map((suggestion, index) => {
                const showGroupHeader = suggestion.group !== lastGroup
                lastGroup = suggestion.group
                return (
                  <li key={`${suggestion.group}-${suggestion.label}`}>
                    {showGroupHeader ? <p className="location-autocomplete__group">{suggestion.group}</p> : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`location-autocomplete__option${index === activeIndex ? ' location-autocomplete__option--active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(suggestion.label)}
                    >
                      {suggestion.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </label>
      <p className="muted small">Tip: For bedrooms or bathrooms, numbering is autofilled on selection, starting at 1.</p>

      <div className="wizard-actions">
        <button type="button" className="primary-button" onClick={handleContinue} disabled={!text.trim()}>
          Continue
        </button>
      </div>
    </div>
  )
}
