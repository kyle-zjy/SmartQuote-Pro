import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { appendDrawPoint, type DrawStroke } from '../lib/sheetDraw'
import type { MarkerPosition } from '../lib/sheetMeasureStore'

export type DiagramTool = 'mark' | 'brush' | 'eraser'

function pointFromEvent(target: HTMLElement, event: { clientX: number; clientY: number }): { x: number; y: number } {
  const rect = target.getBoundingClientRect()
  return {
    x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
  }
}

function paintStrokes(canvas: HTMLCanvasElement, strokes: DrawStroke[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = Math.max(1, (stroke.size / 100) * canvas.width)
    const [first, ...rest] = stroke.points
    const startX = (first.x / 100) * canvas.width
    const startY = (first.y / 100) * canvas.height
    if (rest.length === 0) {
      ctx.beginPath()
      ctx.arc(startX, startY, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    for (const point of rest) {
      ctx.lineTo((point.x / 100) * canvas.width, (point.y / 100) * canvas.height)
    }
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'
}

export default function SheetDiagram({
  src,
  alt,
  points,
  markers,
  values,
  selected,
  tool,
  color,
  size,
  strokes,
  onSelect,
  onPlace,
  onStrokesChange,
}: {
  src: string
  alt: string
  points: string[]
  markers: Record<string, MarkerPosition>
  values: Record<string, string>
  selected: string | null
  tool: DiagramTool
  color: string
  size: number
  strokes: DrawStroke[]
  onSelect: (key: string) => void
  onPlace: (key: string, position: MarkerPosition) => void
  onStrokesChange: (strokes: DrawStroke[]) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<DrawStroke | null>(null)
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes
  const [liveStroke, setLiveStroke] = useState<DrawStroke | null>(null)

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
      paintStrokes(next, liveStroke ? [...strokes, liveStroke] : strokes)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(img)
    img.addEventListener('load', resize)
    return () => {
      observer.disconnect()
      img.removeEventListener('load', resize)
    }
  }, [src, strokes, liveStroke])

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (tool !== 'mark' || !selected) return
    onPlace(selected, pointFromEvent(event.currentTarget, event))
  }

  function handleMarkerPointerDown(event: ReactPointerEvent<HTMLButtonElement>, key: string) {
    if (tool !== 'mark') return
    event.preventDefault()
    event.stopPropagation()
    onSelect(key)
    const host = wrapRef.current
    if (!host) return
    const diagramEl = host

    function move(ev: PointerEvent) {
      onPlace(key, pointFromEvent(diagramEl, ev))
    }

    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (tool === 'mark') return
    event.preventDefault()
    const point = pointFromEvent(event.currentTarget, event)
    drawing.current = {
      color,
      size,
      erase: tool === 'eraser',
      points: [point],
    }
    setLiveStroke(drawing.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const point = pointFromEvent(event.currentTarget, event)
    drawing.current = {
      ...drawing.current,
      points: appendDrawPoint(drawing.current.points, point),
    }
    setLiveStroke(drawing.current)
  }

  function handleCanvasPointerUp() {
    const stroke = drawing.current
    drawing.current = null
    setLiveStroke(null)
    if (!stroke || stroke.points.length === 0) return
    onStrokesChange([...strokesRef.current, stroke])
  }

  return (
    <div
      ref={wrapRef}
      className={`sheet-diagram${tool === 'mark' && selected ? ' sheet-diagram--placing' : ''}${tool !== 'mark' ? ' sheet-diagram--drawing' : ''}`}
      onClick={handleClick}
      role="presentation"
    >
      <img src={src} alt={alt} draggable={false} />
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
      />
      {points.map((key) => {
        const marker = markers[key]
        if (!marker) return null
        const kind = key.startsWith('H') ? 'height' : 'width'
        return (
          <button
            key={key}
            type="button"
            className={`sheet-marker sheet-marker--${kind}${selected === key ? ' is-selected' : ''}`}
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            onPointerDown={(event) => handleMarkerPointerDown(event, key)}
            onClick={(event) => event.stopPropagation()}
          >
            <span>{key}</span>
            {values[key] ? <small>{values[key]}</small> : null}
          </button>
        )
      })}
    </div>
  )
}
