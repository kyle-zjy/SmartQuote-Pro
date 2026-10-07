import { useMemo, useRef, useState } from 'react'
import { normalizeLocationKey, ROOM_TYPE_OPTIONS } from '../../lib/roomTypes'

function buildSuggestions(text: string): string[] {
  const query = normalizeLocationKey(text)
  return ROOM_TYPE_OPTIONS.filter((roomType) => !query || normalizeLocationKey(roomType).includes(query))
}

export default function OpeningLocationStep({
  value,
  originalLocation,
  onNext,
}: {
  value: string
  /** When reusing an existing item, its original location. Shown so staff must confirm/change it. */
  originalLocation?: string
  onNext: (location: string) => void
}) {
  const [text, setText] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => buildSuggestions(text), [text])

  function selectSuggestion(label: string) {
    setText(label)
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
        selectSuggestion(suggestions[activeIndex])
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
            placeholder="e.g. Bedroom #1, Kitchen"
            autoFocus
            autoComplete="off"
          />
          {isOpen && suggestions.length > 0 ? (
            <ul className="location-autocomplete__list" role="listbox">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`location-autocomplete__option${index === activeIndex ? ' location-autocomplete__option--active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>

      <div className="wizard-actions">
        <button type="button" className="primary-button" onClick={handleContinue} disabled={!text.trim()}>
          Continue
        </button>
      </div>
    </div>
  )
}
