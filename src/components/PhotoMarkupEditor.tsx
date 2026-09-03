import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { ItemPhoto } from '../lib/quoteContext'
import { flattenPhoto, paintStrokesOnCanvas } from '../lib/photoMarkup'
import { appendDrawPoint, type DrawPoint, type DrawStroke } from '../lib/sheetDraw'

type MarkupTool = 'pen' | 'eraser'

const COLOR_PRESETS = ['#b91c1c', '#1d4ed8', '#111827', '#15803d']

function pointFromEvent(target: HTMLElement, event: { clientX: number; clientY: number }): DrawPoint {
  const rect = target.getBoundingClientRect()
  return {
    x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
  }
}

export default function PhotoMarkupEditor({
  photo,
  onSave,
  onCancel,
}: {
  photo: ItemPhoto
  onSave: (patch: { strokes: DrawStroke[]; annotatedDataUrl: string }) => void
  onCancel: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<DrawStroke | null>(null)
  const presentRef = useRef<DrawStroke[]>(photo.strokes)

  const [tool, setTool] = useState<MarkupTool>('pen')
  const [color, setColor] = useState(COLOR_PRESETS[0])
  const [size, setSize] = useState(1.6)
  const [present, setPresent] = useState<DrawStroke[]>(photo.strokes)
  const [past, setPast] = useState<DrawStroke[][]>([])
  const [future, setFuture] = useState<DrawStroke[][]>([])
  const [liveStroke, setLiveStroke] = useState<DrawStroke | null>(null)
  const [saving, setSaving] = useState(false)

  presentRef.current = present

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const img = wrap?.querySelector('img')
    if (!wrap || !canvas || !img) return

    function resize() {
      const next = canvasRef.current
      const picture = wrapRef.current?.querySelector('img')
      if (!next || !picture) return
      const width = picture.clientWidth
      const height = picture.clientHeight
      if (width < 2 || height < 2) return
      const dpr = window.devicePixelRatio || 1
      next.width = Math.round(width * dpr)
      next.height = Math.round(height * dpr)
      next.style.width = `${width}px`
      next.style.height = `${height}px`
      paintStrokesOnCanvas(next, liveStroke ? [...present, liveStroke] : present)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(img)
    img.addEventListener('load', resize)
    return () => {
      observer.disconnect()
      img.removeEventListener('load', resize)
    }
  }, [photo.dataUrl, present, liveStroke])

  function commitStroke(stroke: DrawStroke) {
    setPast((p) => [...p, presentRef.current])
    setPresent((cur) => [...cur, stroke])
    setFuture([])
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const point = pointFromEvent(event.currentTarget, event)
    drawing.current = { color, size, erase: tool === 'eraser', points: [point] }
    setLiveStroke(drawing.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const point = pointFromEvent(event.currentTarget, event)
    drawing.current = { ...drawing.current, points: appendDrawPoint(drawing.current.points, point) }
    setLiveStroke(drawing.current)
  }

  function handlePointerUp() {
    const stroke = drawing.current
    drawing.current = null
    setLiveStroke(null)
    if (!stroke || stroke.points.length === 0) return
    commitStroke(stroke)
  }

  function undo() {
    if (past.length === 0) return
    const previous = past[past.length - 1]
    setFuture((f) => [present, ...f])
    setPast((p) => p.slice(0, -1))
    setPresent(previous)
  }

  function redo() {
    if (future.length === 0) return
    const next = future[0]
    setPast((p) => [...p, present])
    setFuture((f) => f.slice(1))
    setPresent(next)
  }

  function clear() {
    if (present.length === 0) return
    setPast((p) => [...p, present])
    setPresent([])
    setFuture([])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const annotatedDataUrl = await flattenPhoto(photo.dataUrl, present)
      onSave({ strokes: present, annotatedDataUrl })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="photo-modal-overlay" onClick={onCancel}>
      <div className="photo-modal photo-markup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-draw-tools">
          <button
            type="button"
            className={`tab sheet-tool-tab${tool === 'pen' ? ' tab--active' : ''}`}
            onClick={() => setTool('pen')}
          >
            Pen
          </button>
          <button
            type="button"
            className={`tab sheet-tool-tab${tool === 'eraser' ? ' tab--active' : ''}`}
            onClick={() => setTool('eraser')}
          >
            Eraser
          </button>
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`sheet-color${color === preset ? ' is-selected' : ''}`}
              style={{ background: preset }}
              aria-label={`Colour ${preset}`}
              onClick={() => {
                setColor(preset)
                setTool('pen')
              }}
            />
          ))}
          <input
            type="color"
            className="photo-markup-color-picker"
            value={color}
            onChange={(e) => {
              setColor(e.target.value)
              setTool('pen')
            }}
            aria-label="Custom colour"
          />
          <label className="photo-markup-size">
            Size
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.1}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>
          <button type="button" className="link-button" onClick={undo} disabled={past.length === 0}>
            Undo
          </button>
          <button type="button" className="link-button" onClick={redo} disabled={future.length === 0}>
            Redo
          </button>
          <button type="button" className="link-button" onClick={clear} disabled={present.length === 0}>
            Clear
          </button>
        </div>

        <div ref={wrapRef} className="sheet-diagram sheet-diagram--drawing photo-markup-canvas">
          <img src={photo.dataUrl} alt="Photo being annotated" draggable={false} />
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        <div className="photo-modal__actions">
          <button type="button" className="link-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save annotation'}
          </button>
        </div>
      </div>
    </div>
  )
}
