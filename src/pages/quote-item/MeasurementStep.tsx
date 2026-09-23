import { useMemo, useState } from 'react'
import SheetDiagram, { type DiagramTool } from '../../components/SheetDiagram'
import type { DrawStroke, MarkerPosition } from '../../lib/sheetDraw'
import {
  calcSheetSize,
  configLabel,
  findSheetConfig,
  formatSheetMm,
  measureKeys,
  measurePoints,
  openingFromMeasures,
} from '../../lib/quoteSheet'
import { sheetCodeImage } from '../../lib/sheetCodeImages'

export default function MeasurementStep({
  code,
  values,
  markers,
  strokes,
  onValuesChange,
  onMarkersChange,
  onStrokesChange,
  onNext,
  onBack,
}: {
  code: string
  values: Record<string, string>
  markers: Record<string, MarkerPosition>
  strokes: DrawStroke[]
  onValuesChange: (values: Record<string, string>) => void
  onMarkersChange: (markers: Record<string, MarkerPosition>) => void
  onStrokesChange: (strokes: DrawStroke[]) => void
  onNext: (size: { widthMm: number; heightMm: number } | null) => void
  onBack: () => void
}) {
  const config = findSheetConfig(code)
  const image = config ? sheetCodeImage(code) : undefined
  const points = config ? measurePoints(config) : { heights: [] as string[], widths: [] as string[] }
  const keys = config ? measureKeys(config) : []

  const [selected, setSelected] = useState<string | null>(keys[0] ?? null)
  const [tool, setTool] = useState<DiagramTool>('brush')
  const [brushColor, setBrushColor] = useState('#b91c1c')
  const [brushSize, setBrushSize] = useState(1.6)

  const opening = useMemo(() => openingFromMeasures(values), [values])
  const size = config && opening ? calcSheetSize(config, opening.height, opening.width) : null
  const missingMarks = keys.filter((key) => !markers[key])
  const missingValues = keys.filter((key) => !(Number(values[key]) > 0))

  if (!config || !image) {
    return (
      <div>
        <p className="price-result--error">Choose a configuration first.</p>
        <button type="button" className="link-button" onClick={onBack}>
          &larr; Back
        </button>
      </div>
    )
  }

  function setValue(key: string, value: string) {
    onValuesChange({ ...values, [key]: value })
  }

  function handleContinue() {
    onNext(size ? { widthMm: Math.round(size.screenWidth), heightMm: Math.round(size.screenHeight) } : null)
  }

  return (
    <div className="wizard-panel">
      <h2>Measure the opening</h2>
      <p className="muted">
        {config.code} · {configLabel(config.code)} · {config.panels} panel{config.panels === 1 ? '' : 's'}
      </p>
      <p className="muted small">
        Brush is selected first so you can draw on the picture. Click a measure point to drop its mark. Eraser only
        removes drawing, not the marks.
      </p>

      <div className="sheet-measure__layout">
        <section>
          <div className="sheet-point-tabs">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                className={`tab${tool === 'mark' && selected === key ? ' tab--active' : ''}${markers[key] ? ' tab--marked' : ''}`}
                onClick={() => {
                  setTool('mark')
                  setSelected(key)
                }}
              >
                {key}
                {values[key] ? ` ${values[key]}` : ''}
              </button>
            ))}
          </div>
          <div className="sheet-draw-tools">
            <button
              type="button"
              className={`tab sheet-tool-tab${tool === 'brush' ? ' tab--active' : ''}`}
              onClick={() => setTool('brush')}
            >
              Brush
            </button>
            <button
              type="button"
              className={`tab sheet-tool-tab${tool === 'eraser' ? ' tab--active' : ''}`}
              onClick={() => setTool('eraser')}
            >
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
              onClick={() => onStrokesChange(strokes.slice(0, -1))}
              disabled={strokes.length === 0}
            >
              Undo
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                if (strokes.length === 0) return
                if (!window.confirm('Clear the drawing on this picture? Measure marks are kept.')) return
                onStrokesChange([])
              }}
              disabled={strokes.length === 0}
            >
              Clear drawing
            </button>
          </div>
          <SheetDiagram
            src={image}
            alt={configLabel(config.code)}
            points={keys}
            markers={markers}
            values={values}
            selected={selected}
            tool={tool}
            color={brushColor}
            size={brushSize}
            strokes={strokes}
            onSelect={setSelected}
            onPlace={(key, position) => onMarkersChange({ ...markers, [key]: position })}
            onStrokesChange={onStrokesChange}
          />
        </section>

        <div className="calculator">
          <p className="small">Measurements (mm)</p>
          {points.heights.length > 0 && (
            <div className="field-row sheet-measure-fields">
              {points.heights.map((key) => (
                <label key={key}>
                  {key}
                  <input
                    aria-label={key}
                    type="number"
                    min={0}
                    value={values[key] ?? ''}
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
                    aria-label={key}
                    type="number"
                    min={0}
                    value={values[key] ?? ''}
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

          <div className="wizard-actions">
            <button type="button" className="link-button" onClick={onBack}>
              &larr; Back
            </button>
            <button type="button" className="primary-button" onClick={handleContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
