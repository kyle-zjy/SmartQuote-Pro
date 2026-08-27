import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import SheetDiagram, { type DiagramTool } from '../components/SheetDiagram'
import {
  calcSheetSize,
  configLabel,
  findSheetConfig,
  formatSheetMm,
  measureKeys,
  measurePoints,
  openingFromMeasures,
  suggestedScreenType,
} from '../lib/quoteSheet'
import { sheetCodeImage } from '../lib/sheetCodeImages'
import { loadMeasureDraft, saveMeasureDraft } from '../lib/sheetMeasureStore'

export default function SheetMeasure() {
  const code = decodeURIComponent(useParams().code ?? '')
  const config = findSheetConfig(code)
  const image = sheetCodeImage(code)
  const points = config ? measurePoints(config) : { heights: [] as string[], widths: [] as string[] }
  const keys = config ? measureKeys(config) : []

  const [draft, setDraft] = useState(() => loadMeasureDraft(code, suggestedScreenType(code)))
  const [selected, setSelected] = useState<string | null>(keys[0] ?? null)
  const [tool, setTool] = useState<DiagramTool>('brush')
  const [brushColor, setBrushColor] = useState('#b91c1c')
  const [brushSize, setBrushSize] = useState(1.6)
  const [saved, setSaved] = useState(false)
  const skipSave = useRef(true)

  useEffect(() => {
    skipSave.current = true
    const next = findSheetConfig(code)
    setDraft(loadMeasureDraft(code, suggestedScreenType(code)))
    setSelected(next ? (measureKeys(next)[0] ?? null) : null)
    setTool('brush')
    setSaved(false)
  }, [code])

  useEffect(() => {
    if (!config) return
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    const timer = window.setTimeout(() => saveMeasureDraft(code, draft), 300)
    return () => window.clearTimeout(timer)
  }, [code, config, draft])

  const opening = useMemo(() => openingFromMeasures(draft.values), [draft.values])
  const size = config && opening ? calcSheetSize(config, opening.height, opening.width) : null
  const missingMarks = keys.filter((key) => !draft.markers[key])
  const missingValues = keys.filter((key) => !(Number(draft.values[key]) > 0))

  if (!config || !image) {
    return <Navigate to="/sheet" replace />
  }

  function setValue(key: string, value: string) {
    setDraft((current) => ({ ...current, values: { ...current.values, [key]: value } }))
    setSaved(false)
  }

  function handleSave() {
    saveMeasureDraft(code, draft)
    setSaved(true)
  }

  return (
    <div className="sheet-measure">
      <p>
        <Link to="/sheet">&larr; Back to configurations</Link>
      </p>
      <h1>{config.code}</h1>
      <p className="muted">
        {configLabel(config.code)} · {config.panels} panel{config.panels === 1 ? '' : 's'}
      </p>
      <p className="muted small">
        Brush is selected first so you can draw on the picture. Click H1 / W1 to drop measure marks. Eraser only
        removes drawing, not the marks.
      </p>

      <div className="sheet-measure__layout">
        <section>
          <div className="sheet-point-tabs">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                className={`tab${tool === 'mark' && selected === key ? ' tab--active' : ''}${draft.markers[key] ? ' tab--marked' : ''}`}
                onClick={() => {
                  setTool('mark')
                  setSelected(key)
                }}
              >
                {key}
                {draft.values[key] ? ` ${draft.values[key]}` : ''}
              </button>
            ))}
          </div>
          <div className="sheet-draw-tools">
            <button
              type="button"
              className={`tab sheet-tool-tab${tool === 'brush' ? ' tab--active' : ''}`}
              onClick={() => setTool('brush')}
            >
              <BrushIcon />
              Brush
            </button>
            <button
              type="button"
              className={`tab sheet-tool-tab${tool === 'eraser' ? ' tab--active' : ''}`}
              onClick={() => setTool('eraser')}
            >
              <EraserIcon />
              Eraser
            </button>
            {(['#b91c1c', '#1d4ed8', '#111827'] as const).map((color) => (
              <button
                key={color}
                type="button"
                className={`sheet-color${brushColor === color ? ' is-selected' : ''}`}
                style={{ background: color }}
                aria-label={`Brush colour ${color}`}
                onClick={() => {
                  setBrushColor(color)
                  setTool('brush')
                }}
              />
            ))}
            {[
              { label: 'S', value: 0.8 },
              { label: 'M', value: 1.6 },
              { label: 'L', value: 3 },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                className={`tab${brushSize === option.value ? ' tab--active' : ''}`}
                onClick={() => setBrushSize(option.value)}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className="link-button"
              onClick={() => setDraft((current) => ({ ...current, strokes: current.strokes.slice(0, -1) }))}
              disabled={draft.strokes.length === 0}
            >
              Undo
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                if (draft.strokes.length === 0) return
                if (!window.confirm('Clear the drawing on this picture? Measure marks are kept.')) return
                setDraft((current) => ({ ...current, strokes: [] }))
              }}
              disabled={draft.strokes.length === 0}
            >
              Clear drawing
            </button>
          </div>
          <SheetDiagram
            src={image}
            alt={configLabel(config.code)}
            points={keys}
            markers={draft.markers}
            values={draft.values}
            selected={selected}
            tool={tool}
            color={brushColor}
            size={brushSize}
            strokes={draft.strokes}
            onSelect={setSelected}
            onPlace={(key, position) => {
              setDraft((current) => ({ ...current, markers: { ...current.markers, [key]: position } }))
              setSaved(false)
            }}
            onStrokesChange={(strokes) => {
              setDraft((current) => ({ ...current, strokes }))
              setSaved(false)
            }}
          />
        </section>

        <form
          className="calculator"
          onSubmit={(event) => {
            event.preventDefault()
            handleSave()
          }}
        >
          <p className="small">Measurements (mm)</p>
          {points.heights.length > 0 && (
            <div className="field-row sheet-measure-fields">
              {points.heights.map((key) => (
                <label key={key}>
                  {key}
                  <input
                    type="number"
                    min={0}
                    value={draft.values[key] ?? ''}
                    onFocus={() => {
                      setTool('mark')
                      setSelected(key)
                    }}
                    onChange={(e) => setValue(key, e.target.value)}
                    placeholder="mm"
                  />
                </label>
              ))}
            </div>
          )}
          {points.widths.length > 0 && (
            <div className="field-row sheet-measure-fields">
              {points.widths.map((key) => (
                <label key={key}>
                  {key}
                  <input
                    type="number"
                    min={0}
                    value={draft.values[key] ?? ''}
                    onFocus={() => {
                      setTool('mark')
                      setSelected(key)
                    }}
                    onChange={(e) => setValue(key, e.target.value)}
                    placeholder="mm"
                  />
                </label>
              ))}
            </div>
          )}

          {size ? (
            <div className="price-result">
              <p>
                Opening used for sizing: {formatSheetMm(size.openingHeight)} × {formatSheetMm(size.openingWidth)} mm
                (largest marked height and width)
              </p>
              <p>
                Screen size: {size.screenLabel.replace('X', ' × ')} mm · {size.panels} panel
                {size.panels === 1 ? '' : 's'}
              </p>
            </div>
          ) : (
            <p className="muted small">Mark and fill at least one height and one width to see the screen size.</p>
          )}

          {missingMarks.length > 0 && (
            <p className="muted small">Still to mark on the drawing: {missingMarks.join(', ')}.</p>
          )}
          {missingValues.length > 0 && missingMarks.length === 0 && (
            <p className="muted small">Still to type: {missingValues.join(', ')}.</p>
          )}

          <button type="submit" className="primary-button">
            Save measurements
          </button>
          {saved && <p className="muted small">Saved on this browser. You can come back to this drawing later.</p>}
        </form>
      </div>
    </div>
  )
}

function BrushIcon() {
  return (
    <svg className="sheet-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg className="sheet-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.24 3.56 21 8.32a2 2 0 0 1 0 2.83l-7.9 7.9H21v2H8.83l-4.4-4.4a2 2 0 0 1 0-2.82l9.98-9.98a2 2 0 0 1 2.83 0zm-1.41 1.41L5.07 14.73 8.34 18h4.24l7.07-7.07-4.82-4.96z"
      />
    </svg>
  )
}
